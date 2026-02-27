'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Users, Car, Gavel, DollarSign, TrendingUp,
  AlertCircle, CheckCircle2, Clock, ArrowRight, Radio, Plus
} from 'lucide-react'

interface Stats {
  activeBidders: number
  pendingKyc: number
  pendingDeposits: number
  activeAuctions: number
  carsAwaitingAuction: number
  totalRevenue: number
}

interface Activity {
  id: string
  type: 'registration' | 'deposit' | 'bid' | 'kyc'
  label: string
  sub: string
  time: string
  color: string
}

function formatCurrency(n: number) {
  return n.toLocaleString('en-EG') + ' EGP'
}

function MetricCard({ label, value, icon: Icon, color, href, badge }: {
  label: string; value: number | string; icon: React.ElementType
  color: string; href?: string; badge?: string
}) {
  const inner = (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {badge && (
          <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{badge}</span>
        )}
      </div>
      <p className="text-2xl font-black text-slate-900 mb-1">{value}</p>
      <p className="text-slate-500 text-sm font-medium">{label}</p>
      {href && (
        <div className="flex items-center gap-1 text-indigo-600 text-xs font-semibold mt-3 group-hover:gap-2 transition-all">
          Manage <ArrowRight className="w-3 h-3" />
        </div>
      )}
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    activeBidders: 0, pendingKyc: 0, pendingDeposits: 0,
    activeAuctions: 0, carsAwaitingAuction: 0, totalRevenue: 0,
  })
  const [activity, setActivity] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [usersRes, depositsRes, auctionsRes, vehiclesRes, bidsRes] = await Promise.all([
        supabase.from('users').select('id, is_verified, national_id_url, created_at, full_name, bidding_tier').order('created_at', { ascending: false }),
        supabase.from('transactions').select('id, amount, status, created_at, user_id, users(full_name)').eq('type', 'deposit').order('created_at', { ascending: false }).limit(10),
        supabase.from('auctions').select('id, status, vehicle_id'),
        supabase.from('vehicles').select('id, status'),
        supabase.from('bids').select('id, amount, created_at, auction_id, bidder_id, users(full_name)').order('created_at', { ascending: false }).limit(5),
      ])

      const users = usersRes.data || []
      const deposits = depositsRes.data || []
      const auctions = auctionsRes.data || []
      const vehicles = vehiclesRes.data || []
      const bids = bidsRes.data || []

      const auctionedVehicleIds = new Set(auctions.map((a: { vehicle_id: string }) => a.vehicle_id))

      setStats({
        activeBidders: users.filter((u: { bidding_tier: number }) => u.bidding_tier > 0).length,
        pendingKyc: users.filter((u: { is_verified: boolean; national_id_url: string | null }) => !u.is_verified && u.national_id_url).length,
        pendingDeposits: deposits.filter((d: { status: string }) => d.status === 'pending').length,
        activeAuctions: auctions.filter((a: { status: string }) => a.status === 'active').length,
        carsAwaitingAuction: vehicles.filter((v: { id: string; status: string }) => v.status === 'approved' && !auctionedVehicleIds.has(v.id)).length,
        totalRevenue: deposits.filter((d: { status: string }) => d.status === 'completed').reduce((sum: number, d: { amount: number }) => sum + d.amount, 0),
      })

      // Build activity feed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function getUserName(rel: any): string {
        if (!rel) return 'User'
        if (Array.isArray(rel)) return rel[0]?.full_name || 'User'
        return rel.full_name || 'User'
      }

      const feed: Activity[] = []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      users.slice(0, 3).forEach((u: any) => feed.push({
        id: `u-${u.id}`, type: 'registration', label: `${u.full_name} registered`,
        sub: 'New account', time: u.created_at, color: 'bg-blue-100 text-blue-600',
      }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      deposits.slice(0, 3).forEach((d: any) => feed.push({
        id: `d-${d.id}`, type: 'deposit',
        label: `${getUserName(d.users)} deposited ${formatCurrency(d.amount)}`,
        sub: d.status === 'pending' ? 'Awaiting approval' : 'Approved',
        time: d.created_at, color: d.status === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600',
      }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bids.slice(0, 3).forEach((b: any) => feed.push({
        id: `b-${b.id}`, type: 'bid',
        label: `${getUserName(b.users)} bid ${formatCurrency(b.amount)}`,
        sub: 'Live bid placed', time: b.created_at, color: 'bg-purple-100 text-purple-600',
      }))
      feed.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      setActivity(feed.slice(0, 8))
      setLoading(false)
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  function timeAgo(ts: string) {
    const diff = Date.now() - new Date(ts).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  const ACTIVITY_ICONS: Record<string, React.ElementType> = {
    registration: Users, deposit: DollarSign, bid: TrendingUp, kyc: CheckCircle2
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('en-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/vehicles/new"
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-colors">
            <Plus className="w-4 h-4" />Add Vehicle
          </Link>
          <Link href="/admin/live-control"
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-colors">
            <Radio className="w-4 h-4" />Live Controller
          </Link>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <MetricCard label="Active Bidders" value={stats.activeBidders} icon={Users} color="bg-blue-500" href="/admin/approvals" />
        <MetricCard label="Pending KYC" value={stats.pendingKyc} icon={AlertCircle} color="bg-amber-500" href="/admin/approvals" badge={stats.pendingKyc > 0 ? String(stats.pendingKyc) : undefined} />
        <MetricCard label="Pending Deposits" value={stats.pendingDeposits} icon={DollarSign} color="bg-emerald-500" href="/admin/deposits" badge={stats.pendingDeposits > 0 ? String(stats.pendingDeposits) : undefined} />
        <MetricCard label="Live Auctions" value={stats.activeAuctions} icon={Radio} color="bg-purple-500" href="/admin/live-control" />
        <MetricCard label="Awaiting Auction" value={stats.carsAwaitingAuction} icon={Car} color="bg-orange-500" href="/admin/inventory" />
        <MetricCard label="Total Deposits" value={formatCurrency(stats.totalRevenue)} icon={TrendingUp} color="bg-indigo-500" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Recent Activity</h2>
            <span className="text-xs text-slate-400 font-medium">Auto-refreshes every 30s</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-slate-400 text-sm">Loading activity...</p>
              </div>
            </div>
          ) : activity.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">No activity yet</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {activity.map(item => {
                const Icon = ACTIVITY_ICONS[item.type] || CheckCircle2
                return (
                  <div key={item.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${item.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-800 text-sm font-medium truncate">{item.label}</p>
                      <p className="text-slate-400 text-xs">{item.sub}</p>
                    </div>
                    <span className="text-slate-400 text-xs flex-shrink-0">{timeAgo(item.time)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <h2 className="font-bold text-slate-900 mb-4">Quick Actions</h2>
            <div className="flex flex-col gap-2">
              {[
                { href: '/admin/vehicles/new', label: 'Add New Vehicle', icon: Car, color: 'bg-indigo-600 hover:bg-indigo-700 text-white' },
                { href: '/admin/auctions/new', label: 'Create Auction', icon: Gavel, color: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
                { href: '/admin/approvals', label: `Review KYC (${stats.pendingKyc})`, icon: Users, color: stats.pendingKyc > 0 ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700' },
                { href: '/admin/deposits', label: `Approve Deposits (${stats.pendingDeposits})`, icon: DollarSign, color: stats.pendingDeposits > 0 ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700' },
                { href: '/admin/live-control', label: 'Open Live Controller', icon: Radio, color: 'bg-slate-900 hover:bg-slate-800 text-white' },
              ].map(({ href, label, icon: Icon, color }) => (
                <Link key={href} href={href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-colors ${color}`}>
                  <Icon className="w-4 h-4" />{label}
                </Link>
              ))}
            </div>
          </div>

          {/* Status legend */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <h2 className="font-bold text-slate-900 mb-3">Status Legend</h2>
            <div className="flex flex-col gap-2">
              {[
                { label: 'Approved / Live / Starts & Drives', color: 'bg-emerald-100 text-emerald-700' },
                { label: 'Pending / Engine Starts Only', color: 'bg-amber-100 text-amber-700' },
                { label: 'Rejected / Non-Runner / Damage', color: 'bg-red-100 text-red-700' },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.color.replace('text-', 'bg-').split(' ')[0].replace('100', '500')}`} />
                  <span className="text-slate-500 text-xs">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
