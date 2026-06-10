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
