'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Gavel, Clock, AlertTriangle, Shield, ChevronLeft,
  ChevronRight, Eye, Key, Gauge, MapPin, FileText,
  CheckCircle2, XCircle, AlertCircle, Loader2,
  Bell, Car, Wrench, Hash, Calendar, Info,
  ZoomIn
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/layout/Navbar'

interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  damage_type: string
  mileage: number
  description: string
  images: string[]
  fines_cleared: boolean
  condition_report: {
    exterior: string[]
    interior: string[]
    mechanical: string[]
    missing_parts: string[]
    notes: string
    primary_damage?: string
    secondary_damage?: string
    run_drive_status?: 'starts_drives' | 'engine_starts' | 'non_runner'
    odometer_actual?: boolean
    keys_available?: boolean
    chassis_number?: string
    license_status?: 'active' | 'expired' | 'cancelled'
    location?: string
    lot_number?: string
    lane?: string
  }
}

interface Auction {
  id: string
  vehicle_id: string
  vehicle: Vehicle
  start_time: string
  end_time: string
  starting_price: number
  current_highest_bid: number
  highest_bidder_id: string | null
  status: string
}

interface UserProfile {
  id: string
  full_name: string
  bidding_tier: number
  is_verified: boolean
  deposit_balance: number
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP', minimumFractionDigits: 0 }).format(n)
}

function useCountdown(endTime: string) {
  const [remaining, setRemaining] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0, isUrgent: false, isExpired: false })

  useEffect(() => {
    function calc() {
      const total = Date.parse(endTime) - Date.now()
      if (total <= 0) return setRemaining(r => ({ ...r, total: 0, isExpired: true }))
      setRemaining({
        total,
        days: Math.floor(total / 86400000),
        hours: Math.floor((total / 3600000) % 24),
        minutes: Math.floor((total / 60000) % 60),
        seconds: Math.floor((total / 1000) % 60),
        isUrgent: total <= 3600000,
        isExpired: false,
      })
    }
    calc()
    const i = setInterval(calc, 1000)
    return () => clearInterval(i)
  }, [endTime])

  return remaining
}

