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
