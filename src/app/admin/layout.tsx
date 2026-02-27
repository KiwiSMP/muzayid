'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Users, Car, Radio, Gavel,
  DollarSign, LogOut, ExternalLink, Loader2, ShieldCheck
} from 'lucide-react'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/approvals', label: 'KYC Approvals', icon: Users },
  { href: '/admin/deposits', label: 'Deposits', icon: DollarSign },
  { href: '/admin/inventory', label: 'Inventory', icon: Car },
  { href: '/admin/live-control', label: 'Live Controller', icon: Radio },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.replace('/auth/login?redirect=/admin'); return }
      const { data: profile } = await supabase
        .from('users').select('is_admin, full_name').eq('id', user.id).single()
      if (!profile || !profile.is_admin) { window.location.replace('/'); return }
      setAdminName(profile.full_name)
      setAdminEmail(user.email || '')
      setIsAdmin(true)
      setChecking(false)
    }
    check()
  }, [])

  if (checking) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    </div>
  )

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 flex flex-col fixed inset-y-0 left-0 z-40">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Gavel className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">Muzayid Admin</p>
              <p className="text-slate-500 text-xs">Control Panel</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/admin' && pathname.startsWith(href))
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User + actions */}
        <div className="px-3 py-4 border-t border-slate-800">
          <div className="px-3 py-2 mb-2">
            <p className="text-slate-200 text-sm font-medium truncate">{adminName}</p>
            <p className="text-slate-500 text-xs truncate">{adminEmail}</p>
          </div>
          <Link href="/" target="_blank"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors">
            <ExternalLink className="w-4 h-4" />View Live Site
          </Link>
          <button
            onClick={async () => { const s = createClient(); await s.auth.signOut(); window.location.replace('/auth/login') }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors mt-0.5">
            <LogOut className="w-4 h-4" />Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 min-h-screen bg-slate-50">
        {children}
      </main>
    </div>
  )
}
