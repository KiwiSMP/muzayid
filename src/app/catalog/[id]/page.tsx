'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/layout/Navbar'
import {
  Gavel, Clock, AlertTriangle, Shield, ChevronLeft, ChevronRight,
  CheckCircle2, AlertCircle, Loader2, Car, Users, Radio,
  Trophy, TrendingUp, SkipForward, Eye
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────
interface CatalogLot {
  id: string
  catalog_id: string
  vehicle_id: string
  lot_order: number
  status: 'pending' | 'active' | 'sold' | 'passed' | 'no_sale'
  starting_price: number
  current_bid: number
  highest_bidder_id: string | null
  highest_bidder_name: string | null
  end_time: string | null
  vehicle: {
    id: string; make: string; model: string; year: number
    damage_type: string; mileage: number; images: string[]
    fines_cleared: boolean
    condition_report: {
      run_drive_status?: string; primary_damage?: string
      keys_available?: boolean; location?: string; chassis_number?: string
      reserve_price?: number
    }
  }
}

interface Catalog {
  id: string
  title: string
  description: string
  status: 'scheduled' | 'active' | 'ended'
  scheduled_at: string
  total_lots: number
  current_lot_order: number
  bid_increment: number
}

interface Bid {
  id: string; amount: number; created_at: string
  bidder_name: string
}

interface UserProfile {
  id: string; full_name: string; bidding_tier: number; is_verified: boolean
}

// ── Helpers ────────────────────────────────────────────────────
function formatCurrency(n: number) {
  return n.toLocaleString('en-EG') + ' EGP'
}

function CountdownBar({ endTime, totalSeconds }: { endTime: string; totalSeconds: number }) {
  const [left, setLeft] = useState(totalSeconds)

  useEffect(() => {
    const calc = () => {
      const remaining = Math.max(0, Math.floor((Date.parse(endTime) - Date.now()) / 1000))
      setLeft(remaining)
    }
    calc()
    const i = setInterval(calc, 500)
    return () => clearInterval(i)
  }, [endTime])

  const pct = Math.min(100, (left / totalSeconds) * 100)
  const urgent = left <= 15
  const m = Math.floor(left / 60)
  const s = left % 60

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-xs font-bold">
        <span className={urgent ? 'text-red-600 animate-pulse' : 'text-slate-600'}>
          {urgent ? '⚡ CLOSING' : '⏱ Time Left'}
        </span>
        <span className={`font-black text-lg tabular-nums ${urgent ? 'text-red-600' : 'text-slate-900'}`}>
          {m}:{String(s).padStart(2, '0')}
        </span>
      </div>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${urgent ? 'bg-red-500 animate-pulse' : left <= 30 ? 'bg-orange-400' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function DamageLabel(type: string) {
  const map: Record<string, string> = {
    front_collision: 'Front Collision', rear_collision: 'Rear Collision',
    side_collision: 'Side Collision', rollover: 'Rollover', flood: 'Flood Damage',
    fire: 'Fire Damage', hail: 'Hail', theft_recovery: 'Theft Recovery',
    mechanical: 'Mechanical', other: 'Other',
  }
  return map[type] || type
}

// ── Main Component ─────────────────────────────────────────────
export default function CatalogPage() {
  const params = useParams()
  const catalogId = params.id as string

  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [lots, setLots] = useState<CatalogLot[]>([])
  const [bids, setBids] = useState<Bid[]>([])
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [bidAmount, setBidAmount] = useState('')
  const [bidding, setBidding] = useState(false)
  const [bidError, setBidError] = useState('')
  const [bidSuccess, setBidSuccess] = useState(false)
  const [imgIdx, setImgIdx] = useState(0)
  const bidInputRef = useRef<HTMLInputElement>(null)

  const currentLot = lots.find(l => l.lot_order === catalog?.current_lot_order && l.status === 'active')
    || lots.find(l => l.status === 'active')
  const upcomingLots = lots.filter(l => l.status === 'pending').sort((a, b) => a.lot_order - b.lot_order)
  const soldLots = lots.filter(l => l.status === 'sold' || l.status === 'no_sale').sort((a, b) => b.lot_order - a.lot_order)

  const images = currentLot?.vehicle?.images || []
  const currentBid = currentLot ? Math.max(currentLot.current_bid, currentLot.starting_price) : 0
  const isWinning = user && currentLot?.highest_bidder_id === user.id

  const load = useCallback(async () => {
    const supabase = createClient()
    const [catalogRes, lotsRes, userRes] = await Promise.all([
      supabase.from('auction_catalogs').select('*').eq('id', catalogId).single(),
      supabase.from('catalog_lots')
        .select('*, vehicle:vehicles(id, make, model, year, damage_type, mileage, images, fines_cleared, condition_report)')
        .eq('catalog_id', catalogId)
        .order('lot_order'),
      supabase.auth.getUser(),
    ])

    if (catalogRes.data) setCatalog(catalogRes.data as Catalog)
    if (lotsRes.data) setLots(lotsRes.data as CatalogLot[])

    if (userRes.data.user) {
      const { data: profile } = await supabase.from('users').select('id, full_name, bidding_tier, is_verified').eq('id', userRes.data.user.id).single()
      if (profile) setUser(profile as UserProfile)
    }
    setLoading(false)
  }, [catalogId])

  const loadBids = useCallback(async () => {
    if (!currentLot) return
    const supabase = createClient()
    const { data } = await supabase
      .from('catalog_bids')
      .select('*, user:users(full_name)')
      .eq('lot_id', currentLot.id)
      .order('created_at', { ascending: false })
      .limit(15)
    if (data) {
      setBids(data.map((b: { id: string; amount: number; created_at: string; user: { full_name: string } | { full_name: string }[] | null }) => ({
        id: b.id,
        amount: b.amount,
        created_at: b.created_at,
        bidder_name: Array.isArray(b.user) ? b.user[0]?.full_name : b.user?.full_name || 'Bidder',
      })))
    }
  }, [currentLot])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadBids() }, [loadBids])
  useEffect(() => { setImgIdx(0); setBidAmount(''); setBidError('') }, [currentLot?.id])

  // Realtime subscriptions
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`catalog-${catalogId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_catalogs', filter: `id=eq.${catalogId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catalog_lots', filter: `catalog_id=eq.${catalogId}` }, () => { load(); loadBids() })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'catalog_bids' }, () => loadBids())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [catalogId, load, loadBids])

  async function handleBid() {
    if (!user || !currentLot || !bidAmount) return
    setBidding(true); setBidError(''); setBidSuccess(false)
    const supabase = createClient()
    try {
      const amount = parseFloat(bidAmount.replace(/,/g, ''))
      if (isNaN(amount) || amount <= 0) throw new Error('Enter a valid bid amount.')
      const minBid = currentBid + (catalog?.bid_increment || 500)
      if (amount < minBid) throw new Error(`Minimum bid is ${formatCurrency(minBid)}.`)

      const { error } = await supabase.from('catalog_bids').insert({
        lot_id: currentLot.id,
        catalog_id: catalogId,
        bidder_id: user.id,
        amount,
      })
      if (error) throw new Error(error.message)
      setBidSuccess(true)
      setBidAmount('')
      setTimeout(() => setBidSuccess(false), 2500)
      bidInputRef.current?.focus()
    } catch (err: unknown) {
      setBidError(err instanceof Error ? err.message : 'Bid failed.')
    } finally {
      setBidding(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-400 mx-auto mb-4" />
        <p className="text-slate-400 font-semibold">Entering Auction Room...</p>
      </div>
    </div>
  )

  if (!catalog) return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Navbar />
      <div className="flex items-center justify-center py-32 text-slate-500">Catalog not found.</div>
    </div>
  )

  const isLive = catalog.status === 'active'
  const isScheduled = catalog.status === 'scheduled'

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Auction room header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#1E3A5F] rounded-lg flex items-center justify-center">
                <Gavel className="w-4 h-4 text-white" />
              </div>
              <span className="font-black text-white text-sm hidden sm:block">مزايد MUZAYID</span>
            </Link>
            <div className="w-px h-5 bg-slate-700" />
            <div>
              <p className="font-bold text-white text-sm">{catalog.title}</p>
              <p className="text-slate-400 text-xs">{lots.length} lots · {soldLots.length} sold</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isLive ? (
              <span className="flex items-center gap-1.5 text-xs font-bold bg-red-600 text-white px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />LIVE
              </span>
            ) : isScheduled ? (
              <span className="flex items-center gap-1.5 text-xs font-bold bg-amber-500 text-white px-3 py-1.5 rounded-full">
                <Clock className="w-3 h-3" />SCHEDULED
              </span>
            ) : (
              <span className="text-xs font-bold bg-slate-700 text-slate-300 px-3 py-1.5 rounded-full">ENDED</span>
            )}
            {user && (
              <span className="text-slate-400 text-xs">
                Logged in as <span className="text-white font-semibold">{user.full_name}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* Scheduled state */}
        {isScheduled && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Clock className="w-10 h-10 text-amber-400" />
            </div>
            <h2 className="text-2xl font-black mb-2">Auction Starts Soon</h2>
            <p className="text-slate-400 mb-2">
              {new Date(catalog.scheduled_at).toLocaleDateString('en-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-slate-500 text-sm mt-4">{lots.length} vehicles ready to go on the block.</p>
            <div className="mt-8 flex flex-col gap-2 max-w-sm mx-auto">
              {lots.slice(0, 5).map(lot => (
                <div key={lot.id} className="flex items-center gap-3 bg-slate-800 rounded-xl p-3 text-left">
                  <div className="w-12 h-9 rounded-lg overflow-hidden bg-slate-700 flex-shrink-0">
                    {lot.vehicle?.images?.[0] ? <img src={lot.vehicle.images[0]} alt="" className="w-full h-full object-cover" /> : <Car className="w-4 h-4 m-auto text-slate-500" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Lot {lot.lot_order} — {lot.vehicle?.year} {lot.vehicle?.make} {lot.vehicle?.model}</p>
                    <p className="text-xs text-slate-400">Starts at {formatCurrency(lot.starting_price)}</p>
                  </div>
                </div>
              ))}
              {lots.length > 5 && <p className="text-slate-500 text-sm text-center">+{lots.length - 5} more lots</p>}
            </div>
          </div>
        )}

        {/* Live auction */}
        {isLive && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

            {/* LEFT: Upcoming queue */}
            <div className="xl:col-span-2 flex flex-col gap-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Up Next ({upcomingLots.length})</p>
              <div className="flex flex-col gap-2 max-h-[70vh] overflow-y-auto pr-1">
                {upcomingLots.length === 0 ? (
                  <p className="text-slate-600 text-xs text-center py-4">No more lots</p>
                ) : upcomingLots.map((lot, i) => (
                  <div key={lot.id} className={`bg-slate-800 rounded-xl p-2.5 border ${i === 0 ? 'border-amber-500/50' : 'border-slate-700'}`}>
                    <div className="w-full aspect-video rounded-lg overflow-hidden bg-slate-700 mb-2">
                      {lot.vehicle?.images?.[0] ? <img src={lot.vehicle.images[0]} alt="" className="w-full h-full object-cover" /> : <Car className="w-4 h-4 text-slate-500 m-auto mt-4" />}
                    </div>
                    <p className="text-xs font-bold text-slate-300">Lot {lot.lot_order}</p>
                    <p className="text-xs text-slate-400 truncate">{lot.vehicle?.year} {lot.vehicle?.make} {lot.vehicle?.model}</p>
                    <p className="text-xs text-emerald-400 font-semibold mt-0.5">{formatCurrency(lot.starting_price)}</p>
                    {i === 0 && <p className="text-[10px] text-amber-400 font-bold mt-1">▶ ON DECK</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* CENTER: Current lot */}
            <div className="xl:col-span-7 flex flex-col gap-4">
              {!currentLot ? (
                <div className="bg-slate-800 rounded-2xl p-12 text-center">
                  {catalog.status === 'ended' ? (
                    <>
                      <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                      <h2 className="text-xl font-black mb-2">Catalog Auction Complete</h2>
                      <p className="text-slate-400">{soldLots.length} of {lots.length} lots sold</p>
                    </>
                  ) : (
                    <>
                      <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                      <h2 className="text-xl font-black mb-2 text-slate-400">Waiting for next lot...</h2>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {/* Lot header */}
                  <div className="flex items-center gap-3 bg-red-600 rounded-xl px-5 py-3">
                    <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse flex-shrink-0" />
                    <span className="font-black text-base">LOT {currentLot.lot_order} — ON THE BLOCK NOW</span>
                    <span className="ml-auto text-red-100 text-sm font-semibold">{upcomingLots.length} lots remaining</span>
                  </div>

                  {/* Images */}
                  <div className="relative aspect-video bg-slate-800 rounded-2xl overflow-hidden">
                    {images.length > 0 ? (
                      <>
                        <img src={images[imgIdx]} alt="" className="w-full h-full object-cover" />
                        {images.length > 1 && (
                          <>
                            <button onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)}
                              className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white w-9 h-9 rounded-full flex items-center justify-center">
                              <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button onClick={() => setImgIdx(i => (i + 1) % images.length)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white w-9 h-9 rounded-full flex items-center justify-center">
                              <ChevronRight className="w-5 h-5" />
                            </button>
                            <span className="absolute bottom-3 right-3 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-full">
                              {imgIdx + 1}/{images.length}
                            </span>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full"><Car className="w-16 h-16 text-slate-600" /></div>
                    )}
                  </div>

                  {/* Vehicle info */}
                  <div className="bg-slate-800 rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <h2 className="text-2xl font-black">
                          {currentLot.vehicle?.year} {currentLot.vehicle?.make} {currentLot.vehicle?.model}
                        </h2>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-xs bg-red-900/50 text-red-300 px-2.5 py-1 rounded-full font-semibold border border-red-700/30">
                            {DamageLabel(currentLot.vehicle?.damage_type || '')}
                          </span>
                          {currentLot.vehicle?.condition_report?.run_drive_status === 'starts_drives' &&
                            <span className="text-xs bg-emerald-900/50 text-emerald-300 px-2.5 py-1 rounded-full font-semibold border border-emerald-700/30">✓ Starts & Drives</span>}
                          {currentLot.vehicle?.condition_report?.run_drive_status === 'engine_starts' &&
                            <span className="text-xs bg-amber-900/50 text-amber-300 px-2.5 py-1 rounded-full font-semibold border border-amber-700/30">⚠ Engine Starts</span>}
                          {currentLot.vehicle?.condition_report?.run_drive_status === 'non_runner' &&
                            <span className="text-xs bg-red-900/50 text-red-300 px-2.5 py-1 rounded-full font-semibold border border-red-700/30">✕ Non-Runner</span>}
                          {currentLot.vehicle?.fines_cleared &&
                            <span className="text-xs bg-blue-900/50 text-blue-300 px-2.5 py-1 rounded-full font-semibold border border-blue-700/30">✓ Fines Clear</span>}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center">
                      {[
                        { label: 'Mileage', value: `${currentLot.vehicle?.mileage?.toLocaleString()} km` },
                        { label: 'Keys', value: currentLot.vehicle?.condition_report?.keys_available !== false ? '✓ Present' : '✕ Missing' },
                        { label: 'Location', value: currentLot.vehicle?.condition_report?.location || '—' },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-slate-700/50 rounded-xl p-3">
                          <p className="text-slate-400 text-xs mb-0.5">{label}</p>
                          <p className="font-semibold text-sm">{value}</p>
                        </div>
                      ))}
                    </div>

                    {currentLot.vehicle?.condition_report?.primary_damage && (
                      <div className="mt-3 bg-red-900/30 border border-red-700/30 rounded-xl px-4 py-2.5">
                        <p className="text-red-300 text-xs font-semibold">Primary Damage: {currentLot.vehicle.condition_report.primary_damage}</p>
                      </div>
                    )}
                  </div>

                  {/* Countdown */}
                  {currentLot.end_time && (
                    <div className="bg-slate-800 rounded-xl p-4">
                      <CountdownBar endTime={currentLot.end_time} totalSeconds={90} />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* RIGHT: Bid panel + feed */}
            <div className="xl:col-span-3 flex flex-col gap-4">

              {/* Current bid display */}
              <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-1">Current Bid</p>
                <p className="text-4xl font-black text-emerald-400">{formatCurrency(currentBid)}</p>
                {isWinning && (
                  <div className="flex items-center gap-1.5 text-emerald-400 text-sm font-bold mt-1">
                    <Trophy className="w-4 h-4" />You&apos;re winning!
                  </div>
                )}
                {currentLot?.highest_bidder_name && !isWinning && (
                  <p className="text-slate-400 text-xs mt-1">Leader: <span className="text-white font-semibold">{currentLot.highest_bidder_name}</span></p>
                )}

                {currentLot?.vehicle?.condition_report?.reserve_price && (
                  <div className={`mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg ${currentBid >= currentLot.vehicle.condition_report.reserve_price ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/30' : 'bg-amber-900/40 text-amber-400 border border-amber-700/30'}`}>
                    {currentBid >= currentLot.vehicle.condition_report.reserve_price ? '✓ Reserve Met' : `Reserve: ${formatCurrency(currentLot.vehicle.condition_report.reserve_price)}`}
                  </div>
                )}
              </div>

              {/* Bid input */}
              {currentLot && (
                <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 flex flex-col gap-3">
                  {!user ? (
                    <div className="text-center py-2">
                      <p className="text-slate-400 text-sm mb-3">Sign in to bid</p>
                      <Link href="/auth/login" className="block w-full bg-[#1E3A5F] text-white font-bold py-3 rounded-xl text-sm hover:bg-[#162d4a] transition-colors">
                        Sign In
                      </Link>
                    </div>
                  ) : user.bidding_tier === 0 ? (
                    <div className="text-center py-2">
                      <AlertCircle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                      <p className="text-amber-300 text-sm font-semibold mb-2">Deposit required</p>
                      <Link href="/onboarding/deposit" className="block w-full bg-amber-500 text-white font-bold py-2.5 rounded-xl text-sm">
                        Make Deposit
                      </Link>
                    </div>
                  ) : (
                    <>
                      {bidError && (
                        <div className="flex items-start gap-2 bg-red-900/40 border border-red-700/30 text-red-300 rounded-xl px-3 py-2 text-xs">
                          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{bidError}
                        </div>
                      )}
                      {bidSuccess && (
                        <div className="flex items-center gap-2 bg-emerald-900/40 border border-emerald-700/30 text-emerald-300 rounded-xl px-3 py-2 text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />Bid placed!
                        </div>
                      )}

                      {/* Quick bid buttons */}
                      <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3].map(mult => {
                          const amount = currentBid + (catalog?.bid_increment || 500) * mult
                          return (
                            <button key={mult} onClick={() => setBidAmount(String(amount))}
                              className={`py-2 rounded-xl text-xs font-bold transition-colors border ${bidAmount === String(amount) ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}>
                              +{(catalog?.bid_increment || 500) * mult / 1000 >= 1 ? `${(catalog?.bid_increment || 500) * mult / 1000}k` : (catalog?.bid_increment || 500) * mult}
                            </button>
                          )
                        })}
                      </div>

                      <div>
                        <p className="text-slate-400 text-xs mb-1.5">Or enter custom amount (EGP)</p>
                        <input
                          ref={bidInputRef}
                          type="number"
                          value={bidAmount}
                          onChange={e => setBidAmount(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleBid()}
                          placeholder={`Min: ${formatCurrency(currentBid + (catalog?.bid_increment || 500))}`}
                          className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-500"
                        />
                      </div>

                      <button onClick={handleBid} disabled={bidding || !bidAmount}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-black py-4 rounded-xl text-base transition-colors">
                        {bidding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Gavel className="w-5 h-5" />}
                        {bidding ? 'Placing...' : 'BID NOW'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Live bid feed */}
              <div className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 flex-1">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Live Bids</p>
                  <span className="text-xs text-slate-500">{bids.length}</span>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {bids.length === 0 ? (
                    <p className="text-slate-600 text-xs text-center py-6">No bids yet</p>
                  ) : bids.map((bid, i) => (
                    <div key={bid.id} className={`flex items-center gap-3 px-4 py-2.5 border-b border-slate-700/50 ${i === 0 ? 'bg-emerald-900/20' : ''}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${i === 0 ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                        {i === 0 ? '★' : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{bid.bidder_name}</p>
                        <p className="text-[10px] text-slate-500">
                          {new Date(bid.created_at).toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                      </div>
                      <p className={`font-black text-sm flex-shrink-0 ${i === 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {formatCurrency(bid.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ended */}
        {catalog.status === 'ended' && !isLive && (
          <div>
            <div className="text-center py-10">
              <Trophy className="w-14 h-14 text-amber-400 mx-auto mb-4" />
              <h2 className="text-2xl font-black mb-2">Auction Complete</h2>
              <p className="text-slate-400">{soldLots.length} of {lots.length} lots sold</p>
            </div>

            <div className="max-w-2xl mx-auto">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Results</p>
              <div className="flex flex-col gap-2">
                {[...soldLots, ...lots.filter(l => l.status === 'passed')].sort((a, b) => a.lot_order - b.lot_order).map(lot => (
                  <div key={lot.id} className="flex items-center gap-4 bg-slate-800 rounded-xl p-4">
                    <div className="w-14 h-10 rounded-lg overflow-hidden bg-slate-700 flex-shrink-0">
                      {lot.vehicle?.images?.[0] ? <img src={lot.vehicle.images[0]} alt="" className="w-full h-full object-cover" /> : <Car className="w-4 h-4 m-auto text-slate-500" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Lot {lot.lot_order} — {lot.vehicle?.year} {lot.vehicle?.make} {lot.vehicle?.model}</p>
                      {lot.highest_bidder_name && <p className="text-slate-400 text-xs">Winner: {lot.highest_bidder_name}</p>}
                    </div>
                    <div className="text-right">
                      {lot.status === 'sold' ? (
                        <>
                          <p className="font-black text-emerald-400">{formatCurrency(lot.current_bid)}</p>
                          <p className="text-xs text-emerald-600 font-semibold">SOLD</p>
                        </>
                      ) : (
                        <p className="text-xs text-slate-500 font-semibold">PASSED</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
