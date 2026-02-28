'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  TrendingUp, Users, DollarSign, Gavel, Car, BarChart2,
  Calendar, ArrowUp, ArrowDown, RefreshCw, Download,
  Clock, CheckCircle2, XCircle, AlertCircle, Percent,
  Eye, Target, Zap, Globe
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────
interface MetricData {
  // Revenue
  totalDepositVolume: number
  depositsPending: number
  depositsApproved: number
  estimatedGMV: number           // Gross Merchandise Value (sum of winning bids)
  avgHammerPrice: number
  buyerPremiumEstimate: number

  // Users
  totalUsers: number
  verifiedUsers: number
  activeDepositUsers: number     // bidding_tier > 0
  tier1Count: number
  tier2Count: number
  tier3Count: number
  newUsersThisWeek: number
  newUsersThisMonth: number
  whatsappOptIns: number
  emailOptIns: number

  // Auctions
  totalAuctions: number
  liveAuctions: number
  completedAuctions: number
  soldAuctions: number
  noSaleAuctions: number
  sellThroughRate: number        // sold / completed %
  avgBidsPerAuction: number
  totalBids: number
  avgTimeToSell: number          // hours

  // Vehicles
  totalVehicles: number
  vehiclesAwaitingAuction: number
  vehiclesSold: number
  avgDaysOnPlatform: number

