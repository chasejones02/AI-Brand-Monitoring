import type { Platform, UsageMetrics } from './queryEngine.js'

// Per-scan cost telemetry — keep raw counts in the DB; apply prices here.
// Update PRICING when providers change rates; no migration needed.

export type ScanUsage = Partial<Record<Platform, UsageMetrics>>

type ProviderPricing = {
  input_per_1k: number
  output_per_1k: number
  search_per_call: number
}

// USD. Verify against actual provider invoices before any pricing decision —
// early-2026 testing showed gpt-5.5 + web_search ran ~$0.84/scan vs our
// initial estimate of ~$0.15, so treat these numbers as directional until
// reconciled against the OpenAI/Google billing dashboards.
//   - OpenAI gpt-4.1-mini + web_search: token prices + ~$10 per 1k tool calls
//   - Gemini 2.5-flash grounded: $35 per 1k grounded prompts + token prices
//   - Perplexity sonar: search bundled into request pricing (~$0.001/req)
//   - Anthropic claude-haiku-4-5: token-only (no web search yet)
const PRICING: Record<Platform, ProviderPricing> = {
  openai:     { input_per_1k: 0.0004, output_per_1k: 0.0016, search_per_call: 0.010 },
  gemini:     { input_per_1k: 0.000075, output_per_1k: 0.0003, search_per_call: 0.035 },
  perplexity: { input_per_1k: 0.001, output_per_1k: 0.001, search_per_call: 0.001 },
  anthropic:  { input_per_1k: 0.0008, output_per_1k: 0.004, search_per_call: 0 },
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
