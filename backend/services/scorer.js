/**
 * Computes the AI Visibility Score (0–100) from scan results.
 *
 * mention_score:  +10 per platform that mentions the business
 * position_score: +5 if rank 1, +3 if rank 2-3, +1 if mentioned at all
 * sentiment_score: +3 positive, +1 neutral, -2 negative
 *
 * Normalized across all queries and platforms.
 */
export function computeScore(results) {
  if (!results || results.length === 0) return 0;

  let total = 0;
  const maxPerResult = 10 + 5 + 3; // max possible per query×platform

  for (const r of results) {
    let score = 0;

    if (r.mentioned) {
      score += 10; // mention score

      // position score
      if (r.position === 1) score += 5;
      else if (r.position <= 3) score += 3;
      else score += 1;

      // sentiment score
      if (r.sentiment === 'positive') score += 3;
      else if (r.sentiment === 'neutral') score += 1;
      else if (r.sentiment === 'negative') score -= 2;
    }

    total += score;
  }

  const maxPossible = results.length * maxPerResult;
  return Math.round((total / maxPossible) * 100);
}
