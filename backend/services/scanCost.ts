import type { Platform, UsageMetrics } from './queryEngine.js'

// Per-scan cost telemetry — keep raw counts in the DB; apply prices here.
// Update PRICING when providers change rates; no migration needed.

export type ScanUsage = Partial<Record<Platform, UsageMetrics>>

type ProviderPricing = {
  input_per_1k: number
  output_per_1k: number
  search_per_call: number
}

// USD. Reconciled against provider invoices 2026-06-12. Treat as directional —
// re-check when providers change rates or when real billing diverges.
//   - OpenAI gpt-4.1-mini + web_search (low): $0.40/1M in, $1.60/1M out; tool
//     call calibrated to ~$0.07/scan (5 searches) seen in real OpenAI billing.
//   - Gemini 2.5-flash grounded: $0.30/1M in, $2.50/1M out, $35/1k grounded prompts.
//   - Perplexity sonar: $1/1M in & out; request fee ~$0.012/req (invoice: 104
//     req = $1.25) — NOT $0.001; the prior value under-reported cost ~12x.
//   - Anthropic claude-haiku-4-5 + web_search: $1/1M in, $5/1M out, $10/1k searches.
// NOTE: the per-result gpt-4o-mini analyzeMention pass (~$0.006/scan) is not
// captured here — its usage isn't threaded back into ScanUsage.
const PRICING: Record<Platform, ProviderPricing> = {
  openai:     { input_per_1k: 0.0004, output_per_1k: 0.0016, search_per_call: 0.0125 },
  gemini:     { input_per_1k: 0.0003, output_per_1k: 0.0025, search_per_call: 0.035 },
  perplexity: { input_per_1k: 0.001, output_per_1k: 0.001, search_per_call: 0.012 },
  anthropic:  { input_per_1k: 0.001, output_per_1k: 0.005, search_per_call: 0.010 },
}

export function estimatePlatformCost(platform: Platform, usage: UsageMetrics): number {
  const p = PRICING[platform]
  if (!p) return 0
  return (
    (usage.input_tokens / 1000) * p.input_per_1k +
    (usage.output_tokens / 1000) * p.output_per_1k +
    usage.search_calls * p.search_per_call
  )
}

export function estimateScanCost(scanUsage: ScanUsage): { total_usd: number; per_platform: Partial<Record<Platform, number>> } {
  const per_platform: Partial<Record<Platform, number>> = {}
  let total_usd = 0
  for (const [platform, usage] of Object.entries(scanUsage) as [Platform, UsageMetrics][]) {
    if (!usage) continue
    const cost = estimatePlatformCost(platform, usage)
    per_platform[platform] = cost
    total_usd += cost
  }
  return { total_usd, per_platform }
}

export function formatCostLine(scanUsage: ScanUsage): string {
  const { total_usd, per_platform } = estimateScanCost(scanUsage)
  const parts = (Object.entries(per_platform) as [Platform, number][])
    .map(([p, c]) => `${p}=$${c.toFixed(4)}`)
    .join(' ')
  return `~$${total_usd.toFixed(4)} (${parts})`
}
