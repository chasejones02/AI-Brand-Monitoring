import { createClient } from '@supabase/supabase-js';

// Service role client — bypasses RLS, backend use only
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
