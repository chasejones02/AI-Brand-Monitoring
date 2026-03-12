-- ─────────────────────────────────────────────
--  Visaion — Initial Schema
--  Run this in Supabase: SQL Editor → New query
-- ─────────────────────────────────────────────


-- ── 1. Profiles ──────────────────────────────
-- Mirrors auth.users; auto-created on signup via trigger
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email      TEXT,
  full_name  TEXT,
  plan       TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'growth', 'agency')),
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);


-- ── 2. Auto-create profile on signup ─────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ── 3. Businesses ─────────────────────────────
CREATE TABLE IF NOT EXISTS businesses (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own businesses"
  ON businesses FOR ALL
  USING (auth.uid() = user_id);


-- ── 4. Queries ────────────────────────────────
-- Target search phrases per business
CREATE TABLE IF NOT EXISTS queries (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id  UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  query_text   TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own queries"
  ON queries FOR ALL
  USING (
    auth.uid() = (
      SELECT user_id FROM businesses WHERE id = queries.business_id
    )
  );


-- ── 5. Scans ──────────────────────────────────
-- One scan = one full run across all platforms for all queries
CREATE TABLE IF NOT EXISTS scans (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id      UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  visibility_score INTEGER CHECK (visibility_score BETWEEN 0 AND 100),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own scans"
  ON scans FOR SELECT
  USING (
    auth.uid() = (
      SELECT user_id FROM businesses WHERE id = scans.business_id
    )
  );


-- ── 6. Scan Results ───────────────────────────
-- One row per query × platform
CREATE TABLE IF NOT EXISTS scan_results (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id              UUID REFERENCES scans(id) ON DELETE CASCADE NOT NULL,
  query_id             UUID REFERENCES queries(id) ON DELETE CASCADE NOT NULL,
  platform             TEXT NOT NULL CHECK (platform IN ('chatgpt', 'claude', 'perplexity', 'gemini')),
  mentioned            BOOLEAN NOT NULL DEFAULT FALSE,
  position             INTEGER,          -- rank if mentioned (1 = first)
  sentiment            TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  raw_response         TEXT,             -- full AI response stored for debugging
  competitors_mentioned TEXT[],          -- competitor names extracted from response
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE scan_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own scan results"
  ON scan_results FOR SELECT
  USING (
    auth.uid() = (
      SELECT b.user_id FROM scans s
      JOIN businesses b ON b.id = s.business_id
      WHERE s.id = scan_results.scan_id
    )
  );


-- ── Indexes ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_businesses_user_id   ON businesses(user_id);
CREATE INDEX IF NOT EXISTS idx_queries_business_id  ON queries(business_id);
CREATE INDEX IF NOT EXISTS idx_scans_business_id    ON scans(business_id);
CREATE INDEX IF NOT EXISTS idx_scan_results_scan_id ON scan_results(scan_id);
