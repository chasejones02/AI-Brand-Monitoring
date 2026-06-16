-- ============================================================================
-- PRODUCTION BOOTSTRAP — all migrations concatenated in timestamp order.
-- Generated 2026-06-16. Run ONCE against a FRESH/EMPTY Supabase project.
-- Do NOT run against a database that already has these tables/functions.
-- This file is NOT a migration — keep it out of normal migration tooling.
-- ============================================================================


-- =====[ 01 / 16 ]=====================================================
-- 20260313000000_initial_schema.sql
-- ====================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table (extends Supabase Auth)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  stripe_customer_id text,
  subscription_status text default 'free' check (subscription_status in ('free', 'active', 'canceled', 'past_due')),
  subscription_tier text default 'starter' check (subscription_tier in ('starter', 'growth', 'agency')),
  created_at timestamptz default now()
);

-- Businesses table
create table if not exists public.businesses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  website text,
  industry text,
  created_at timestamptz default now()
);

-- Queries table (the 5 target queries per business)
create table if not exists public.queries (
  id uuid default uuid_generate_v4() primary key,
  business_id uuid references public.businesses(id) on delete cascade not null,
  query_text text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Scans table (one scan = one full run across all platforms for all queries)
create table if not exists public.scans (
  id uuid default uuid_generate_v4() primary key,
  business_id uuid references public.businesses(id) on delete cascade not null,
  status text default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  visibility_score numeric(5,2),
  triggered_by text default 'manual' check (triggered_by in ('manual', 'scheduled')),
  started_at timestamptz default now(),
  completed_at timestamptz
);

-- Scan results table (one row per query + platform combination)
create table if not exists public.scan_results (
  id uuid default uuid_generate_v4() primary key,
  scan_id uuid references public.scans(id) on delete cascade not null,
  query_id uuid references public.queries(id) on delete cascade not null,
  platform text not null check (platform in ('openai', 'anthropic', 'perplexity', 'gemini')),
  raw_response text,
  mentioned boolean default false,
  mention_position integer,  -- 1 = first, 2 = second, etc. null = not mentioned
  sentiment text check (sentiment in ('positive', 'neutral', 'negative')),
  competitors_mentioned text[],  -- array of competitor names found in response
  mention_score integer default 0,
  position_score integer default 0,
  sentiment_score integer default 0,
  created_at timestamptz default now()
);

-- Auto-create profile when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.queries enable row level security;
alter table public.scans enable row level security;
alter table public.scan_results enable row level security;

-- RLS Policies (safe to re-run)
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Users can view own profile') then
    create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Users can update own profile') then
    create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'businesses' and policyname = 'Users can manage own businesses') then
    create policy "Users can manage own businesses" on public.businesses for all using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'queries' and policyname = 'Users can manage own queries') then
    create policy "Users can manage own queries" on public.queries for all using (
      auth.uid() = (select user_id from public.businesses where id = business_id)
    );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'scans' and policyname = 'Users can view own scans') then
    create policy "Users can view own scans" on public.scans for all using (
      auth.uid() = (select user_id from public.businesses where id = business_id)
    );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'scan_results' and policyname = 'Users can view own scan results') then
    create policy "Users can view own scan results" on public.scan_results for all using (
      auth.uid() = (select b.user_id from public.scans s join public.businesses b on s.business_id = b.id where s.id = scan_id)
    );
  end if;
end $$;


-- =====[ 02 / 16 ]=====================================================
-- 20260428000000_generated_free_scan_flow.sql
-- ====================================================================

-- Store the business context used to generate free-scan queries.
alter table public.businesses
  add column if not exists location text;

-- Track whether a query was generated by Visaion or supplied by the user.
alter table public.queries
  add column if not exists source text default 'custom'
    check (source in ('generated', 'custom')),
  add column if not exists intent text,
  add column if not exists generation_reason text;

-- Atomically create a scan for a user. Free users are allowed one in-flight or
-- completed scan total; failed scans do not consume the free scan.
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
  v_business_exists boolean;
  v_blocking_scan_count integer;
  v_scan_id uuid;
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

  select subscription_status
  into v_subscription_status
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
  end if;

  insert into public.scans (business_id, status, triggered_by)
  values (p_business_id, 'running', 'manual')
  returning id into v_scan_id;

  return query select v_scan_id, true, null::text;
end;
$$;


