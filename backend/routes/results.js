import { Router } from 'express';
import { supabase } from '../services/supabase.js';

const router = Router();

/**
 * GET /api/results/:scanId
 * Returns the scan status, score, and per-query results.
 * Used by the frontend to poll until the scan is complete.
 */
router.get('/:scanId', async (req, res) => {
  const { scanId } = req.params;

  const { data: scan, error: scanError } = await supabase
    .from('scans')
    .select('id, status, visibility_score, created_at, completed_at')
    .eq('id', scanId)
    .single();

  if (scanError || !scan) {
    return res.status(404).json({ error: 'Scan not found' });
  }

  if (scan.status !== 'complete') {
    return res.json({ data: { scan } });
  }

  const { data: results, error: resultsError } = await supabase
    .from('scan_results')
    .select(`
      id,
      platform,
      mentioned,
      position,
      sentiment,
      competitors_mentioned,
      queries ( query_text )
    `)
    .eq('scan_id', scanId);

  if (resultsError) {
    return res.status(500).json({ error: resultsError.message });
  }

  res.json({ data: { scan, results } });
});

export default router;
