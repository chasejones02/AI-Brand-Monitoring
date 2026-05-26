import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data: scans, error } = await supabase
    .from('scans')
    .select('id, status, triggered_by, started_at, completed_at, business_id, tracking_set_id')
    .order('started_at', { ascending: false })
    .limit(15)

  if (error) {
    console.error('Query failed:', error)
    return
  }

  console.log('\nLast 15 scans:')
  console.log('─'.repeat(120))
  for (const s of scans ?? []) {
    const ageMin = Math.round((Date.now() - new Date(s.started_at).getTime()) / 60000)
    console.log(
      `${s.id.slice(0, 8)} | ${s.status.padEnd(10)} | age=${String(ageMin).padStart(4)}min | started=${s.started_at} | completed=${s.completed_at ?? '—'}`
    )
  }

  const stuck = (scans ?? []).filter(s => s.status === 'pending' || s.status === 'running')
  if (stuck.length > 0) {
    console.log(`\n${stuck.length} scan(s) currently in pending/running state.`)
  } else {
    console.log('\nNo stuck scans.')
  }
}

main().catch(console.error)
