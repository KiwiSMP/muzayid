// supabase/functions/auction-scheduler/index.ts
// Deploy with: supabase functions deploy auction-scheduler
// Schedule via Supabase Dashboard > Edge Functions > Schedules (every 60 seconds)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (_req) => {
  const results = {
    activated: 0,
    ended: 0,
    errors: [],
  }

  // Activate auctions that have started
  const { error: activateError, count: activated } = await supabase
    .from('auctions')
    .update({ status: 'active' })
    .eq('status', 'draft')
    .lte('start_time', new Date().toISOString())
    .gt('end_time', new Date().toISOString())

  if (activateError) {
    results.errors.push(`Activate error: ${activateError.message}`)
  } else {
    results.activated = activated || 0
  }

  // End auctions that have expired
  const { error: endError, count: ended } = await supabase
    .from('auctions')
    .update({ status: 'ended' })
    .eq('status', 'active')
    .lte('end_time', new Date().toISOString())

  if (endError) {
    results.errors.push(`End error: ${endError.message}`)
  } else {
    results.ended = ended || 0
  }

  console.log('Auction scheduler ran:', results)

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
    status: results.errors.length > 0 ? 500 : 200,
  })
})