-- =====[ 03 / 16 ]=====================================================
-- 20260505000000_stripe_webhook_idempotency.sql
-- ====================================================================

-- Track Stripe webhook events we have already applied so retries are no-ops.
-- Stripe delivers events at-least-once; the unique event_id PK is our dedup key.
create table if not exists public.processed_stripe_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.processed_stripe_events enable row level security;
-- No policies: only the service role (backend) reads or writes this table.


-- =====[ 04 / 16 ]=====================================================
-- 20260510000000_scan_quotas.sql
-- ====================================================================

-- Tier-aware daily scan quotas (rolling 24h window).
--
-- Free:    1 lifetime scan total.
-- Starter: 1 scan per rolling 24h window.
-- Growth:  5 scans per rolling 24h window.
-- Agency:  treated as growth (Agency dropped from launch — see ROADMAP).
--
-- Rolling means: the window is "now() - interval '24 hours'", not a calendar
-- day reset. The next slot opens 24h after the oldest in-window scan started.

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
    -- Free tier: 1 lifetime scan (excluding failed).
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
    -- Paid tiers: rolling 24h window. Growth/Agency get 5, Starter gets 1.
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

  insert into public.scans (business_id, status, triggered_by)
  values (p_business_id, 'running', 'manual')
  returning id into v_scan_id;

  return query select v_scan_id, true, null::text;
end;
$$;