  // KYC
  pendingKyc: number
  approvedKyc: number
  kycApprovalRate: number
}

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M EGP`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K EGP`
  return n.toLocaleString('en-EG') + ' EGP'
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function KpiCard({ label, value, sub, icon: Icon, iconColor, trend, trendLabel, highlight }: {
  label: string; value: string; sub?: string; icon: React.ElementType
  iconColor: string; trend?: 'up' | 'down' | 'neutral'; trendLabel?: string; highlight?: boolean
}) {
  return (
    <div className={`bg-white rounded-2xl border p-5 shadow-sm ${highlight ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconColor}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend && trendLabel && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${trend === 'up' ? 'bg-emerald-100 text-emerald-700' : trend === 'down' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
            {trend === 'up' ? <ArrowUp className="w-3 h-3" /> : trend === 'down' ? <ArrowDown className="w-3 h-3" /> : null}
            {trendLabel}
          </div>
        )}
      </div>
      <p className="text-2xl font-black text-slate-900">{value}</p>
      <p className="text-slate-500 text-sm font-medium mt-0.5">{label}</p>
      {sub && <p className="text-slate-400 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function SectionTitle({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center">
        <Icon className="w-4 h-4 text-slate-600" />
      </div>
      <div>
        <h2 className="font-black text-slate-900">{title}</h2>
        {sub && <p className="text-slate-400 text-xs">{sub}</p>}
      </div>
    </div>
  )
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────
export default function AdminMetricsPage() {
  const [metrics, setMetrics] = useState<MetricData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const loadMetrics = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
    const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString()

    const [
      usersRes, transactionsRes, auctionsRes, vehiclesRes,
      bidsRes, weekUsersRes, monthUsersRes,
    ] = await Promise.all([
      supabase.from('users').select('id, bidding_tier, is_verified, national_id_url, created_at, whatsapp_alerts, email_notifications'),
      supabase.from('transactions').select('id, amount, status, type, created_at'),
      supabase.from('auctions').select('id, status, current_highest_bid, starting_price, start_time, end_time, vehicle_id, highest_bidder_id'),
      supabase.from('vehicles').select('id, status, created_at'),
      supabase.from('bids').select('id, amount, auction_id, created_at'),
      supabase.from('users').select('id', { count: 'exact' }).gte('created_at', weekAgo),
      supabase.from('users').select('id', { count: 'exact' }).gte('created_at', monthAgo),
    ])

    const users = usersRes.data || []
    const transactions = transactionsRes.data || []
    const auctions = auctionsRes.data || []
    const vehicles = vehiclesRes.data || []
    const bids = bidsRes.data || []

    // ── Revenue Metrics ─────────────────────────────────
    const deposits = transactions.filter((t: { type: string }) => t.type === 'deposit')
    const approvedDeposits = deposits.filter((t: { status: string }) => t.status === 'completed')
    const totalDepositVolume = approvedDeposits.reduce((s: number, t: { amount: number }) => s + t.amount, 0)
    const depositsPending = deposits.filter((t: { status: string }) => t.status === 'pending').length

    const completedAuctions = auctions.filter((a: { status: string }) => ['ended', 'settled', 'sold'].includes(a.status))
    const soldAuctions = completedAuctions.filter((a: { highest_bidder_id: string | null }) => a.highest_bidder_id)
    const estimatedGMV = soldAuctions.reduce((s: number, a: { current_highest_bid: number }) => s + (a.current_highest_bid || 0), 0)
    const avgHammerPrice = soldAuctions.length > 0 ? estimatedGMV / soldAuctions.length : 0
    // Buyer's premium estimate: flat 5% on average
    const buyerPremiumEstimate = estimatedGMV * 0.05

    // ── User Metrics ────────────────────────────────────
    const tier1 = users.filter((u: { bidding_tier: number }) => u.bidding_tier === 1)
    const tier2 = users.filter((u: { bidding_tier: number }) => u.bidding_tier === 2)
    const tier3 = users.filter((u: { bidding_tier: number }) => u.bidding_tier === 3)
    const verifiedUsers = users.filter((u: { is_verified: boolean }) => u.is_verified)
    const depositUsers = users.filter((u: { bidding_tier: number }) => u.bidding_tier > 0)
    const whatsappOptIns = users.filter((u: { whatsapp_alerts: boolean }) => u.whatsapp_alerts).length
    const emailOptIns = users.filter((u: { email_notifications: boolean }) => u.email_notifications !== false).length

    // ── Auction Metrics ─────────────────────────────────
    const liveAuctions = auctions.filter((a: { status: string }) => a.status === 'active')
    const noSaleAuctions = completedAuctions.filter((a: { highest_bidder_id: string | null }) => !a.highest_bidder_id)
    const sellThroughRate = completedAuctions.length > 0 ? (soldAuctions.length / completedAuctions.length) * 100 : 0

    const bidsPerAuction: Record<string, number> = {}
    bids.forEach((b: { auction_id: string }) => { bidsPerAuction[b.auction_id] = (bidsPerAuction[b.auction_id] || 0) + 1 })
    const bidCounts = Object.values(bidsPerAuction)
    const avgBidsPerAuction = bidCounts.length > 0 ? bidCounts.reduce((a: number, b: number) => a + b, 0) / bidCounts.length : 0

    // Avg time to sell (hours from start_time to end_time for sold auctions)
    const sellTimes = soldAuctions
      .filter((a: { start_time: string; end_time: string }) => a.start_time && a.end_time)
      .map((a: { start_time: string; end_time: string }) => (new Date(a.end_time).getTime() - new Date(a.start_time).getTime()) / 3600000)
    const avgTimeToSell = sellTimes.length > 0 ? sellTimes.reduce((a: number, b: number) => a + b, 0) / sellTimes.length : 0

    // ── Vehicle Metrics ─────────────────────────────────
    const auctionedVehicleIds = new Set(auctions.map((a: { vehicle_id: string }) => a.vehicle_id))
    const approvedVehicles = vehicles.filter((v: { status: string }) => v.status === 'approved')
    const vehiclesAwaitingAuction = approvedVehicles.filter((v: { id: string }) => !auctionedVehicleIds.has(v.id))

    // KYC
    const submittedKyc = users.filter((u: { national_id_url: string | null }) => u.national_id_url)
    const kycApprovalRate = submittedKyc.length > 0 ? (verifiedUsers.length / submittedKyc.length) * 100 : 0

    setMetrics({
      totalDepositVolume, depositsPending, depositsApproved: approvedDeposits.length,
      estimatedGMV, avgHammerPrice, buyerPremiumEstimate,
      totalUsers: users.length, verifiedUsers: verifiedUsers.length,
      activeDepositUsers: depositUsers.length,
      tier1Count: tier1.length, tier2Count: tier2.length, tier3Count: tier3.length,
      newUsersThisWeek: weekUsersRes.count || 0, newUsersThisMonth: monthUsersRes.count || 0,
      whatsappOptIns, emailOptIns,
      totalAuctions: auctions.length, liveAuctions: liveAuctions.length,
      completedAuctions: completedAuctions.length, soldAuctions: soldAuctions.length,
      noSaleAuctions: noSaleAuctions.length, sellThroughRate,
      avgBidsPerAuction, totalBids: bids.length, avgTimeToSell,
      totalVehicles: vehicles.length, vehiclesAwaitingAuction: vehiclesAwaitingAuction.length,
      vehiclesSold: soldAuctions.length, avgDaysOnPlatform: 0,
      pendingKyc: submittedKyc.filter((u: { is_verified: boolean }) => !u.is_verified).length,
      approvedKyc: verifiedUsers.length, kycApprovalRate,
    })

    setLastRefresh(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    loadMetrics()
    const interval = setInterval(loadMetrics, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [loadMetrics])

  if (loading && !metrics) return (
    <div className="p-8 flex items-center justify-center py-32">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500">Loading business metrics...</p>
      </div>
    </div>
  )

  const m = metrics!

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Business Metrics</h1>
          <p className="text-slate-500 text-sm mt-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Last updated {lastRefresh.toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' })} · Auto-refreshes every 60s
          </p>
        </div>
        <button onClick={loadMetrics} disabled={loading}
          className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Refresh
        </button>
      </div>

      {/* ── REVENUE & GMV ─────────────────────────────────── */}
      <div className="mb-8">
        <SectionTitle icon={DollarSign} title="Revenue & Volume" sub="Financial performance indicators" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Deposit Volume" value={formatCurrency(m.totalDepositVolume)} sub={`${m.depositsApproved} approved deposits`} icon={DollarSign} iconColor="bg-emerald-500" highlight />
          <KpiCard label="Estimated GMV" value={formatCurrency(m.estimatedGMV)} sub="Sum of all winning bids" icon={TrendingUp} iconColor="bg-indigo-500" highlight />
          <KpiCard label="Avg. Hammer Price" value={m.avgHammerPrice > 0 ? formatCurrency(m.avgHammerPrice) : '—'} sub="Per completed auction" icon={Gavel} iconColor="bg-purple-500" />
          <KpiCard label="Est. Buyer Premium" value={formatCurrency(m.buyerPremiumEstimate)} sub="~5% of GMV" icon={Percent} iconColor="bg-amber-500" />
        </div>
      </div>

      {/* ── USERS ─────────────────────────────────────────── */}
      <div className="mb-8">
        <SectionTitle icon={Users} title="Users & Registration" sub="Acquisition, verification, and tier distribution" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <KpiCard label="Total Registered" value={formatNumber(m.totalUsers)} sub="All-time" icon={Users} iconColor="bg-blue-500" />
          <KpiCard label="New This Week" value={formatNumber(m.newUsersThisWeek)} icon={Users} iconColor="bg-sky-400" trend={m.newUsersThisWeek > 5 ? 'up' : 'neutral'} trendLabel={`${m.newUsersThisMonth} this month`} />
          <KpiCard label="Active Bidders" value={formatNumber(m.activeDepositUsers)} sub="Have made a deposit" icon={Zap} iconColor="bg-orange-500" />
          <KpiCard label="KYC Verified" value={formatNumber(m.verifiedUsers)} sub={`${m.kycApprovalRate.toFixed(0)}% approval rate`} icon={CheckCircle2} iconColor="bg-teal-500" />
        </div>

        {/* Tier breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-800 text-sm mb-4">Bidding Tier Distribution</h3>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Tier 1 — Starter (5K EGP deposit)', count: m.tier1Count, color: 'bg-amber-400', textColor: 'text-amber-700', bgColor: 'bg-amber-50' },
                { label: 'Tier 2 — Professional (20K EGP deposit)', count: m.tier2Count, color: 'bg-blue-400', textColor: 'text-blue-700', bgColor: 'bg-blue-50' },
                { label: 'Tier 3 — Elite (50K EGP deposit)', count: m.tier3Count, color: 'bg-purple-400', textColor: 'text-purple-700', bgColor: 'bg-purple-50' },
              ].map(({ label, count, color, textColor, bgColor }) => (
                <div key={label} className={`flex items-center gap-3 p-3 rounded-xl ${bgColor}`}>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1.5">
                      <span className={`text-xs font-semibold ${textColor}`}>{label}</span>
                      <span className={`text-sm font-black ${textColor}`}>{count}</span>
                    </div>
                    <ProgressBar value={count} max={m.activeDepositUsers || 1} color={color} />
                  </div>
                </div>
              ))}
              <div className="border-t border-slate-100 pt-2 flex justify-between text-xs text-slate-500 font-medium">
                <span>No deposit (Tier 0)</span>
                <span>{m.totalUsers - m.activeDepositUsers} users</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-800 text-sm mb-4">Notification Opt-ins</h3>
            <div className="flex flex-col gap-3">
              {[
                { label: '📱 WhatsApp Alerts', count: m.whatsappOptIns, total: m.totalUsers, color: 'bg-green-400' },
                { label: '✉️ Email Notifications', count: m.emailOptIns, total: m.totalUsers, color: 'bg-blue-400' },
                { label: '✅ KYC Submitted', count: m.approvedKyc + m.pendingKyc, total: m.totalUsers, color: 'bg-teal-400' },
                { label: '✅ KYC Approved', count: m.approvedKyc, total: m.approvedKyc + m.pendingKyc, color: 'bg-emerald-500' },
              ].map(({ label, count, total, color }) => (
                <div key={label}>
                  <div className="flex justify-between mb-1 text-xs">
                    <span className="text-slate-600 font-medium">{label}</span>
                    <span className="text-slate-900 font-bold">{count} <span className="text-slate-400 font-normal">/ {total} ({total > 0 ? ((count / total) * 100).toFixed(0) : 0}%)</span></span>
                  </div>
                  <ProgressBar value={count} max={total || 1} color={color} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── AUCTIONS ──────────────────────────────────────── */}
      <div className="mb-8">
        <SectionTitle icon={Gavel} title="Auction Performance" sub="Conversion rates and engagement metrics" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <KpiCard label="Total Auctions" value={formatNumber(m.totalAuctions)} icon={Gavel} iconColor="bg-indigo-500" />
          <KpiCard label="Live Now" value={formatNumber(m.liveAuctions)} sub="Currently active" icon={Zap} iconColor="bg-red-500" trend={m.liveAuctions > 0 ? 'up' : 'neutral'} trendLabel="LIVE" />
          <KpiCard label="Sell-Through Rate" value={`${m.sellThroughRate.toFixed(1)}%`} sub="Completed auctions with a winner" icon={Target} iconColor="bg-emerald-500" highlight={m.sellThroughRate > 70} />
          <KpiCard label="Avg. Bids / Auction" value={m.avgBidsPerAuction.toFixed(1)} sub={`${m.totalBids.toLocaleString()} total bids`} icon={BarChart2} iconColor="bg-purple-500" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-800 text-sm mb-4">Auction Outcomes</h3>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Sold (has winner)', count: m.soldAuctions, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'No Sale (ended, no winner)', count: m.noSaleAuctions, icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
                { label: 'Live / Active', count: m.liveAuctions, icon: Zap, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Draft / Scheduled', count: m.totalAuctions - m.completedAuctions - m.liveAuctions, icon: Clock, color: 'text-slate-500', bg: 'bg-slate-50' },
              ].map(({ label, count, icon: Icon, color, bg }) => (
                <div key={label} className={`flex items-center gap-3 p-3 rounded-xl ${bg}`}>
                  <Icon className={`w-5 h-5 flex-shrink-0 ${color}`} />
                  <span className="flex-1 text-sm text-slate-700 font-medium">{label}</span>
                  <span className={`font-black text-lg ${color}`}>{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-800 text-sm mb-4">Speed Metrics</h3>
            <div className="flex flex-col gap-4">
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-black text-indigo-600">{m.avgTimeToSell > 0 ? `${m.avgTimeToSell.toFixed(1)}h` : '—'}</p>
                <p className="text-xs text-slate-500 mt-1">Avg. time to sell (start → hammer)</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-black text-purple-600">{m.avgBidsPerAuction.toFixed(1)}</p>
                <p className="text-xs text-slate-500 mt-1">Average bids per auction</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-800 text-sm mb-3">Deposit Pipeline</h3>
            <div className="flex flex-col gap-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-amber-800">Pending Approval</span>
                  <span className="text-2xl font-black text-amber-600">{m.depositsPending}</span>
                </div>
                {m.depositsPending > 0 && (
                  <p className="text-amber-600 text-xs mt-1">⚡ Action required</p>
                )}
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-emerald-800">Approved Deposits</span>
                  <span className="text-2xl font-black text-emerald-600">{m.depositsApproved}</span>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-700">Total Held</span>
                  <span className="text-lg font-black text-slate-800">{formatCurrency(m.totalDepositVolume)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── VEHICLES ──────────────────────────────────────── */}
      <div className="mb-8">
        <SectionTitle icon={Car} title="Vehicle Inventory" sub="Supply pipeline and sell-through" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Vehicles" value={formatNumber(m.totalVehicles)} icon={Car} iconColor="bg-slate-600" />
          <KpiCard label="Awaiting Auction" value={formatNumber(m.vehiclesAwaitingAuction)} sub="Approved but not yet listed" icon={AlertCircle} iconColor="bg-amber-500" trend={m.vehiclesAwaitingAuction > 10 ? 'up' : 'neutral'} trendLabel="In queue" />
          <KpiCard label="Vehicles Sold" value={formatNumber(m.vehiclesSold)} sub="Completed with winner" icon={CheckCircle2} iconColor="bg-emerald-500" />
          <KpiCard label="KYC Pending" value={formatNumber(m.pendingKyc)} sub={`${m.kycApprovalRate.toFixed(0)}% approval rate`} icon={Eye} iconColor="bg-blue-500" trend={m.pendingKyc > 0 ? 'up' : 'neutral'} trendLabel="Review" />
        </div>
      </div>

      {/* ── BUSINESS HEALTH SUMMARY ───────────────────────── */}
      <div>
        <SectionTitle icon={BarChart2} title="Business Health Summary" sub="High-level corporate scorecard" />
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                label: 'Conversion Rate',
                value: m.totalUsers > 0 ? `${((m.activeDepositUsers / m.totalUsers) * 100).toFixed(1)}%` : '0%',
                sub: 'Registered → Active Bidder',
                good: m.totalUsers > 0 && (m.activeDepositUsers / m.totalUsers) > 0.3,
              },
              {
                label: 'KYC Pass Rate',
                value: `${m.kycApprovalRate.toFixed(1)}%`,
                sub: 'Submitted → Approved',
                good: m.kycApprovalRate > 80,
              },
              {
                label: 'Sell-Through Rate',
                value: `${m.sellThroughRate.toFixed(1)}%`,
                sub: 'Auctions with a winner',
                good: m.sellThroughRate > 65,
              },
              {
                label: 'WhatsApp Opt-in Rate',
                value: m.totalUsers > 0 ? `${((m.whatsappOptIns / m.totalUsers) * 100).toFixed(1)}%` : '0%',
                sub: 'Of all registered users',
                good: m.totalUsers > 0 && (m.whatsappOptIns / m.totalUsers) > 0.7,
              },
              {
                label: 'Email Opt-in Rate',
                value: m.totalUsers > 0 ? `${((m.emailOptIns / m.totalUsers) * 100).toFixed(1)}%` : '0%',
                sub: 'Of all registered users',
                good: m.totalUsers > 0 && (m.emailOptIns / m.totalUsers) > 0.7,
              },
              {
                label: 'Avg. Revenue / User',
                value: m.activeDepositUsers > 0 ? formatCurrency(Math.round(m.totalDepositVolume / m.activeDepositUsers)) : '—',
                sub: 'Deposit volume per active bidder',
                good: true,
              },
            ].map(({ label, value, sub, good }) => (
              <div key={label} className={`flex items-center gap-3 p-4 rounded-xl border ${good ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${good ? 'bg-emerald-500' : 'bg-amber-400'}`}>
                  {good ? <CheckCircle2 className="w-4 h-4 text-white" /> : <AlertCircle className="w-4 h-4 text-white" />}
                </div>
                <div>
                  <p className={`text-lg font-black ${good ? 'text-emerald-700' : 'text-amber-700'}`}>{value}</p>
                  <p className={`text-sm font-semibold ${good ? 'text-emerald-800' : 'text-amber-800'}`}>{label}</p>
                  <p className={`text-xs ${good ? 'text-emerald-600' : 'text-amber-600'}`}>{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
