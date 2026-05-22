-- Add citations to scan_results so we can surface the source URLs the AI
-- platform actually grounded its answer on (Gemini's googleSearch tool today;
-- ChatGPT and Claude web_search to come). Stored as JSONB array of
-- { uri, title } objects. NULL for historical rows and ungrounded platforms.

ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS citations JSONB;