function RunDriveBadge({ status }: { status?: string }) {
  if (!status) return null
  const map = {
    starts_drives: { label: 'Starts & Drives', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
    engine_starts: { label: 'Engine Starts Only', color: 'bg-amber-100 text-amber-800', icon: AlertCircle },
    non_runner: { label: 'Non-Runner', color: 'bg-red-100 text-red-800', icon: XCircle },
  }
  const item = map[status as keyof typeof map]
  if (!item) return null
  const Icon = item.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${item.color}`}>
      <Icon className="w-4 h-4" />{item.label}
    </span>
  )
}

function DamageTypeLabel(type: string) {
  const map: Record<string, string> = {
    front_collision: 'Front Collision', rear_collision: 'Rear Collision',
    side_collision: 'Side Collision', rollover: 'Rollover', flood: 'Flood Damage',
    fire: 'Fire Damage', hail: 'Hail Damage', theft_recovery: 'Theft Recovery',
    mechanical: 'Mechanical', other: 'Other',
  }
  return map[type] || type
}

export default function AuctionDetailPage() {
  const params = useParams()
  const auctionId = params.id as string

  const [auction, setAuction] = useState<Auction | null>(null)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentImage, setCurrentImage] = useState(0)
  const [bidAmount, setBidAmount] = useState('')
  const [bidding, setBidding] = useState(false)
  const [bidError, setBidError] = useState('')
  const [bidSuccess, setBidSuccess] = useState(false)
  const [hasEntryFee, setHasEntryFee] = useState(false)
  const [payingEntry, setPayingEntry] = useState(false)
  const [reminded, setReminded] = useState(false)
  const [preBidAmount, setPreBidAmount] = useState('')
  const [placingPreBid, setPlacingPreBid] = useState(false)
  const [preBidSuccess, setPreBidSuccess] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const countdown = useCountdown(auction?.end_time || new Date().toISOString())
  const isActive = auction?.status === 'active'
  const isDraft = auction?.status === 'draft'
  const currentBid = auction ? Math.max(auction.current_highest_bid, auction.starting_price) : 0
  const isWinning = user && auction?.highest_bidder_id === user.id
  const cr = auction?.vehicle?.condition_report

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [auctionRes, userRes] = await Promise.all([
        supabase.from('auctions').select(`*, vehicle:vehicles(*)`).eq('id', auctionId).single(),
        supabase.auth.getUser(),
      ])

      if (auctionRes.data) setAuction(auctionRes.data as Auction)

      if (userRes.data.user) {
        const { data: profile } = await supabase.from('users').select('*').eq('id', userRes.data.user.id).single()
        if (profile) {
          setUser(profile as UserProfile)
          // Check entry fee
          const { data: entry } = await supabase
            .from('auction_entries')
            .select('id')
            .eq('auction_id', auctionId)
            .eq('user_id', userRes.data.user.id)
            .single()
          setHasEntryFee(!!entry)
        }
      }
      setLoading(false)
    }
    load()

    // Subscribe to realtime updates
    const supabase = createClient()
    const channel = supabase
      .channel(`auction-${auctionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'auctions', filter: `id=eq.${auctionId}` },
        payload => setAuction(prev => prev ? { ...prev, ...payload.new } : prev))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [auctionId])

  async function handlePayEntryFee() {
    if (!user || !auction) return
    setPayingEntry(true)
    setBidError('')
    const supabase = createClient()
    try {
      // Insert entry record
      const { error: entryError } = await supabase.from('auction_entries').insert({ auction_id: auctionId, user_id: user.id })
      if (entryError) throw entryError
      // Record transaction
      await supabase.from('transactions').insert({ user_id: user.id, type: 'entry_fee', amount: 200, status: 'completed', auction_id: auctionId })
      setHasEntryFee(true)
    } catch (err: unknown) {
      setBidError(err instanceof Error ? err.message : 'Failed to pay entry fee')
    } finally {
      setPayingEntry(false)
    }
  }

  async function handleBid() {
    if (!user || !auction || !bidAmount) return
    setBidding(true)
    setBidError('')
    setBidSuccess(false)
    const supabase = createClient()
    try {
      const amount = parseFloat(bidAmount.replace(/,/g, ''))
      if (isNaN(amount) || amount <= 0) throw new Error('Please enter a valid bid amount.')
      if (amount <= currentBid) throw new Error(`Bid must be higher than current bid of ${formatCurrency(currentBid)}.`)
      const { error } = await supabase.from('bids').insert({ auction_id: auctionId, bidder_id: user.id, amount })
      if (error) throw new Error(error.message)
      setBidSuccess(true)
      setBidAmount('')
      setTimeout(() => setBidSuccess(false), 3000)
    } catch (err: unknown) {
      setBidError(err instanceof Error ? err.message : 'Bid failed. Please try again.')
    } finally {
      setBidding(false)
    }
  }

  async function handlePreBid() {
    if (!user || !auction || !preBidAmount) return
    setPlacingPreBid(true)
    const supabase = createClient()
    try {
      const amount = parseFloat(preBidAmount.replace(/,/g, ''))
      if (isNaN(amount) || amount <= 0) throw new Error('Please enter a valid amount.')
      await supabase.from('bids').insert({ auction_id: auctionId, bidder_id: user.id, amount })
      setPreBidSuccess(true)
      setPreBidAmount('')
    } catch (err: unknown) {
      setBidError(err instanceof Error ? err.message : 'Pre-bid failed.')
    } finally {
      setPlacingPreBid(false)
    }
  }

  const images = auction?.vehicle?.images || []
  const auctionDate = auction ? new Date(auction.start_time) : null

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1E3A5F]" />
      </div>
    )
  }

  if (!auction) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500">Auction not found.</p>
          <Link href="/" className="text-[#1E3A5F] font-semibold mt-2 inline-block">← Back to auctions</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Navbar */}
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* Image Gallery */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="relative aspect-video bg-slate-100">
                {images.length > 0 ? (
                  <>
                    <img src={images[currentImage]} alt="Vehicle" className="w-full h-full object-cover" />
                    <button onClick={() => setLightboxOpen(true)} className="absolute top-3 right-3 bg-black/50 text-white p-2 rounded-lg hover:bg-black/70 transition-colors">
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    {images.length > 1 && (
                      <>
                        <button onClick={() => setCurrentImage(i => (i - 1 + images.length) % images.length)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-lg hover:bg-black/70">
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button onClick={() => setCurrentImage(i => (i + 1) % images.length)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-lg hover:bg-black/70">
                          <ChevronRight className="w-5 h-5" />
                        </button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                          {images.map((_, i) => (
                            <button key={i} onClick={() => setCurrentImage(i)}
                              className={`w-2 h-2 rounded-full transition-colors ${i === currentImage ? 'bg-white' : 'bg-white/50'}`} />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Car className="w-20 h-20 text-slate-200" /></div>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 p-3 overflow-x-auto">
                  {images.map((img, i) => (
                    <button key={i} onClick={() => setCurrentImage(i)}
                      className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-colors ${i === currentImage ? 'border-[#1E3A5F]' : 'border-transparent'}`}>
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Header */}
            <div>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-3xl font-black text-slate-900">
                    {auction.vehicle.year} {auction.vehicle.make} {auction.vehicle.model}
                  </h1>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-700 text-sm font-semibold px-3 py-1 rounded-full">
                      <AlertTriangle className="w-3.5 h-3.5" />{DamageTypeLabel(auction.vehicle.damage_type)}
                    </span>
                    {auction.vehicle.fines_cleared && (
                      <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-sm font-semibold px-3 py-1 rounded-full">
                        <Shield className="w-3.5 h-3.5" />Fines Cleared
                      </span>
                    )}
                    <RunDriveBadge status={cr?.run_drive_status} />
                  </div>
                </div>
                <div className={`text-right flex-shrink-0 ${isActive ? '' : 'opacity-70'}`}>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">{isActive ? 'Current Bid' : isDraft ? 'Starting Price' : 'Final Price'}</p>
                  <p className="text-3xl font-black text-emerald-600">{formatCurrency(currentBid)}</p>
                </div>
              </div>
            </div>

            {/* ── WHEN TO SHOW UP ── */}
            {auctionDate && (
              <div className="bg-[#1E3A5F] text-white rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                  <h2 className="font-bold text-lg">When To Show Up</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Auction Date</p>
                    <p className="font-bold">{auctionDate.toLocaleDateString('en-EG', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Start Time</p>
                    <p className="font-bold">{auctionDate.toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  {cr?.lane && <div><p className="text-xs text-slate-400 mb-1">Lane / Ring</p><p className="font-bold">{cr.lane}</p></div>}
                  {cr?.lot_number && <div><p className="text-xs text-slate-400 mb-1">Lot / Run #</p><p className="font-bold text-emerald-400">#{cr.lot_number}</p></div>}
                </div>

                {/* Countdown */}
                {!countdown.isExpired && (
                  <div className={`rounded-xl p-4 mb-5 ${countdown.isUrgent ? 'bg-orange-500' : 'bg-white/10'}`}>
                    <p className="text-xs font-medium mb-2 text-slate-200">{isActive ? '⏱ Ends in' : '📅 Starts in'}</p>
                    <div className="flex items-center gap-3">
                      {countdown.days > 0 && (
                        <div className="text-center"><p className="text-3xl font-black tabular-nums">{countdown.days}</p><p className="text-xs text-slate-300">days</p></div>
                      )}
                      <div className="text-center"><p className="text-3xl font-black tabular-nums">{String(countdown.hours).padStart(2, '0')}</p><p className="text-xs text-slate-300">hrs</p></div>
                      <p className="text-2xl font-bold">:</p>
                      <div className="text-center"><p className="text-3xl font-black tabular-nums">{String(countdown.minutes).padStart(2, '0')}</p><p className="text-xs text-slate-300">min</p></div>
                      <p className="text-2xl font-bold">:</p>
                      <div className="text-center"><p className="text-3xl font-black tabular-nums">{String(countdown.seconds).padStart(2, '0')}</p><p className="text-xs text-slate-300">sec</p></div>
                    </div>
                    {countdown.isUrgent && <p className="text-xs mt-2 font-bold">⚡ Anti-sniper active — bids in final 60s extend auction by 2 minutes</p>}
                  </div>
                )}

                <button
                  onClick={() => setReminded(true)}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors ${reminded ? 'bg-emerald-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'}`}
                >
                  {reminded ? <><CheckCircle2 className="w-4 h-4" /> Reminder Set!</> : <><Bell className="w-4 h-4" /> Remind Me 15 Min Before</>}
                </button>
              </div>
            )}

            {/* ── BRUTAL TRANSPARENCY ── */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-5">
                <Eye className="w-5 h-5 text-red-500" />
                <h2 className="font-bold text-xl text-slate-900">Brutal Transparency</h2>
                <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">No Surprises</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <Gauge className="w-5 h-5 text-slate-500 mx-auto mb-1" />
                  <p className="text-xs text-slate-400">Odometer</p>
                  <p className="font-bold text-slate-900">{auction.vehicle.mileage.toLocaleString()} km</p>
                  {cr?.odometer_actual === false && <p className="text-xs text-red-500 font-medium">Not Actual</p>}
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <Key className="w-5 h-5 text-slate-500 mx-auto mb-1" />
                  <p className="text-xs text-slate-400">Keys</p>
                  <p className={`font-bold ${cr?.keys_available ? 'text-emerald-600' : 'text-red-500'}`}>
                    {cr?.keys_available === undefined ? '—' : cr.keys_available ? 'Available' : 'No Keys'}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <Shield className="w-5 h-5 text-slate-500 mx-auto mb-1" />
                  <p className="text-xs text-slate-400">Fines</p>
                  <p className={`font-bold text-sm ${auction.vehicle.fines_cleared ? 'text-emerald-600' : 'text-red-500'}`}>
                    {auction.vehicle.fines_cleared ? 'Cleared' : 'Buyer Assumes'}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <Car className="w-5 h-5 text-slate-500 mx-auto mb-1" />
                  <p className="text-xs text-slate-400">License</p>
                  <p className={`font-bold text-sm capitalize ${cr?.license_status === 'active' ? 'text-emerald-600' : cr?.license_status === 'expired' ? 'text-amber-600' : 'text-red-500'}`}>
                    {cr?.license_status || '—'}
                  </p>
                </div>
              </div>

              {/* Primary & Secondary Damage */}
              {(cr?.primary_damage || cr?.secondary_damage) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  {cr?.primary_damage && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">Primary Damage</p>
                      <p className="text-sm text-red-800 font-medium">{cr.primary_damage}</p>
                    </div>
                  )}
                  {cr?.secondary_damage && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                      <p className="text-xs font-bold text-orange-700 uppercase tracking-wide mb-1">Secondary Damage</p>
                      <p className="text-sm text-orange-800 font-medium">{cr.secondary_damage}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Damage lists */}
              {[
                { title: 'Exterior Damage', items: cr?.exterior || [], icon: Car, color: 'text-red-500' },
                { title: 'Interior Damage', items: cr?.interior || [], icon: Eye, color: 'text-orange-500' },
                { title: 'Mechanical Issues', items: cr?.mechanical || [], icon: Wrench, color: 'text-amber-500' },
                { title: 'Missing Parts', items: cr?.missing_parts || [], icon: AlertTriangle, color: 'text-slate-500' },
              ].filter(s => s.items.length > 0).map(section => (
                <div key={section.title} className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <section.icon className={`w-4 h-4 ${section.color}`} />
                    <h3 className="font-semibold text-slate-800 text-sm">{section.title}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {section.items.map((item, i) => (
                      <span key={i} className="bg-slate-100 text-slate-700 text-xs px-3 py-1 rounded-full">{item}</span>
                    ))}
                  </div>
                </div>
              ))}

              {cr?.notes && (
                <div className="bg-slate-50 rounded-xl p-4 mt-4">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-1">Inspector Notes</p>
                  <p className="text-sm text-slate-700">{cr.notes}</p>
                </div>
              )}

              {auction.vehicle.description && (
                <div className="mt-4">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-1">Description</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{auction.vehicle.description}</p>
                </div>
              )}
            </div>

            {/* ── LEGAL & PAPERWORK ── */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-5">
                <FileText className="w-5 h-5 text-[#1E3A5F]" />
                <h2 className="font-bold text-xl text-slate-900">Legal &amp; Paperwork</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cr?.chassis_number && (
                  <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                    <Hash className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase">Chassis / VIN</p>
                      <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">{cr.chassis_number}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Run your own background check</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                  <Shield className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Fines (Mokhalafat)</p>
                    <p className={`font-bold text-sm mt-0.5 ${auction.vehicle.fines_cleared ? 'text-emerald-600' : 'text-red-600'}`}>
                      {auction.vehicle.fines_cleared ? 'Sold Clear of Fines' : 'Buyer Assumes All Fines'}
                    </p>
                  </div>
                </div>
                {cr?.license_status && (
                  <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                    <FileText className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase">License Status</p>
                      <p className={`font-bold text-sm mt-0.5 capitalize ${cr.license_status === 'active' ? 'text-emerald-600' : cr.license_status === 'expired' ? 'text-amber-600' : 'text-red-600'}`}>
                        {cr.license_status === 'active' ? 'Active Registration' : cr.license_status === 'expired' ? 'Registration Expired' : 'Permanently Cancelled'}
                      </p>
                    </div>
                  </div>
                )}
                {cr?.location && (
                  <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase">Current Location</p>
                      <p className="font-bold text-slate-900 text-sm mt-0.5">{cr.location}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Factor in towing costs</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN — Bidding */}
          <div className="flex flex-col gap-4 lg:self-start lg:sticky lg:top-24">

            {/* Live Bid Panel */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                  {isActive ? 'Current Bid' : isDraft ? 'Starting Price' : 'Final Price'}
                </p>
                {isActive && <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />Live</span>}
              </div>
              <p className="text-4xl font-black text-slate-900 mb-1">{formatCurrency(currentBid)}</p>
              {isWinning && (
                <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-semibold mb-3">
                  <CheckCircle2 className="w-4 h-4" /> You are winning this auction!
                </div>
              )}

              <div className="border-t border-slate-100 pt-4 mt-3">
                {/* Not logged in */}
                {!user && (
                  <div className="text-center py-4">
                    <p className="text-slate-500 text-sm mb-4">Sign in to place a bid</p>
                    <Link href={`/auth/login?redirect=/auctions/${auctionId}`}
                      className="block w-full bg-[#1E3A5F] text-white font-semibold py-3 rounded-xl text-center hover:bg-[#162d4a] transition-colors">
                      Sign In to Bid
                    </Link>
                    <Link href="/auth/register" className="block w-full mt-2 text-sm text-slate-500 hover:text-slate-700 py-2">
                      Register free →
                    </Link>
                  </div>
                )}

                {/* No deposit */}
                {user && user.bidding_tier === 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                    <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                    <p className="font-semibold text-amber-800 text-sm mb-1">Deposit Required</p>
                    <p className="text-amber-700 text-xs mb-3">You need a deposit to unlock bidding.</p>
                    <Link href="/onboarding/deposit" className="block w-full bg-amber-500 text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-amber-600 transition-colors">
                      Make a Deposit
                    </Link>
                  </div>
                )}

                {/* Active auction — has deposit */}
                {user && user.bidding_tier > 0 && isActive && (
                  <>
                    {!hasEntryFee ? (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="font-semibold text-slate-800 text-sm mb-1 flex items-center gap-2">
                          <Info className="w-4 h-4 text-blue-500" /> Entry Fee Required
                        </p>
                        <p className="text-slate-500 text-xs mb-3">Pay a one-time 200 EGP fee to unlock bidding on this auction.</p>
                        <button onClick={handlePayEntryFee} disabled={payingEntry}
                          className="w-full bg-[#1E3A5F] text-white font-semibold py-3 rounded-xl hover:bg-[#162d4a] transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                          {payingEntry && <Loader2 className="w-4 h-4 animate-spin" />}
                          Pay 200 EGP Entry Fee
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {bidError && (
                          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 text-xs">
                            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{bidError}
                          </div>
                        )}
                        {bidSuccess && (
                          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-3 py-2.5 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Bid placed successfully!
                          </div>
                        )}
                        <div>
                          <label className="text-xs font-medium text-slate-500 mb-1 block">Your Bid (EGP)</label>
                          <input
                            type="number" value={bidAmount} onChange={e => setBidAmount(e.target.value)}
                            placeholder={`Min: ${formatCurrency(currentBid + 500)}`}
                            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <button onClick={handleBid} disabled={bidding || !bidAmount}
                          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-4 rounded-xl text-lg transition-colors flex items-center justify-center gap-2">
                          {bidding && <Loader2 className="w-5 h-5 animate-spin" />}
                          {bidding ? 'Placing Bid...' : 'Place Bid'}
                        </button>
                        <p className="text-xs text-slate-400 text-center">
                          Tier {user.bidding_tier} · Max bid: {user.bidding_tier === 1 ? '100,000 EGP' : user.bidding_tier === 2 ? '300,000 EGP' : 'Unlimited'}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* Draft auction — pre-bid */}
                {user && user.bidding_tier > 0 && isDraft && (
                  <div className="flex flex-col gap-3">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                      <p className="font-semibold mb-0.5">Pre-Bid Available</p>
                      <p>Set your maximum bid now. When the auction goes live, the system will bid on your behalf automatically.</p>
                    </div>
                    {preBidSuccess ? (
                      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-3 py-3 text-sm font-semibold">
                        <CheckCircle2 className="w-4 h-4" /> Maximum pre-bid set!
                      </div>
                    ) : (
                      <>
                        <input type="number" value={preBidAmount} onChange={e => setPreBidAmount(e.target.value)}
                          placeholder="Enter maximum bid (EGP)"
                          className="w-full border border-slate-300 rounded-xl px-4 py-3 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <button onClick={handlePreBid} disabled={placingPreBid || !preBidAmount}
                          className="w-full bg-[#1E3A5F] text-white font-semibold py-3 rounded-xl hover:bg-[#162d4a] transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                          {placingPreBid && <Loader2 className="w-4 h-4 animate-spin" />}
                          Set Maximum Pre-Bid
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Ended */}
                {auction.status === 'ended' && (
                  <div className="text-center py-2">
                    <p className="font-bold text-slate-500">This auction has ended.</p>
                    <p className="text-sm text-slate-400 mt-1">Final price: {formatCurrency(currentBid)}</p>
                  </div>
                )}
              </div>

              {/* Buyer's premium estimate */}
              {isActive && currentBid > 0 && (
                <div className="border-t border-slate-100 mt-4 pt-4">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-2">Estimated Total if You Win</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-slate-600"><span>Hammer Price</span><span>{formatCurrency(currentBid)}</span></div>
                    <div className="flex justify-between text-slate-600">
                      <span>Buyer&apos;s Premium</span>
                      <span>{formatCurrency(currentBid < 100000 ? 5000 : currentBid <= 400000 ? currentBid * 0.05 : currentBid * 0.04)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600"><span>Admin Fee</span><span>{formatCurrency(750)}</span></div>
                    <div className="flex justify-between font-bold text-slate-900 border-t border-slate-100 pt-1 mt-1">
                      <span>Total Due</span>
                      <span className="text-emerald-600">{formatCurrency(currentBid + (currentBid < 100000 ? 5000 : currentBid <= 400000 ? currentBid * 0.05 : currentBid * 0.04) + 750)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick specs */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="font-bold text-slate-900 mb-4">Quick Specs</h3>
              <div className="flex flex-col gap-2.5 text-sm">
                {[
                  { label: 'Make', value: auction.vehicle.make },
                  { label: 'Model', value: auction.vehicle.model },
                  { label: 'Year', value: String(auction.vehicle.year) },
                  { label: 'Mileage', value: `${auction.vehicle.mileage.toLocaleString()} km` },
                  { label: 'Damage', value: DamageTypeLabel(auction.vehicle.damage_type) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-slate-400">{label}</span>
                    <span className="font-medium text-slate-900">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && images.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={() => setLightboxOpen(false)}>
          <button className="absolute top-4 right-4 text-white text-2xl font-bold w-10 h-10 flex items-center justify-center" onClick={() => setLightboxOpen(false)}>✕</button>
          <img src={images[currentImage]} alt="Vehicle" className="max-w-full max-h-full object-contain" onClick={e => e.stopPropagation()} />
          {images.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); setCurrentImage(i => (i - 1 + images.length) % images.length) }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-white/20 hover:bg-white/30 w-12 h-12 rounded-full flex items-center justify-center">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button onClick={e => { e.stopPropagation(); setCurrentImage(i => (i + 1) % images.length) }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-white/20 hover:bg-white/30 w-12 h-12 rounded-full flex items-center justify-center">
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