-- Quota status reporter for the dashboard pill.
-- Returns (tier, daily_limit, used_in_window, remaining, next_reset_at).
-- next_reset_at = oldest in-window scan's started_at + 24h, or null when the
-- user has unused quota. For free tier, daily_limit = 1 and next_reset_at is
-- always null (lifetime, not time-based).
create or replace function public.get_scan_quota_status(p_user_id uuid)
returns table(
  tier text,
  daily_limit integer,
  used_in_window integer,
  remaining integer,
  next_reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription_status text;
  v_subscription_tier text;
  v_used integer;
  v_limit integer;
  v_oldest_in_window timestamptz;
  v_effective_tier text;
begin
  select subscription_status, subscription_tier
  into v_subscription_status, v_subscription_tier
  from public.profiles
  where id = p_user_id;

  if coalesce(v_subscription_status, 'free') <> 'active' then
    -- Free tier: lifetime count.
    select count(*)
    into v_used
    from public.scans s
    join public.businesses b on b.id = s.business_id
    where b.user_id = p_user_id
      and s.status in ('pending', 'running', 'completed');

    return query select
      'free'::text,
      1,
      v_used,
      greatest(0, 1 - v_used),
      null::timestamptz;
    return;
  end if;

  if v_subscription_tier in ('growth', 'agency') then
    v_limit := 5;
    v_effective_tier := v_subscription_tier;
  else
    v_limit := 1;
    v_effective_tier := coalesce(v_subscription_tier, 'starter');
  end if;

  select count(*), min(s.started_at)
  into v_used, v_oldest_in_window
  from public.scans s
  join public.businesses b on b.id = s.business_id
  where b.user_id = p_user_id
    and s.status in ('pending', 'running', 'completed')
    and s.started_at > now() - interval '24 hours';

  return query select
    v_effective_tier,
    v_limit,
    v_used,
    greatest(0, v_limit - v_used),
    case
      when v_used >= v_limit and v_oldest_in_window is not null
        then v_oldest_in_window + interval '24 hours'
      else null
    end;
end;
$$;


-- =====[ 05 / 16 ]=====================================================
-- 20260511000000_query_set_versions.sql
-- ====================================================================

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


-- =====[ 06 / 16 ]=====================================================
-- 20260511000001_tracking_sets.sql
-- ====================================================================

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


-- =====[ 07 / 16 ]=====================================================
-- 20260512000000_scan_results_variant_used.sql
-- ====================================================================

-- Add variant_used to scan_results so we can surface the exact business
-- name variant the AI used (e.g. "Downtown Dental" vs "Downtown Dental & Spa").
-- Historical rows will be NULL — that's fine, we only show it when present.

ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS variant_used TEXT;


-- =====[ 08 / 16 ]=====================================================
-- 20260512000001_scan_recommendations.sql
-- ====================================================================

-- Store AI-generated recommendations on the scan row.
-- Always 7 generated; tier-gating (1/3/7 visible) is enforced at the API layer.
-- Historical scans will have NULL — show nothing rather than error.

ALTER TABLE scans ADD COLUMN IF NOT EXISTS recommendations JSONB;


-- =====[ 09 / 16 ]=====================================================
-- 20260512000003_per_set_quota.sql
-- ====================================================================

-- Per-tracking-set quota.
--
-- Previous model counted all scans for a user globally, which meant running
-- a free scan blocked new tracking sets even after upgrade. New model:
--
--   Free:    1 lifetime scan per tracking set (new set = new chance to scan)
--   Starter: 1 scan per tracking set per rolling 24h
--   Growth:  5 scans per tracking set per rolling 24h
--
-- This supersedes create_scan_if_allowed from both
-- 20260510000000_scan_quotas.sql and 20260511000001_tracking_sets.sql.

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
    select 1 from public.businesses
    where id = p_business_id and user_id = p_user_id
  ) into v_business_exists;

  if not v_business_exists then
    return query select null::uuid, false, 'business_not_found'::text;
    return;
  end if;

  -- Resolve tracking set (caller-specified or default to slot 1).
  if p_tracking_set_id is not null then
    select id, business_id into v_target_set_id, v_target_set_business_id
    from public.tracking_sets where id = p_tracking_set_id;

    if v_target_set_id is null or v_target_set_business_id <> p_business_id then
      return query select null::uuid, false, 'tracking_set_not_found'::text;
      return;
    end if;
  else
    select id into v_target_set_id
    from public.tracking_sets
    where business_id = p_business_id
    order by slot_number asc limit 1;
  end if;

  if v_target_set_id is null then
    return query select null::uuid, false, 'no_tracking_set'::text;
    return;
  end if;

  select subscription_status, subscription_tier
  into v_subscription_status, v_subscription_tier
  from public.profiles where id = p_user_id;

  if coalesce(v_subscription_status, 'free') <> 'active' then
    -- Free: 1 lifetime scan per tracking set.
    select count(*) into v_blocking_scan_count
    from public.scans
    where tracking_set_id = v_target_set_id
      and status in ('pending', 'running', 'completed');

    if v_blocking_scan_count >= 1 then
      return query select null::uuid, false, 'subscription_required'::text;
      return;
    end if;
  else
    -- Paid: rolling 24h per tracking set.
    v_daily_limit := case
      when v_subscription_tier in ('growth', 'agency') then 5
      else 1
    end;

    select count(*) into v_blocking_scan_count
    from public.scans
    where tracking_set_id = v_target_set_id
      and status in ('pending', 'running', 'completed')
      and started_at > now() - interval '24 hours';

    if v_blocking_scan_count >= v_daily_limit then
      return query select null::uuid, false, 'daily_quota_exceeded'::text;
      return;
    end if;
  end if;

  insert into public.scans (business_id, status, triggered_by, tracking_set_id)
  values (p_business_id, 'running', 'manual', v_target_set_id)
  returning id into v_scan_id;

  -- First-scan side-effect: stamp first_scanned_at + start the 30-day lock.
  select first_scanned_at into v_set_first_scanned_at
  from public.tracking_sets where id = v_target_set_id;

  if v_set_first_scanned_at is null then
    update public.tracking_sets
      set first_scanned_at = now(), locked_until = now() + interval '30 days'
    where id = v_target_set_id;
  end if;

  return query select v_scan_id, true, null::text;
end;
$$;

