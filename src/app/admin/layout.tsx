'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Users, Car, Radio, Gavel,
  DollarSign, LogOut, ExternalLink, Loader2, ShieldCheck,
  BarChart2, BookOpen, ChevronRight, Bell, Menu, X,
  Settings, Package, FileText
} from 'lucide-react'

interface AdminBadges {
  pendingKyc: number
  pendingDeposits: number
  liveAuctions: number
  pendingVehicles: number
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [badges, setBadges] = useState<AdminBadges>({ pendingKyc: 0, pendingDeposits: 0, liveAuctions: 0, pendingVehicles: 0 })
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const loadBadges = useCallback(async () => {
    const supabase = createClient()
    const [usersRes, txRes, auctionsRes, vehiclesRes] = await Promise.all([
      supabase.from('users').select('id, is_verified, national_id_url'),
      supabase.from('transactions').select('id, status').eq('type', 'deposit').eq('status', 'pending'),
      supabase.from('auctions').select('id, status').eq('status', 'active'),
      supabase.from('vehicles').select('id, status').eq('status', 'pending'),
    ])
    const users = usersRes.data || []
    setBadges({
      pendingKyc: users.filter((u: { is_verified: boolean; national_id_url: string | null }) => !u.is_verified && u.national_id_url).length,
      pendingDeposits: (txRes.data || []).length,
      liveAuctions: (auctionsRes.data || []).length,
      pendingVehicles: (vehiclesRes.data || []).length,
    })
  }, [])

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.replace('/auth/login?redirect=/admin'); return }
      const { data: profile } = await supabase
        .from('users').select('is_admin, full_name').eq('id', user.id).single()
      if (!profile?.is_admin) { window.location.replace('/'); return }
      setAdminName(profile.full_name)
      setAdminEmail(user.email || '')
      setIsAdmin(true)
      setChecking(false)
      loadBadges()
    }
    check()
    const interval = setInterval(loadBadges, 30000)
    return () => clearInterval(interval)
  }, [loadBadges])

  const NAV_GROUPS = [
    {
      label: 'Operations',
      items: [
        { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
        { href: '/admin/approvals', label: 'KYC Approvals', icon: Users, badge: badges.pendingKyc },
        { href: '/admin/deposits', label: 'Deposits', icon: DollarSign, badge: badges.pendingDeposits },
        { href: '/admin/inventory', label: 'Inventory', icon: Car, badge: badges.pendingVehicles },
      ],
    },
    {
      label: 'Auctions',
      items: [
        { href: '/admin/live-control', label: 'Live Controller', icon: Radio, badge: badges.liveAuctions, live: badges.liveAuctions > 0 },
        { href: '/admin/catalog', label: 'Catalog Auctions', icon: BookOpen },
        { href: '/admin/auctions/new', label: 'New Auction', icon: Gavel },
      ],
    },
    {
      label: 'Intelligence',
      items: [
        { href: '/admin/metrics', label: 'Business Metrics', icon: BarChart2 },
        { href: '/admin/users', label: 'All Users', icon: Users },
      ],
    },
  ]

  if (checking) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-900/50">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
          <span className="text-slate-500 text-sm">Verifying admin access...</span>
        </div>
      </div>
    </div>
  )

  if (!isAdmin) return null

  const totalAlerts = badges.pendingKyc + badges.pendingDeposits + badges.pendingVehicles

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-slate-900 flex flex-col fixed inset-y-0 left-0 z-40 transition-all duration-200`}>
        
        {/* Logo + toggle */}
        <div className="px-4 py-4 border-b border-slate-800 flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm shadow-indigo-900">
                <Gavel className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-sm leading-tight">Muzayid</p>
                <p className="text-indigo-400 text-[10px] font-semibold tracking-wide uppercase">Admin Panel</p>
              </div>
            </div>
          )}
          {!sidebarOpen && (
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mx-auto">
              <Gavel className="w-4 h-4 text-white" />
            </div>
          )}
          {sidebarOpen && (
            <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Alert banner */}
        {sidebarOpen && totalAlerts > 0 && (
          <div className="mx-3 mt-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <p className="text-amber-300 text-xs font-semibold">{totalAlerts} item{totalAlerts !== 1 ? 's' : ''} need attention</p>
            </div>
          </div>
        )}

        {/* Nav groups */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-4 overflow-y-auto">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              {sidebarOpen && (
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-3 mb-1.5">{group.label}</p>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map(({ href, label, icon: Icon, badge, exact, live }) => {
                  const active = exact ? pathname === href : (pathname === href || pathname.startsWith(href + '/'))
                  return (
                    <Link key={href} href={href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        active
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/50'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                      }`}
                      title={!sidebarOpen ? label : undefined}>
                      <div className="relative flex-shrink-0">
                        <Icon className="w-4 h-4" />
                        {live && !active && (
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                        )}
                      </div>
                      {sidebarOpen && (
                        <>
                          <span className="flex-1 truncate">{label}</span>
                          {badge != null && badge > 0 && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${active ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}`}>
                              {badge > 99 ? '99+' : badge}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className={`px-3 py-4 border-t border-slate-800 ${sidebarOpen ? '' : 'flex flex-col items-center gap-2'}`}>
          {sidebarOpen ? (
            <>
              {/* Admin info */}
              <div className="px-3 py-2.5 bg-slate-800 rounded-xl mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                    {adminName?.[0]?.toUpperCase() || 'A'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-200 text-xs font-semibold truncate">{adminName}</p>
                    <p className="text-slate-500 text-[10px] truncate">{adminEmail}</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <Link href="/" target="_blank"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" />View Site
                </Link>
                <button
                  onClick={async () => { const s = createClient(); await s.auth.signOut({ scope: 'global' }); window.location.replace('/auth/login') }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                  <LogOut className="w-3.5 h-3.5" />Sign Out
                </button>
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors" title="Expand sidebar">
                <Menu className="w-4 h-4" />
              </button>
              <Link href="/" target="_blank" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors" title="View site">
                <ExternalLink className="w-4 h-4" />
              </Link>
              <button
                onClick={async () => { const s = createClient(); await s.auth.signOut({ scope: 'global' }); window.location.replace('/auth/login') }}
                className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Sign out">
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className={`flex-1 ${sidebarOpen ? 'ml-64' : 'ml-16'} min-h-screen bg-slate-50 transition-all duration-200`}>
        {/* Top bar with breadcrumb */}
        <div className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors mr-1">
              <Menu className="w-4 h-4" />
            </button>
          )}
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <span className="text-slate-500 text-sm font-medium capitalize">
            {pathname.split('/').filter(Boolean).join(' › ') || 'admin'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {badges.liveAuctions > 0 && (
              <Link href="/admin/live-control" className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-colors">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                {badges.liveAuctions} Live
              </Link>
            )}
            {totalAlerts > 0 && (
              <span className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold px-3 py-1.5 rounded-full">
                <Bell className="w-3 h-3" />{totalAlerts} pending
              </span>
            )}
          </div>
        </div>
        {children}
      </main>
    </div>
  )
}
