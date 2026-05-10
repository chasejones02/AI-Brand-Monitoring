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
