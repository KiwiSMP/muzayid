import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// WhatsApp via Twilio or similar service
// Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in env vars
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
const FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'

async function sendWhatsApp(to: string, message: string) {
  if (!TWILIO_SID || !TWILIO_TOKEN) {
    console.log('[WhatsApp] Twilio not configured. Message would be sent to:', to, '\n', message)
    return { success: false, reason: 'Twilio not configured' }
  }

  const formattedTo = to.startsWith('+') ? `whatsapp:${to}` : `whatsapp:+2${to.replace(/^0/, '')}`

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: FROM, To: formattedTo, Body: message }),
      }
    )
    const data = await response.json()
    if (!response.ok) {
      console.error('[WhatsApp] Send error:', data)
      return { success: false, reason: data.message }
    }
    return { success: true, sid: data.sid }
  } catch (err) {
    console.error('[WhatsApp] Network error:', err)
    return { success: false, reason: 'Network error' }
  }
}

// POST /api/whatsapp - Send alert to users who opted in
// Body: { type: 'new_car' | 'auction_start', data: {...} }
export async function POST(req: NextRequest) {
  // Verify this is an internal call
  const authHeader = req.headers.get('x-internal-secret')
  if (authHeader !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { type, data } = await req.json()

  const supabase = createClient()

  // Get all users with WhatsApp alerts enabled
  const { data: users, error } = await supabase
    .from('users')
    .select('phone_number, full_name, preferred_lang')
    .eq('whatsapp_alerts', true)
    .not('phone_number', 'is', null)

  if (error || !users) {
    return NextResponse.json({ error: 'Failed to get users' }, { status: 500 })
  }

  let message_en = ''
  let message_ar = ''

  switch (type) {
    case 'new_car':
      message_en = `🚗 *New Vehicle Listed on Muzayid!*\n\n*${data.year} ${data.make} ${data.model}*\nStarting bid: ${data.starting_price?.toLocaleString()} EGP\nDamage: ${data.damage_type || 'N/A'}\n\n👉 View & Bid: ${process.env.NEXT_PUBLIC_SITE_URL}/auctions/${data.auction_id}`
      message_ar = `🚗 *سيارة جديدة مدرجة على مزايد!*\n\n*${data.year} ${data.make} ${data.model}*\nسعر البداية: ${data.starting_price?.toLocaleString()} ج.م\nالضرر: ${data.damage_type || 'غير محدد'}\n\n👉 عرض والمزايدة: ${process.env.NEXT_PUBLIC_SITE_URL}/auctions/${data.auction_id}`
      break
    case 'auction_start':
      message_en = `⏰ *Auction Starting Soon!*\n\n*${data.year} ${data.make} ${data.model}*\nStarts in 1 hour!\nCurrent bid: ${data.current_bid?.toLocaleString()} EGP\n\n👉 Bid now: ${process.env.NEXT_PUBLIC_SITE_URL}/auctions/${data.auction_id}`
      message_ar = `⏰ *المزاد يبدأ قريباً!*\n\n*${data.year} ${data.make} ${data.model}*\nيبدأ خلال ساعة!\nالمزايدة الحالية: ${data.current_bid?.toLocaleString()} ج.م\n\n👉 زايد الآن: ${process.env.NEXT_PUBLIC_SITE_URL}/auctions/${data.auction_id}`
      break
    default:
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  }

  const results = await Promise.allSettled(
    users.map(user => {
      const msg = user.preferred_lang === 'ar' ? message_ar : message_en
      return sendWhatsApp(user.phone_number!, msg)
    })
  )

  const sent = results.filter(r => r.status === 'fulfilled' && (r.value as { success: boolean }).success).length

  // Also create in-app notifications
  const notifInserts = users.map((user, i) => ({
    user_id: (user as { id?: string }).id,
    type,
    title: type === 'new_car' ? 'New Vehicle Listed' : 'Auction Starting Soon',
    body: type === 'new_car'
      ? `${data.year} ${data.make} ${data.model} — Starting ${data.starting_price?.toLocaleString()} EGP`
      : `${data.year} ${data.make} ${data.model} — Starts in 1 hour!`,
    related_auction_id: data.auction_id,
    read: false,
  })).filter(n => n.user_id)

  if (notifInserts.length > 0) {
    await supabase.from('notifications').insert(notifInserts)
  }

  return NextResponse.json({ success: true, sent, total: users.length })
}
