'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Users, Car, Gavel, DollarSign, TrendingUp,
  AlertCircle, CheckCircle2, Clock, ArrowRight, Radio,
  Plus, Activity, ChevronRight, Zap, BarChart2, BookOpen,
  RefreshCw, Eye, Package
} from 'lucide-react'

interface Stats {
  activeBidders: number
  pendingKyc: number
  pendingDeposits: number
  liveAuctions: number
  carsAwaitingAuction: number
  totalDepositVolume: number
  totalUsers: number
  newUsersToday: number
  totalBidsToday: number
  gmv: number
}

interface FeedItem {
  id: string
  type: 'bid' | 'deposit' | 'registration' | 'kyc' | 'auction'
  label: string
  sub: string
  time: string
  urgent?: boolean
}

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M EGP`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K EGP`
  return n.toLocaleString('en-EG') + ' EGP'
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function StatCard({ label, value, sub, icon: Icon, color, href, badge, pulse }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: string; href?: string; badge?: number; pulse?: boolean
}) {
  const content = (
    <div className={`bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group relative overflow-hidden ${badge && badge > 0 ? 'border-red-200' : 'border-slate-200'}`}>
      {pulse && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      )}
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-sm ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {badge != null && badge > 0 && (
          <span className="bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">
            {badge}
          </span>
        )}
        {pulse && badge == null && (
          <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
        )}
      </div>
      <p className="text-2xl font-black text-slate-900 mb-0.5">{value}</p>
      <p className="text-slate-500 text-sm font-medium">{label}</p>
      {sub && <p className="text-slate-400 text-xs mt-0.5">{sub}</p>}
      {href && (
        <div className="flex items-center gap-1 text-indigo-600 text-xs font-semibold mt-3 group-hover:gap-2 transition-all">
          Manage <ArrowRight className="w-3 h-3" />
        </div>
      )}
    </div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

const FEED_ICONS: Record<string, React.ElementType> = {
  bid: TrendingUp, deposit: DollarSign, registration: Users, kyc: CheckCircle2, auction: Radio
}
const FEED_COLORS: Record<string, string> = {
  bid: 'bg-purple-100 text-purple-600',
  deposit: 'bg-emerald-100 text-emerald-600',
  registration: 'bg-blue-100 text-blue-600',
  kyc: 'bg-amber-100 text-amber-600',
  auction: 'bg-red-100 text-red-600',
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    activeBidders: 0, pendingKyc: 0, pendingDeposits: 0,
    liveAuctions: 0, carsAwaitingAuction: 0, totalDepositVolume: 0,
    totalUsers: 0, newUsersToday: 0, totalBidsToday: 0, gmv: 0,
  })
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const load = useCallback(async () => {
    const supabase = createClient()
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

    const [usersRes, txRes, auctionsRes, vehiclesRes, bidsRes] = await Promise.all([
      supabase.from('users').select('id, is_verified, national_id_url, created_at, full_name, bidding_tier').order('created_at', { ascending: false }),
      supabase.from('transactions').select('id, amount, status, type, created_at, users(full_name)').eq('type', 'deposit').order('created_at', { ascending: false }).limit(20),
      supabase.from('auctions').select('id, status, vehicle_id, current_highest_bid, highest_bidder_id').order('created_at', { ascending: false }),
      supabase.from('vehicles').select('id, status'),
      supabase.from('bids').select('id, amount, created_at, users(full_name)').order('created_at', { ascending: false }).limit(10),
    ])

    const users = usersRes.data || []
    const transactions = txRes.data || []
    const auctions = auctionsRes.data || []
    const vehicles = vehiclesRes.data || []
    const bids = bidsRes.data || []

    const todayISO = todayStart.toISOString()
    const auctionedIds = new Set(auctions.map((a: { vehicle_id: string }) => a.vehicle_id))
    const approvedDeposits = transactions.filter((t: { status: string }) => t.status === 'completed')
    const soldAuctions = auctions.filter((a: { status: string; highest_bidder_id: string | null }) => ['ended', 'settled'].includes(a.status) && a.highest_bidder_id)

    setStats({
      activeBidders: users.filter((u: { bidding_tier: number }) => u.bidding_tier > 0).length,
      pendingKyc: users.filter((u: { is_verified: boolean; national_id_url: string | null }) => !u.is_verified && u.national_id_url).length,
      pendingDeposits: transactions.filter((t: { status: string }) => t.status === 'pending').length,
      liveAuctions: auctions.filter((a: { status: string }) => a.status === 'active').length,
      carsAwaitingAuction: vehicles.filter((v: { id: string; status: string }) => v.status === 'approved' && !auctionedIds.has(v.id)).length,
      totalDepositVolume: approvedDeposits.reduce((s: number, t: { amount: number }) => s + t.amount, 0),
      totalUsers: users.length,
      newUsersToday: users.filter((u: { created_at: string }) => u.created_at >= todayISO).length,
      totalBidsToday: bids.filter((b: { created_at: string }) => b.created_at >= todayISO).length,
      gmv: soldAuctions.reduce((s: number, a: { current_highest_bid: number }) => s + (a.current_highest_bid || 0), 0),
    })

    // Build feed
    function getName(rel: unknown): string {
      if (!rel) return 'User'
      if (Array.isArray(rel)) return (rel[0] as { full_name?: string })?.full_name || 'User'
      return (rel as { full_name?: string }).full_name || 'User'
    }

    const items: FeedItem[] = []
    users.slice(0, 4).forEach((u: { id: string; full_name: string; created_at: string; national_id_url: string | null; is_verified: boolean }) => items.push({
      id: `u-${u.id}`, type: u.national_id_url && !u.is_verified ? 'kyc' : 'registration',
      label: `${u.full_name} ${u.national_id_url && !u.is_verified ? 'submitted KYC' : 'registered'}`,
      sub: u.national_id_url && !u.is_verified ? 'Awaiting verification' : 'New account',
      time: u.created_at, urgent: !!(u.national_id_url && !u.is_verified),
    }))
    transactions.slice(0, 4).forEach((t: { id: string; users: unknown; amount: number; status: string; created_at: string }) => items.push({
      id: `t-${t.id}`, type: 'deposit',
      label: `${getName(t.users)} deposited ${formatCurrency(t.amount)}`,
      sub: t.status === 'pending' ? 'Awaiting approval' : t.status === 'completed' ? 'Approved ✓' : 'Rejected',
      time: t.created_at, urgent: t.status === 'pending',
    }))
    bids.slice(0, 4).forEach((b: { id: string; users: unknown; amount: number; created_at: string }) => items.push({
      id: `b-${b.id}`, type: 'bid',
      label: `${getName(b.users)} bid ${formatCurrency(b.amount)}`,
      sub: 'Live bid placed', time: b.created_at,
    }))

    items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    setFeed(items.slice(0, 10))
    setLastRefresh(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Operations Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('en-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-medium px-3 py-2 rounded-xl text-xs shadow-sm transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {lastRefresh.toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' })}
          </button>
          <Link href="/admin/vehicles/new"
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold px-4 py-2 rounded-xl text-sm shadow-sm transition-colors">
            <Plus className="w-4 h-4" />Add Vehicle
          </Link>
          <Link href="/admin/live-control"
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-xl text-sm shadow-sm transition-colors">
            <Radio className="w-4 h-4" />Live Controller
          </Link>
        </div>
      </div>

      {/* Alert banner */}
      {(stats.pendingKyc > 0 || stats.pendingDeposits > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-amber-800 font-semibold text-sm">
              Action Required: {[stats.pendingKyc > 0 && `${stats.pendingKyc} KYC submission${stats.pendingKyc !== 1 ? 's' : ''}`, stats.pendingDeposits > 0 && `${stats.pendingDeposits} deposit approval${stats.pendingDeposits !== 1 ? 's' : ''}`].filter(Boolean).join(' and ')}
            </p>
            <p className="text-amber-600 text-xs mt-0.5">Users are waiting for your review</p>
          </div>
          <div className="flex gap-2">
            {stats.pendingKyc > 0 && (
              <Link href="/admin/approvals" className="text-xs font-bold bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors">
                Review KYC
              </Link>
            )}
            {stats.pendingDeposits > 0 && (
              <Link href="/admin/deposits" className="text-xs font-bold bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors">
                Approve Deposits
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        <StatCard label="Active Bidders" value={stats.activeBidders} sub={`${stats.totalUsers} total registered`} icon={Users} color="bg-blue-500" href="/admin/approvals" />
        <StatCard label="Pending KYC" value={stats.pendingKyc} sub="Need ID verification" icon={AlertCircle} color="bg-amber-500" href="/admin/approvals" badge={stats.pendingKyc} />
        <StatCard label="Pending Deposits" value={stats.pendingDeposits} sub="Awaiting approval" icon={DollarSign} color="bg-emerald-500" href="/admin/deposits" badge={stats.pendingDeposits} />
        <StatCard label="Live Auctions" value={stats.liveAuctions} sub="Currently active" icon={Radio} color="bg-red-500" href="/admin/live-control" pulse={stats.liveAuctions > 0} />
        <StatCard label="Awaiting Auction" value={stats.carsAwaitingAuction} sub="Approved vehicles" icon={Car} color="bg-orange-500" href="/admin/inventory" />
      </div>

      {/* Revenue row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-2xl p-5 shadow-sm shadow-indigo-200">
          <p className="text-indigo-200 text-xs font-bold uppercase tracking-wide mb-1">Total Deposit Volume</p>
          <p className="text-3xl font-black">{formatCurrency(stats.totalDepositVolume)}</p>
          <p className="text-indigo-200 text-xs mt-1">{stats.activeBidders} active depositors</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white rounded-2xl p-5 shadow-sm shadow-emerald-200">
          <p className="text-emerald-200 text-xs font-bold uppercase tracking-wide mb-1">Estimated GMV</p>
          <p className="text-3xl font-black">{formatCurrency(stats.gmv)}</p>
          <p className="text-emerald-200 text-xs mt-1">Sold auctions total value</p>
        </div>
        <div className="bg-gradient-to-br from-purple-600 to-purple-700 text-white rounded-2xl p-5 shadow-sm shadow-purple-200">
          <p className="text-purple-200 text-xs font-bold uppercase tracking-wide mb-1">Today&apos;s Activity</p>
          <p className="text-3xl font-black">{stats.newUsersToday} <span className="text-lg font-bold">new</span></p>
          <p className="text-purple-200 text-xs mt-1">{stats.totalBidsToday} bids placed today</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-400" />
              <h2 className="font-bold text-slate-900">Live Activity Feed</h2>
            </div>
            <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">Refreshes every 30s</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : feed.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">No activity yet</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {feed.map(item => {
                const Icon = FEED_ICONS[item.type] || CheckCircle2
                return (
                  <div key={item.id} className={`flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50/80 transition-colors ${item.urgent ? 'border-l-2 border-amber-400' : ''}`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${FEED_COLORS[item.type]}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-800 text-sm font-semibold truncate">{item.label}</p>
                      <p className={`text-xs ${item.urgent ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>{item.sub}</p>
                    </div>
                    <span className="text-slate-400 text-xs flex-shrink-0 font-medium">{timeAgo(item.time)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">

          {/* Quick Actions */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <h2 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />Quick Actions
            </h2>
            <div className="flex flex-col gap-1.5">
              {[
                { href: '/admin/vehicles/new', label: 'Add New Vehicle', icon: Car, color: 'bg-indigo-600 hover:bg-indigo-700 text-white' },
                { href: '/admin/auctions/new', label: 'Create Auction', icon: Gavel, color: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
                { href: '/admin/catalog', label: 'New Catalog Auction', icon: BookOpen, color: 'bg-purple-600 hover:bg-purple-700 text-white' },
                { href: '/admin/approvals', label: `Review KYC ${stats.pendingKyc > 0 ? `(${stats.pendingKyc})` : ''}`, icon: Users, color: stats.pendingKyc > 0 ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700' },
                { href: '/admin/deposits', label: `Approve Deposits ${stats.pendingDeposits > 0 ? `(${stats.pendingDeposits})` : ''}`, icon: DollarSign, color: stats.pendingDeposits > 0 ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700' },
                { href: '/admin/live-control', label: 'Open Live Controller', icon: Radio, color: 'bg-slate-900 hover:bg-slate-800 text-white' },
                { href: '/admin/metrics', label: 'Business Metrics', icon: BarChart2, color: 'bg-slate-100 hover:bg-slate-200 text-slate-700' },
              ].map(({ href, label, icon: Icon, color }) => (
                <Link key={href} href={href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-colors ${color}`}>
                  <Icon className="w-4 h-4 flex-shrink-0" />{label}
                </Link>
              ))}
            </div>
          </div>

          {/* Platform health */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <h2 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-slate-400" />Platform Health
            </h2>
            <div className="flex flex-col gap-2.5">
              {[
                {
                  label: 'Conversion (Reg → Bidder)',
                  value: stats.totalUsers > 0 ? `${((stats.activeBidders / stats.totalUsers) * 100).toFixed(0)}%` : '—',
                  good: stats.totalUsers > 0 && stats.activeBidders / stats.totalUsers > 0.25,
                },
                {
                  label: 'Live Auctions',
                  value: stats.liveAuctions > 0 ? `${stats.liveAuctions} active` : 'None running',
                  good: stats.liveAuctions > 0,
                },
                {
                  label: 'Vehicle Pipeline',
                  value: stats.carsAwaitingAuction > 0 ? `${stats.carsAwaitingAuction} ready` : 'Queue empty',
                  good: stats.carsAwaitingAuction > 0,
                },
              ].map(({ label, value, good }) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                  <span className="text-slate-500 text-xs">{label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${good ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <span className={`text-xs font-bold ${good ? 'text-emerald-600' : 'text-amber-600'}`}>{value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