-- Quota status reporter: now scoped to a specific tracking set when provided.
-- Falls back to global user count when no set is given (backward compat).
create or replace function public.get_scan_quota_status(
  p_user_id uuid,
  p_tracking_set_id uuid default null
)
returns table(
  tier text,
  daily_limit integer,
  used_in_window integer,
  remaining integer,
  next_reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription_status text;
  v_subscription_tier text;
  v_used integer;
  v_limit integer;
  v_oldest_in_window timestamptz;
  v_effective_tier text;
begin
  select subscription_status, subscription_tier
  into v_subscription_status, v_subscription_tier
  from public.profiles where id = p_user_id;

  if coalesce(v_subscription_status, 'free') <> 'active' then
    if p_tracking_set_id is not null then
      select count(*) into v_used
      from public.scans
      where tracking_set_id = p_tracking_set_id
        and status in ('pending', 'running', 'completed');
    else
      select count(*) into v_used
      from public.scans s
      join public.businesses b on b.id = s.business_id
      where b.user_id = p_user_id
        and s.status in ('pending', 'running', 'completed');
    end if;

    return query select 'free'::text, 1, v_used, greatest(0, 1 - v_used), null::timestamptz;
    return;
  end if;

  v_limit := case
    when v_subscription_tier in ('growth', 'agency') then 5
    else 1
  end;
  v_effective_tier := coalesce(v_subscription_tier, 'starter');

  if p_tracking_set_id is not null then
    select count(*), min(started_at)
    into v_used, v_oldest_in_window
    from public.scans
    where tracking_set_id = p_tracking_set_id
      and status in ('pending', 'running', 'completed')
      and started_at > now() - interval '24 hours';
  else
    select count(*), min(s.started_at)
    into v_used, v_oldest_in_window
    from public.scans s
    join public.businesses b on b.id = s.business_id
    where b.user_id = p_user_id
      and s.status in ('pending', 'running', 'completed')
      and s.started_at > now() - interval '24 hours';
  end if;

  return query select
    v_effective_tier,
    v_limit,
    v_used,
    greatest(0, v_limit - v_used),
    case
      when v_used >= v_limit and v_oldest_in_window is not null
        then v_oldest_in_window + interval '24 hours'
      else null
    end;
end;
$$;


-- =====[ 10 / 16 ]=====================================================
-- 20260518000000_smooth_position_score.sql
-- ====================================================================

-- P6.1: switch position_score to numeric so the smooth log-decay curve
-- can store decimal values (e.g. pos 2 = 3.15, pos 3 = 2.50).
-- Existing integer values cast losslessly to numeric.

alter table public.scan_results
  alter column position_score type numeric(5, 2) using position_score::numeric(5, 2);


-- =====[ 11 / 16 ]=====================================================
-- 20260521000000_scan_results_citations.sql
-- ====================================================================

-- Add citations to scan_results so we can surface the source URLs the AI
-- platform actually grounded its answer on (Gemini's googleSearch tool today;
-- ChatGPT and Claude web_search to come). Stored as JSONB array of
-- { uri, title } objects. NULL for historical rows and ungrounded platforms.

ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS citations JSONB;


-- =====[ 12 / 16 ]=====================================================
-- 20260521000001_scans_usage_metrics.sql
-- ====================================================================

-- Add per-scan usage metrics so we can model real $/scan after enabling live
-- web search on OpenAI/Gemini. Shape:
--   { "openai":     { "input_tokens": n, "output_tokens": n, "search_calls": n },
--     "gemini":     { ... },
--     "perplexity": { ... },
--     "anthropic":  { ... } }
-- Stored as raw counts (not USD) so pricing-table changes don't require a
-- backfill — apply pricing in code when displaying.

ALTER TABLE scans ADD COLUMN IF NOT EXISTS usage_metrics JSONB;


-- =====[ 13 / 16 ]=====================================================
-- 20260604000000_drop_stale_rpc_overloads.sql
-- ====================================================================

-- Drop stale RPC overloads.
--
-- `create or replace function` only replaces a function with the *same*
-- argument signature. When later migrations added a `p_tracking_set_id`
-- parameter, they created NEW overloads alongside the old ones instead of
-- replacing them, so the database accumulated multiple versions:
--
--   get_scan_quota_status(uuid)            -- old, pre-tracking-set
--   get_scan_quota_status(uuid, uuid)      -- current (per-set)
--
--   create_scan_if_allowed(uuid, uuid)        -- old, pre-tracking-set
--   create_scan_if_allowed(uuid, uuid, uuid)  -- current (per-set)
--
-- The new versions give their extra arg a DEFAULT, so a call that omits it
-- (e.g. the account page fetching quota with no setId) matches BOTH overloads
-- and Postgres aborts with "function ... is not unique" (PGRST203). That
-- surfaced as "Failed to fetch quota" on the account page while the dashboard
-- pill — which always passes a setId — kept working.
--
-- Drop the obsolete signatures so only the canonical per-set versions remain.

drop function if exists public.get_scan_quota_status(uuid);
drop function if exists public.create_scan_if_allowed(uuid, uuid);


-- =====[ 14 / 16 ]=====================================================
-- 20260610000000_subscription_tier_free.sql
-- ====================================================================

-- Allow profiles to explicitly represent the free tier.
--
-- The application writes subscription_tier = 'free' when a Stripe customer is
-- canceled or otherwise loses paid entitlement. The original schema only
-- allowed starter/growth/agency, which can make cancellation reconciliation
-- fail and leave stale paid access cached in profiles.

alter table public.profiles
  drop constraint if exists profiles_subscription_tier_check;

alter table public.profiles
  alter column subscription_tier set default 'free';

update public.profiles
set subscription_tier = 'free'
where coalesce(subscription_status, 'free') <> 'active';

alter table public.profiles
  add constraint profiles_subscription_tier_check
  check (subscription_tier in ('free', 'starter', 'growth', 'agency'));


-- =====[ 15 / 16 ]=====================================================
-- 20260611000000_growth_scan_quota_3.sql
-- ====================================================================

-- Lower the Growth (and Agency-mapped) per-tracking-set scan quota from 5 to 3.
--
-- Free:    1 lifetime scan per tracking set.
-- Starter: 1 scan per tracking set per rolling 24h window.
-- Growth:  3 scans per tracking set per rolling 24h window. (was 5)
-- Agency:  treated as growth (Agency dropped from launch — see ROADMAP).
--
-- IMPORTANT: the canonical functions are the per-set versions introduced in
-- 20260512000003_per_set_quota.sql:
--   create_scan_if_allowed(uuid, uuid, uuid)   -- (business, user, tracking_set)
--   get_scan_quota_status(uuid, uuid)           -- (user, tracking_set)
-- We `create or replace` THOSE signatures so we don't spawn a new overload.
--
-- We also drop the obsolete pre-tracking-set signatures if they exist. Leaving
-- them around makes a no-setId call ambiguous ("function is not unique",
-- PGRST203) — the same bug 20260604000000_drop_stale_rpc_overloads.sql fixed.

drop function if exists public.get_scan_quota_status(uuid);
drop function if exists public.create_scan_if_allowed(uuid, uuid);

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
    select 1 from public.businesses
    where id = p_business_id and user_id = p_user_id
  ) into v_business_exists;

  if not v_business_exists then
    return query select null::uuid, false, 'business_not_found'::text;
    return;
  end if;

  -- Resolve tracking set (caller-specified or default to slot 1).
  if p_tracking_set_id is not null then
    select id, business_id into v_target_set_id, v_target_set_business_id
    from public.tracking_sets where id = p_tracking_set_id;

    if v_target_set_id is null or v_target_set_business_id <> p_business_id then
      return query select null::uuid, false, 'tracking_set_not_found'::text;
      return;
    end if;
  else
    select id into v_target_set_id
    from public.tracking_sets
    where business_id = p_business_id
    order by slot_number asc limit 1;
  end if;

  if v_target_set_id is null then
    return query select null::uuid, false, 'no_tracking_set'::text;
    return;
  end if;

  select subscription_status, subscription_tier
  into v_subscription_status, v_subscription_tier
  from public.profiles where id = p_user_id;

  if coalesce(v_subscription_status, 'free') <> 'active' then
    -- Free: 1 lifetime scan per tracking set.
    select count(*) into v_blocking_scan_count
    from public.scans
    where tracking_set_id = v_target_set_id
      and status in ('pending', 'running', 'completed');

    if v_blocking_scan_count >= 1 then
      return query select null::uuid, false, 'subscription_required'::text;
      return;
    end if;
  else
    -- Paid: rolling 24h per tracking set. Growth/Agency get 3, Starter gets 1.
    v_daily_limit := case
      when v_subscription_tier in ('growth', 'agency') then 3
      else 1
    end;

    select count(*) into v_blocking_scan_count
    from public.scans
    where tracking_set_id = v_target_set_id
      and status in ('pending', 'running', 'completed')
      and started_at > now() - interval '24 hours';

    if v_blocking_scan_count >= v_daily_limit then
      return query select null::uuid, false, 'daily_quota_exceeded'::text;
      return;
    end if;
  end if;

  insert into public.scans (business_id, status, triggered_by, tracking_set_id)
  values (p_business_id, 'running', 'manual', v_target_set_id)
  returning id into v_scan_id;

  -- First-scan side-effect: stamp first_scanned_at + start the 30-day lock.
  select first_scanned_at into v_set_first_scanned_at
  from public.tracking_sets where id = v_target_set_id;

  if v_set_first_scanned_at is null then
    update public.tracking_sets
      set first_scanned_at = now(), locked_until = now() + interval '30 days'
    where id = v_target_set_id;
  end if;

  return query select v_scan_id, true, null::text;
