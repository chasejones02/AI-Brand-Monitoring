-- Track Stripe webhook events we have already applied so retries are no-ops.
-- Stripe delivers events at-least-once; the unique event_id PK is our dedup key.
create table if not exists public.processed_stripe_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.processed_stripe_events enable row level security;
-- No policies: only the service role (backend) reads or writes this table.
