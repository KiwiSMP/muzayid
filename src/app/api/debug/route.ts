import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  // Method 1: request.cookies (what middleware uses)
  const requestCookies = request.cookies.getAll()

  // Method 2: next/headers cookies() (what Server Components use)
  const headerCookies = cookies().getAll()

  let userFromRequest = null
  let userFromHeaders = null

  try {
    const supabase1 = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return requestCookies }, setAll() {} } }
    )
    const { data } = await supabase1.auth.getUser()
    userFromRequest = data.user?.email || 'null'
  } catch (e: unknown) {
    userFromRequest = `ERROR: ${e instanceof Error ? e.message : 'unknown'}`
  }

  try {
    const supabase2 = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return headerCookies }, setAll() {} } }
    )
    const { data } = await supabase2.auth.getUser()
    userFromHeaders = data.user?.email || 'null'
  } catch (e: unknown) {
    userFromHeaders = `ERROR: ${e instanceof Error ? e.message : 'unknown'}`
  }

  return NextResponse.json({
    requestCookieCount: requestCookies.length,
    headerCookieCount: headerCookies.length,
    requestCookieNames: requestCookies.map(c => c.name),
    headerCookieNames: headerCookies.map(c => c.name),
    userFromRequest,
    userFromHeaders,
    match: userFromRequest === userFromHeaders,
  })
}
