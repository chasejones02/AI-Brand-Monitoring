-- Store AI-generated recommendations on the scan row.
-- Always 7 generated; tier-gating (1/3/7 visible) is enforced at the API layer.
-- Historical scans will have NULL — show nothing rather than error.

ALTER TABLE scans ADD COLUMN IF NOT EXISTS recommendations JSONB;
