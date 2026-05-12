-- Query Set Versioning
--
-- Problem: editing tracking queries between scans corrupts the trend chart —
-- "did the score change because visibility improved, or because we measured
-- different things?" is impossible to answer from a single line.
--
-- Solution: every set of queries is a version. Scans are pinned to the
-- version that was current when they ran. The trend chart can then group by
-- version (apples-to-apples) and mark version boundaries (when the user
-- changed what was being measured).
--
-- A business has 1..N versions, monotonically numbered. The latest is the
-- "current" version. Editing queries creates v(N+1). Old versions stay
-- queryable for historical scans but never become current again.

create table if not exists public.query_set_versions (
  id uuid default uuid_generate_v4() primary key,
  business_id uuid references public.businesses(id) on delete cascade not null,
  version_number int not null,
  created_at timestamptz default now(),
  unique (business_id, version_number)
);

create index if not exists query_set_versions_business_idx
  on public.query_set_versions (business_id, version_number desc);

-- Add version FK to queries + scans. Nullable for the backfill, then NOT NULL.
alter table public.queries
  add column if not exists query_set_version_id uuid references public.query_set_versions(id) on delete cascade;

alter table public.scans
  add column if not exists query_set_version_id uuid references public.query_set_versions(id) on delete set null;

-- Backfill: every existing business gets v1, all existing queries and scans
-- are tagged to it. Pre-launch with few real users, so collapsing prior
-- inactive queries into v1 is acceptable — it just means the migrated
-- timeline starts at "v1" with no version boundary before it.
do $$
declare
  v_business record;
  v_version_id uuid;
begin
  for v_business in select id from public.businesses loop
    insert into public.query_set_versions (business_id, version_number)
    values (v_business.id, 1)
    on conflict (business_id, version_number) do nothing
    returning id into v_version_id;

    -- on conflict didn't return — fetch the existing one
    if v_version_id is null then
      select id into v_version_id
      from public.query_set_versions
      where business_id = v_business.id and version_number = 1;
    end if;

    update public.queries
      set query_set_version_id = v_version_id
      where business_id = v_business.id
        and query_set_version_id is null;

    update public.scans
      set query_set_version_id = v_version_id
      where business_id = v_business.id
        and query_set_version_id is null;
  end loop;
end $$;

alter table public.queries alter column query_set_version_id set not null;

-- scans.query_set_version_id stays nullable: orphaned/legacy scans where the
-- business was deleted shouldn't break the schema.

-- RLS
alter table public.query_set_versions enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'query_set_versions'
      and policyname = 'Users can read own query set versions'
  ) then
    create policy "Users can read own query set versions"
      on public.query_set_versions for select
      using (auth.uid() = (select user_id from public.businesses where id = business_id));
  end if;
end $$;

-- Helper: current (max version_number) version for a business. Returns null
-- if the business has no version yet (shouldn't happen post-migration, but
-- callers should still handle it).
create or replace function public.get_current_query_set_version(p_business_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.query_set_versions
  where business_id = p_business_id
  order by version_number desc
  limit 1;
$$;

-- Updated scan creator: pins each new scan to the business's current version.
-- Logic is otherwise identical to the prior version in 20260510000000.
create or replace function public.create_scan_if_allowed(
  p_business_id uuid,
  p_user_id uuid
)
returns table(scan_id uuid, allowed boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription_status text;
  v_subscription_tier text;
  v_business_exists boolean;
  v_blocking_scan_count integer;
  v_daily_limit integer;
  v_scan_id uuid;
  v_version_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select exists(
    select 1
    from public.businesses
    where id = p_business_id
      and user_id = p_user_id
  )
  into v_business_exists;

  if not v_business_exists then
    return query select null::uuid, false, 'business_not_found'::text;
    return;
  end if;

  select subscription_status, subscription_tier
  into v_subscription_status, v_subscription_tier
  from public.profiles
  where id = p_user_id;

  if coalesce(v_subscription_status, 'free') <> 'active' then
    select count(*)
    into v_blocking_scan_count
    from public.scans s
    join public.businesses b on b.id = s.business_id
    where b.user_id = p_user_id
      and s.status in ('pending', 'running', 'completed');

    if v_blocking_scan_count >= 1 then
      return query select null::uuid, false, 'subscription_required'::text;
      return;
    end if;
  else
    if v_subscription_tier in ('growth', 'agency') then
      v_daily_limit := 5;
    else
      v_daily_limit := 1;
    end if;

    select count(*)
    into v_blocking_scan_count
    from public.scans s
    join public.businesses b on b.id = s.business_id
    where b.user_id = p_user_id
      and s.status in ('pending', 'running', 'completed')
      and s.started_at > now() - interval '24 hours';

    if v_blocking_scan_count >= v_daily_limit then
      return query select null::uuid, false, 'daily_quota_exceeded'::text;
      return;
    end if;
  end if;

  v_version_id := public.get_current_query_set_version(p_business_id);

  insert into public.scans (business_id, status, triggered_by, query_set_version_id)
  values (p_business_id, 'running', 'manual', v_version_id)
  returning id into v_scan_id;

  return query select v_scan_id, true, null::text;
end;
$$;