end;
$$;

-- Quota status reporter: scoped to a specific tracking set when provided.
-- Falls back to global user count when no set is given (backward compat).
create or replace function public.get_scan_quota_status(
  p_user_id uuid,
  p_tracking_set_id uuid default null
)
returns table(
  tier text,
  daily_limit integer,
  used_in_window integer,
  remaining integer,
  next_reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription_status text;
  v_subscription_tier text;
  v_used integer;
  v_limit integer;
  v_oldest_in_window timestamptz;
  v_effective_tier text;
begin
  select subscription_status, subscription_tier
  into v_subscription_status, v_subscription_tier
  from public.profiles where id = p_user_id;

  if coalesce(v_subscription_status, 'free') <> 'active' then
    if p_tracking_set_id is not null then
      select count(*) into v_used
      from public.scans
      where tracking_set_id = p_tracking_set_id
        and status in ('pending', 'running', 'completed');
    else
      select count(*) into v_used
      from public.scans s
      join public.businesses b on b.id = s.business_id
      where b.user_id = p_user_id
        and s.status in ('pending', 'running', 'completed');
    end if;

    return query select 'free'::text, 1, v_used, greatest(0, 1 - v_used), null::timestamptz;
    return;
  end if;

  v_limit := case
    when v_subscription_tier in ('growth', 'agency') then 3
    else 1
  end;
  v_effective_tier := coalesce(v_subscription_tier, 'starter');

  if p_tracking_set_id is not null then
    select count(*), min(started_at)
    into v_used, v_oldest_in_window
    from public.scans
    where tracking_set_id = p_tracking_set_id
      and status in ('pending', 'running', 'completed')
      and started_at > now() - interval '24 hours';
  else
    select count(*), min(s.started_at)
    into v_used, v_oldest_in_window
    from public.scans s
    join public.businesses b on b.id = s.business_id
    where b.user_id = p_user_id
      and s.status in ('pending', 'running', 'completed')
      and s.started_at > now() - interval '24 hours';
  end if;

  return query select
    v_effective_tier,
    v_limit,
    v_used,
    greatest(0, v_limit - v_used),
    case
      when v_used >= v_limit and v_oldest_in_window is not null
        then v_oldest_in_window + interval '24 hours'
      else null
    end;
end;
$$;


-- =====[ 16 / 16 ]=====================================================
-- 20260612000000_monthly_scan_quota.sql
-- ====================================================================

-- Switch paid tiers from a per-tracking-set rolling-24h quota to a per-USER
-- rolling-30-day cap. This bounds worst-case API spend per subscriber so every
-- tier is profitable even when a user maxes their quota (see cost analysis).
--
-- Free:    1 lifetime scan per tracking set.            (unchanged)
-- Starter: 25 scans per rolling 30 days, across all the user's sets/businesses.
-- Growth:  40 scans per rolling 30 days, across all the user's sets/businesses.
-- Agency:  treated as growth (Agency dropped from launch — see ROADMAP).
--
-- Why per-user-global instead of per-set: cost is driven by total scans run, not
-- by how they're spread across tracking sets. A single monthly bucket can't be
-- gamed by spreading scans across sets the way a per-set daily cap could.
--
-- These `create or replace` the canonical (uuid,uuid,uuid) and (uuid,uuid)
-- signatures from 20260512000003_per_set_quota.sql — no new overload is spawned.
--
-- NOTE on field names: the RPC still returns a column called `daily_limit` and a
-- reason code `daily_quota_exceeded`. These are now MONTHLY semantically; the
-- legacy names are kept to avoid churning the API contract, route, and frontend
-- types. `used_in_window` / `next_reset_at` were already window-agnostic.

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
  v_monthly_limit integer;
  v_scan_id uuid;
  v_target_set_id uuid;
  v_target_set_business_id uuid;
  v_set_first_scanned_at timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select exists(
    select 1 from public.businesses
    where id = p_business_id and user_id = p_user_id
  ) into v_business_exists;

  if not v_business_exists then
    return query select null::uuid, false, 'business_not_found'::text;
    return;
  end if;

  -- Resolve tracking set (caller-specified or default to slot 1).
  if p_tracking_set_id is not null then
    select id, business_id into v_target_set_id, v_target_set_business_id
    from public.tracking_sets where id = p_tracking_set_id;

    if v_target_set_id is null or v_target_set_business_id <> p_business_id then
      return query select null::uuid, false, 'tracking_set_not_found'::text;
      return;
    end if;
  else
    select id into v_target_set_id
    from public.tracking_sets
    where business_id = p_business_id
    order by slot_number asc limit 1;
  end if;

  if v_target_set_id is null then
    return query select null::uuid, false, 'no_tracking_set'::text;
    return;
  end if;

  select subscription_status, subscription_tier
  into v_subscription_status, v_subscription_tier
  from public.profiles where id = p_user_id;

  if coalesce(v_subscription_status, 'free') <> 'active' then
    -- Free: 1 lifetime scan per tracking set.
    select count(*) into v_blocking_scan_count
    from public.scans
    where tracking_set_id = v_target_set_id
      and status in ('pending', 'running', 'completed');

    if v_blocking_scan_count >= 1 then
      return query select null::uuid, false, 'subscription_required'::text;
      return;
    end if;
  else
    -- Paid: rolling 30-day cap counted across ALL the user's businesses.
    -- Growth/Agency get 40, Starter gets 25.
    v_monthly_limit := case
      when v_subscription_tier in ('growth', 'agency') then 40
      else 25
    end;

    select count(*) into v_blocking_scan_count
    from public.scans s
    join public.businesses b on b.id = s.business_id
    where b.user_id = p_user_id
      and s.status in ('pending', 'running', 'completed')
      and s.started_at > now() - interval '30 days';

    if v_blocking_scan_count >= v_monthly_limit then
      return query select null::uuid, false, 'daily_quota_exceeded'::text;
      return;
    end if;
  end if;

  insert into public.scans (business_id, status, triggered_by, tracking_set_id)
  values (p_business_id, 'running', 'manual', v_target_set_id)
  returning id into v_scan_id;

  -- First-scan side-effect: stamp first_scanned_at + start the 30-day lock.
  select first_scanned_at into v_set_first_scanned_at
  from public.tracking_sets where id = v_target_set_id;

  if v_set_first_scanned_at is null then
    update public.tracking_sets
      set first_scanned_at = now(), locked_until = now() + interval '30 days'
    where id = v_target_set_id;
  end if;

  return query select v_scan_id, true, null::text;
end;
$$;

-- Quota status reporter. Free is still per-set (lifetime); paid is the per-user
-- rolling-30-day bucket, so the p_tracking_set_id arg is ignored for paid users
-- (the same monthly count shows regardless of which set tab is active).
create or replace function public.get_scan_quota_status(
  p_user_id uuid,
  p_tracking_set_id uuid default null
)
returns table(
  tier text,
  daily_limit integer,
  used_in_window integer,
  remaining integer,
  next_reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription_status text;
  v_subscription_tier text;
  v_used integer;
  v_limit integer;
  v_oldest_in_window timestamptz;
  v_effective_tier text;
begin
  select subscription_status, subscription_tier
  into v_subscription_status, v_subscription_tier
  from public.profiles where id = p_user_id;

  if coalesce(v_subscription_status, 'free') <> 'active' then
    if p_tracking_set_id is not null then
      select count(*) into v_used
      from public.scans
      where tracking_set_id = p_tracking_set_id
        and status in ('pending', 'running', 'completed');
    else
      select count(*) into v_used
      from public.scans s
      join public.businesses b on b.id = s.business_id
      where b.user_id = p_user_id
        and s.status in ('pending', 'running', 'completed');
    end if;

    return query select 'free'::text, 1, v_used, greatest(0, 1 - v_used), null::timestamptz;
    return;
  end if;

  v_limit := case
    when v_subscription_tier in ('growth', 'agency') then 40
    else 25
  end;
  v_effective_tier := coalesce(v_subscription_tier, 'starter');

  -- Paid: count the user's scans across all businesses in the rolling 30d window.
  select count(*), min(s.started_at)
  into v_used, v_oldest_in_window
  from public.scans s
  join public.businesses b on b.id = s.business_id
  where b.user_id = p_user_id
    and s.status in ('pending', 'running', 'completed')
    and s.started_at > now() - interval '30 days';

  return query select
    v_effective_tier,
    v_limit,
    v_used,
    greatest(0, v_limit - v_used),
    case
      when v_used >= v_limit and v_oldest_in_window is not null
        then v_oldest_in_window + interval '30 days'
      else null
    end;
end;
$$;

