import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)

  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/onboarding/kyc'

  const supabase = createClient()

  // PKCE flow
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
    console.error('Code exchange error:', error.message)
  }

  // Token hash flow (default Supabase emails)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'email' | 'recovery' | 'invite' | 'email_change',
    })
    if (!error) return NextResponse.redirect(`${origin}${next}`)
    console.error('Token hash error:', error.message)
  }

  return NextResponse.redirect(`${origin}/auth/login?error=Email+confirmation+failed.+Please+try+registering+again.`)
}
