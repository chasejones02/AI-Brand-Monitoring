-- Tracking Sets — supersedes the linear-versioning model from
-- 20260511000000_query_set_versions.sql.
--
-- New model:
--   A business owns 1..3 "tracking sets". Each set holds up to 5 queries and
--   is tracked independently — its own scan history, its own trend chart.
--   The user navigates between sets via tabs on the dashboard.
--
-- Lock mechanism:
--   When a set is first scanned, locked_until is set to scan_time + 30 days.
--   While now() < locked_until, the queries in that set CANNOT be edited.
--   This is what keeps the trend chart honest — the user can't game it by
--   swapping in easier queries.
--
-- Tier limits (enforced at the route layer):
--   Free    1 set  (the auto-generated one — no creating more)
--   Starter 2 sets (auto + 1 user-created)
--   Growth  3 sets (auto + 2 user-created)

-- Repurpose query_set_versions → tracking_sets. Since the prior migration
-- created the table but pre-launch data is minimal, we restructure in place
-- rather than introducing a parallel table. Renames preserve FK references
-- from queries and scans without any column-level data movement.

alter table public.query_set_versions rename to tracking_sets;

alter table public.tracking_sets rename column version_number to slot_number;

alter table public.tracking_sets
  add column if not exists name text not null default 'Default';

alter table public.tracking_sets
  add column if not exists first_scanned_at timestamptz;

alter table public.tracking_sets
  add column if not exists locked_until timestamptz;

-- slot_number is now 1..3 per business (was monotonically increasing). The
-- existing unique (business_id, version_number) constraint becomes
-- unique (business_id, slot_number) — same constraint, different semantics.
alter index if exists query_set_versions_business_id_version_number_key
  rename to tracking_sets_business_id_slot_number_key;

alter index if exists query_set_versions_business_idx
  rename to tracking_sets_business_idx;

-- Rename the FK columns on queries and scans so the schema reads cleanly.
alter table public.queries rename column query_set_version_id to tracking_set_id;
alter table public.scans rename column query_set_version_id to tracking_set_id;

-- Backfill: any business that has tracking_set_id-tagged data already (from
-- the prior migration) keeps slot 1. The default name 'Default' applies.

-- Renamed RLS policy + new policies for write paths.
do $$ begin
  if exists (
    select 1 from pg_policies
    where tablename = 'tracking_sets'
      and policyname = 'Users can read own query set versions'
  ) then
    alter policy "Users can read own query set versions" on public.tracking_sets
      rename to "Users can read own tracking sets";
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'tracking_sets'
      and policyname = 'Users can manage own tracking sets'
  ) then
    -- Write access via backend service role only, but allow user-scoped
    -- updates for cases where RLS-authenticated calls touch this table.
    create policy "Users can manage own tracking sets"
      on public.tracking_sets for all
      using (auth.uid() = (select user_id from public.businesses where id = business_id));
  end if;
end $$;

-- Drop the old helper — semantics changed (no longer "current version").
drop function if exists public.get_current_query_set_version(uuid);

-- Lock check used by both the RPC and direct calls.
create or replace function public.tracking_set_is_locked(p_set_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(locked_until > now(), false)
  from public.tracking_sets
  where id = p_set_id;
$$;

-- Rewritten scan creator: pins each new scan to a specific tracking set
-- (caller chooses which set; defaults to slot 1 if not specified). On the
-- first scan of a set, kicks off the 30-day edit lock.
create or replace function public.create_scan_if_allowed(
  p_business_id uuid,
  p_user_id uuid,
  p_tracking_set_id uuid default null
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
  v_target_set_id uuid;
  v_target_set_business_id uuid;
  v_set_first_scanned_at timestamptz;
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

  -- Resolve the target tracking set. If the caller specified one, validate
  -- it belongs to this business. Otherwise default to slot 1.
  if p_tracking_set_id is not null then
    select id, business_id into v_target_set_id, v_target_set_business_id
    from public.tracking_sets
    where id = p_tracking_set_id;

    if v_target_set_id is null or v_target_set_business_id <> p_business_id then
      return query select null::uuid, false, 'tracking_set_not_found'::text;
      return;
    end if;
  else
    select id into v_target_set_id
    from public.tracking_sets
    where business_id = p_business_id
    order by slot_number asc
    limit 1;
  end if;

  if v_target_set_id is null then
    return query select null::uuid, false, 'no_tracking_set'::text;
    return;
  end if;

  -- Quota check (unchanged from prior migration: tier-aware rolling 24h).
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

  -- Insert the scan against the target set.
  insert into public.scans (business_id, status, triggered_by, tracking_set_id)
  values (p_business_id, 'running', 'manual', v_target_set_id)
  returning id into v_scan_id;

  -- First-scan side-effect: stamp first_scanned_at + start the 30-day lock.
  select first_scanned_at into v_set_first_scanned_at
  from public.tracking_sets where id = v_target_set_id;

  if v_set_first_scanned_at is null then
    update public.tracking_sets
      set first_scanned_at = now(),
          locked_until = now() + interval '30 days'
      where id = v_target_set_id;
  end if;

  return query select v_scan_id, true, null::text;
end;
$$;
