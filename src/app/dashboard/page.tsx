import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (!user) {
    redirect(`/auth/login?reason=no_user&error=${encodeURIComponent(userError?.message || 'none')}`)
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect(`/auth/login?reason=no_profile&uid=${user.id}&error=${encodeURIComponent(profileError?.message || 'none')}`)
  }

  return (
    <div style={{ padding: 40, fontFamily: 'monospace' }}>
      <h1>✅ Dashboard works!</h1>
      <p><b>User:</b> {user.email}</p>
      <p><b>User ID:</b> {user.id}</p>
      <p><b>Profile name:</b> {profile.full_name}</p>
      <p><b>Is admin:</b> {String(profile.is_admin)}</p>
    </div>
  )
}
