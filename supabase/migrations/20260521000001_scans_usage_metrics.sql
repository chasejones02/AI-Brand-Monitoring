-- Add per-scan usage metrics so we can model real $/scan after enabling live
-- web search on OpenAI/Gemini. Shape:
--   { "openai":     { "input_tokens": n, "output_tokens": n, "search_calls": n },
--     "gemini":     { ... },
--     "perplexity": { ... },
--     "anthropic":  { ... } }
-- Stored as raw counts (not USD) so pricing-table changes don't require a
-- backfill — apply pricing in code when displaying.

ALTER TABLE scans ADD COLUMN IF NOT EXISTS usage_metrics JSONB;
