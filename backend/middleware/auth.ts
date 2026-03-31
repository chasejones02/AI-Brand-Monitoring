import { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

// Extend Express Request to carry the authenticated user id
declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

// Requires an active subscription — run after requireAuth
export async function requireSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.userId

  if (!userId) {
    res.status(401).json({ data: null, error: 'Not authenticated' })
    return
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', userId)
    .single()

  if (profile?.subscription_status !== 'active') {
    res.status(403).json({ data: null, error: 'Active subscription required', code: 'subscription_required' })
    return
  }

  next()
}

// Verify the Supabase JWT sent in the Authorization header
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ data: null, error: 'Missing authorization header' })
    return
  }

  const token = authHeader.slice(7)

  // Use the anon key + user JWT to verify identity
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  )

  const { data, error } = await client.auth.getUser(token)

  if (error || !data.user) {
    res.status(401).json({ data: null, error: 'Invalid or expired token' })
    return
  }

  req.userId = data.user.id
  next()
}
