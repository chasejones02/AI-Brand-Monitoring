import { Router } from 'express';
import { supabase } from '../services/supabase.js';
import { queryOpenAI } from '../services/queryEngine.js';
import { computeScore } from '../services/scorer.js';

const router = Router();

/**
 * POST /api/scan
 * Body: { business_name, email, queries: string[] }
 *
 * 1. Creates/finds user record
 * 2. Creates business + queries in DB
 * 3. Runs scan against ChatGPT for each query
 * 4. Saves results and computed score
 */
router.post('/', async (req, res) => {
  const { business_name, email, queries } = req.body;

  if (!business_name || !email || !Array.isArray(queries) || queries.length === 0) {
    return res.status(400).json({ error: 'business_name, email, and queries are required' });
  }

  try {
    // ── 1. Upsert user via auth (invite flow) ───────────────
    // For MVP: create a magic-link user so they can log in later
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    });

    // If user already exists, look them up
    let userId;
    if (authError?.message?.includes('already been registered')) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();
      userId = existing?.id;
    } else if (authError) {
      throw authError;
    } else {
      userId = authData.user.id;
    }

    if (!userId) {
      return res.status(500).json({ error: 'Could not resolve user ID' });
    }

    // ── 2. Create business record ────────────────────────────
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .insert({ user_id: userId, name: business_name })
      .select()
      .single();

    if (bizError) throw bizError;

    // ── 3. Create query records ──────────────────────────────
    const queryRows = queries.map(q => ({ business_id: business.id, query_text: q }));
    const { data: savedQueries, error: queryError } = await supabase
      .from('queries')
      .insert(queryRows)
      .select();

    if (queryError) throw queryError;

    // ── 4. Create scan job ───────────────────────────────────
    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .insert({ business_id: business.id, status: 'running' })
      .select()
      .single();

    if (scanError) throw scanError;

    // Return immediately so the client isn't waiting
    res.json({ data: { scan_id: scan.id, status: 'running' } });

    // ── 5. Run queries async (fire and forget) ───────────────
    runScan(scan.id, savedQueries, business_name).catch(err => {
      console.error('Scan failed:', err);
      supabase.from('scans').update({ status: 'failed' }).eq('id', scan.id);
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

async function runScan(scanId, queries, businessName) {
  const allResults = [];

  for (const query of queries) {
    try {
      const result = await queryOpenAI(query.query_text, businessName);

      const { data } = await supabase
        .from('scan_results')
        .insert({
          scan_id: scanId,
          query_id: query.id,
          platform: result.platform,
          mentioned: result.mentioned,
          position: result.position,
          sentiment: result.sentiment,
          raw_response: result.rawResponse,
          competitors_mentioned: result.competitors_mentioned,
        })
        .select()
        .single();

      if (data) allResults.push(data);
    } catch (err) {
      console.error(`Query failed for "${query.query_text}":`, err.message);
    }
  }

  // Compute and save final score
  const score = computeScore(allResults);
  await supabase
    .from('scans')
    .update({ status: 'complete', visibility_score: score, completed_at: new Date().toISOString() })
    .eq('id', scanId);

  console.log(`Scan ${scanId} complete. Score: ${score}`);
}

export default router;
