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
