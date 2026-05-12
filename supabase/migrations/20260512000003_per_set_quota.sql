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
