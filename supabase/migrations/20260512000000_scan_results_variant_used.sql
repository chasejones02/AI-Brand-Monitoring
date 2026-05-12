-- Add variant_used to scan_results so we can surface the exact business
-- name variant the AI used (e.g. "Downtown Dental" vs "Downtown Dental & Spa").
-- Historical rows will be NULL — that's fine, we only show it when present.

ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS variant_used TEXT;
