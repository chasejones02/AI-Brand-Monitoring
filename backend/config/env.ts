import 'dotenv/config'
import { z } from 'zod'

// Reject placeholder values from .env.example (anything containing REPLACE_ME,
// "your-...-here", "...", or starting with the literal prefix shown in the
// template). isRealKey in queryEngine.ts uses similar logic at request time.
const realSecret = (label: string, prefixHint?: string) =>
  z
    .string({ required_error: `${label} is required` })
    .min(20, `${label} looks too short to be a real value`)
    .refine(
      (v) =>
        !v.includes('REPLACE') &&
        !v.includes('your-') &&
        !v.endsWith('...') &&
        v !== prefixHint,
      `${label} still looks like the placeholder from .env.example`
    )

const aiKey = (label: string) =>
  z
    .string()
    .min(20, `${label} looks too short to be a real value`)
    .refine(
      (v) => !v.includes('REPLACE') && !v.endsWith('...'),
      `${label} still looks like the placeholder from .env.example`
    )
    .optional()

const envSchema = z
  .object({
    // Server
    PORT: z.coerce.number().int().positive().default(3001),
    FRONTEND_URL: z.string().url().default('http://localhost:5173'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    // Supabase
    SUPABASE_URL: z
      .string()
      .url('SUPABASE_URL must be a valid URL')
      .refine(
        (v) => !v.includes('your-project-id'),
        'SUPABASE_URL still looks like the placeholder from .env.example'
      ),
    SUPABASE_ANON_KEY: realSecret('SUPABASE_ANON_KEY'),
    SUPABASE_SERVICE_ROLE_KEY: realSecret('SUPABASE_SERVICE_ROLE_KEY'),

    // Stripe
    STRIPE_SECRET_KEY: realSecret('STRIPE_SECRET_KEY').refine(
      (v) => v.startsWith('sk_test_') || v.startsWith('sk_live_'),
      'STRIPE_SECRET_KEY must start with sk_test_ or sk_live_'
    ),
    STRIPE_WEBHOOK_SECRET: realSecret('STRIPE_WEBHOOK_SECRET').refine(
      (v) => v.startsWith('whsec_'),
      'STRIPE_WEBHOOK_SECRET must start with whsec_'
    ),
    STRIPE_PRICE_STARTER: realSecret('STRIPE_PRICE_STARTER').refine(
      (v) => v.startsWith('price_'),
      'STRIPE_PRICE_STARTER must start with price_'
    ),
    STRIPE_PRICE_STARTER_ANNUAL: realSecret('STRIPE_PRICE_STARTER_ANNUAL').refine(
      (v) => v.startsWith('price_'),
      'STRIPE_PRICE_STARTER_ANNUAL must start with price_'
    ),
    STRIPE_PRICE_GROWTH: realSecret('STRIPE_PRICE_GROWTH').refine(
      (v) => v.startsWith('price_'),
      'STRIPE_PRICE_GROWTH must start with price_'
    ),
    STRIPE_PRICE_GROWTH_ANNUAL: realSecret('STRIPE_PRICE_GROWTH_ANNUAL').refine(
      (v) => v.startsWith('price_'),
      'STRIPE_PRICE_GROWTH_ANNUAL must start with price_'
    ),

    // AI providers — each is independently optional; refinement below requires
    // at least one to be configured so scans aren't dead on arrival.
    OPENAI_API_KEY: aiKey('OPENAI_API_KEY'),
    ANTHROPIC_API_KEY: aiKey('ANTHROPIC_API_KEY'),
    PERPLEXITY_API_KEY: aiKey('PERPLEXITY_API_KEY'),
    GEMINI_API_KEY: aiKey('GEMINI_API_KEY'),
  })
  .refine(
    (env) =>
      !!(env.OPENAI_API_KEY || env.ANTHROPIC_API_KEY || env.PERPLEXITY_API_KEY || env.GEMINI_API_KEY),
    {
      message:
        'At least one AI provider key must be configured (OPENAI_API_KEY, ANTHROPIC_API_KEY, PERPLEXITY_API_KEY, or GEMINI_API_KEY)',
      path: ['AI_PROVIDER_KEYS'],
    }
  )

export type Env = z.infer<typeof envSchema>

function validate(): Env {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('\nInvalid environment configuration. Fix these issues in backend/.env:\n')
    const flat = result.error.flatten().fieldErrors
    for (const [key, messages] of Object.entries(flat)) {
      if (!messages) continue
      for (const msg of messages) {
        console.error(`  - ${key}: ${msg}`)
      }
    }
    console.error('\nSee backend/.env.example for the full list of required variables.\n')
    process.exit(1)
  }

  if (result.data.NODE_ENV === 'production') {
    if (result.data.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
      console.warn('WARNING: NODE_ENV=production but STRIPE_SECRET_KEY is a test key (sk_test_)')
    }
    if (result.data.FRONTEND_URL.includes('localhost')) {
      console.warn('WARNING: NODE_ENV=production but FRONTEND_URL points to localhost')
    }
  }

  if (!result.data.OPENAI_API_KEY) {
    console.warn(
      'WARNING: OPENAI_API_KEY is not set. Mention-analysis and recommendations will fall back to lower-quality logic.'
    )
  }
  if (!result.data.PERPLEXITY_API_KEY) {
    console.warn(
      'WARNING: PERPLEXITY_API_KEY is not set. Free-tier scans rely on Perplexity for web-grounded results.'
    )
  }

  return result.data
}

// Runs at module-init time so that importing this file anywhere in the
// process guarantees env has been validated. server.ts imports it first.
export const env: Env = validate()
