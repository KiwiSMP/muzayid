'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Radio, Gavel, Car, TrendingUp, Clock, CheckCircle2,
  ChevronRight, Loader2, Play, Square, SkipForward,
  Users, RefreshCw, AlertCircle, DollarSign
} from 'lucide-react'

interface Auction {
  id: string; status: string; start_time: string; end_time: string
  starting_price: number; current_highest_bid: number
  highest_bidder_id: string | null
  vehicle: { make: string; model: string; year: number; images: string[]; damage_type: string; mileage: number; condition_report: { run_drive_status?: string; reserve_price?: number } }
}

interface Bid {
  id: string; amount: number; created_at: string
  user: { full_name: string }
}

function formatCurrency(n: number) { return n.toLocaleString('en-EG') + ' EGP' }

function Countdown({ endTime }: { endTime: string }) {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    const calc = () => setLeft(Math.max(0, Math.floor((Date.parse(endTime) - Date.now()) / 1000)))
    calc(); const i = setInterval(calc, 1000); return () => clearInterval(i)
  }, [endTime])
  const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60), s = left % 60
  const urgent = left > 0 && left < 300
  return (
    <div className={`flex items-center gap-2 font-black text-4xl tabular-nums ${urgent ? 'text-red-500 animate-pulse' : 'text-slate-900'}`}>
      {String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
    </div>
  )
}

export default function LiveControlPage() {
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [bids, setBids] = useState<Bid[]>([])
  const [entryCount, setEntryCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const selected = auctions.find(a => a.id === selectedId)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3500) }

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('auctions')
      .select('*, vehicle:vehicles(make, model, year, images, damage_type, mileage, condition_report)')
      .in('status', ['draft', 'active', 'ended'])
      .order('start_time', { ascending: true })
    setAuctions((data || []) as Auction[])
    // Auto-select first active, else first draft
    if (!selectedId) {
      const active = (data || []).find((a: Auction) => a.status === 'active')
      const draft = (data || []).find((a: Auction) => a.status === 'draft')
      setSelectedId(active?.id || draft?.id || (data || [])[0]?.id || null)
    }
    setLoading(false)
  }, [selectedId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!selectedId) return
    async function loadBids() {
      const supabase = createClient()
      const { data: bidData } = await supabase
        .from('bids')
        .select('*, user:users(full_name)')
        .eq('auction_id', selectedId)
        .order('created_at', { ascending: false })
        .limit(20)
      setBids((bidData || []) as Bid[])
      const { count } = await supabase
        .from('auction_entries')
        .select('id', { count: 'exact' })
        .eq('auction_id', selectedId)
      setEntryCount(count || 0)
    }
    loadBids()

    // Realtime
    const supabase = createClient()
    const ch = supabase.channel(`live-${selectedId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids', filter: `auction_id=eq.${selectedId}` }, () => loadBids())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'auctions', filter: `id=eq.${selectedId}` }, () => { load(); loadBids() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [selectedId, load])

  async function setStatus(newStatus: string) {
    if (!selectedId) return
    setProcessing(true)
    const supabase = createClient()
    const updates: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'active' && selected?.status === 'draft') {
      updates.start_time = new Date().toISOString()
    }
    await supabase.from('auctions').update(updates).eq('id', selectedId)
    showToast(`Auction set to ${newStatus}`)
    await load()
    setProcessing(false)
  }

  async function extendTime(minutes: number) {
    if (!selected) return
    setProcessing(true)
    const supabase = createClient()
    const newEnd = new Date(new Date(selected.end_time).getTime() + minutes * 60000).toISOString()
    await supabase.from('auctions').update({ end_time: newEnd }).eq('id', selectedId)
    showToast(`Extended by ${minutes} minutes`)
    await load()
    setProcessing(false)
  }

  const currentBid = selected ? Math.max(selected.current_highest_bid, selected.starting_price) : 0

  return (
    <div className="p-8">
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl font-semibold text-sm shadow-xl">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />{toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Radio className="w-6 h-6 text-indigo-600" />Live Auction Controller
          </h1>
          <p className="text-slate-500 text-sm mt-1">God Mode — full control over all active auctions</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load()} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors">
            <RefreshCw className="w-4 h-4" />Refresh
          </button>
          <Link href="/admin/auctions/new"
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-xl text-sm shadow-sm transition-colors">
            <Gavel className="w-4 h-4" />New Auction
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
      ) : auctions.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl">
          <Gavel className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="font-semibold text-slate-500">No active or draft auctions</p>
          <Link href="/admin/auctions/new" className="mt-4 inline-block bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
            Create First Auction
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Auction selector */}
          <div className="xl:col-span-1">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Auction Queue</h2>
            <div className="flex flex-col gap-2">
              {auctions.map(a => {
                const isLive = a.status === 'active'
                const isDraft = a.status === 'draft'
                return (
                  <button key={a.id} onClick={() => setSelectedId(a.id)}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all w-full ${selectedId === a.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    <div className="w-12 h-10 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                      {a.vehicle?.images?.[0] ? <img src={a.vehicle.images[0]} alt="" className="w-full h-full object-cover" /> : <Car className="w-4 h-4 text-slate-300 m-auto" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-900 font-semibold text-sm truncate">{a.vehicle?.year} {a.vehicle?.make} {a.vehicle?.model}</p>
                      <p className="text-slate-400 text-xs">{formatCurrency(Math.max(a.current_highest_bid, a.starting_price))}</p>
                    </div>
                    <div className="flex-shrink-0">
                      {isLive && <span className="flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />LIVE</span>}
                      {isDraft && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">Draft</span>}
                      {a.status === 'ended' && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">Ended</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Main control */}
          {selected && (
            <div className="xl:col-span-2 flex flex-col gap-5">
              {/* On the Block */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selected.status === 'active'
                      ? <><span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" /><span className="text-emerald-400 font-bold text-sm">ON THE BLOCK</span></>
                      : selected.status === 'draft'
                        ? <><Clock className="w-4 h-4 text-slate-400" /><span className="text-slate-300 font-bold text-sm">DRAFT — NOT LIVE</span></>
                        : <><span className="text-slate-400 font-bold text-sm">AUCTION ENDED</span></>
                    }
                  </div>
                  {selected.status === 'active' && <Countdown endTime={selected.end_time} />}
                </div>

                <div className="p-6">
                  <div className="flex gap-5">
                    <div className="w-32 h-24 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                      {selected.vehicle?.images?.[0] ? <img src={selected.vehicle.images[0]} alt="" className="w-full h-full object-cover" /> : <Car className="w-8 h-8 text-slate-300 m-auto" />}
                    </div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-black text-slate-900">{selected.vehicle?.year} {selected.vehicle?.make} {selected.vehicle?.model}</h2>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="text-sm text-slate-500">{selected.vehicle?.mileage?.toLocaleString()} km</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-sm text-slate-500 capitalize">{selected.vehicle?.damage_type?.replace(/_/g,' ')}</span>
                        {selected.vehicle?.condition_report?.run_drive_status === 'starts_drives' && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">Starts & Drives</span>}
                        {selected.vehicle?.condition_report?.run_drive_status === 'engine_starts' && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Engine Starts</span>}
                        {selected.vehicle?.condition_report?.run_drive_status === 'non_runner' && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">Non-Runner</span>}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-slate-100">
                    <div className="text-center">
                      <p className="text-slate-400 text-xs uppercase font-bold mb-1">Current Bid</p>
                      <p className="text-2xl font-black text-emerald-600">{formatCurrency(currentBid)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-400 text-xs uppercase font-bold mb-1">Reserve</p>
                      <p className="text-2xl font-black text-slate-900">
                        {selected.vehicle?.condition_report?.reserve_price ? formatCurrency(selected.vehicle.condition_report.reserve_price) : <span className="text-slate-300 font-medium text-base">None set</span>}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-400 text-xs uppercase font-bold mb-1">Entry Fee Paid</p>
                      <p className="text-2xl font-black text-slate-900">{entryCount}</p>
                    </div>
                  </div>

                  {/* Reserve met indicator */}
                  {selected.vehicle?.condition_report?.reserve_price && (
                    <div className={`mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold ${currentBid >= selected.vehicle.condition_report.reserve_price ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                      {currentBid >= selected.vehicle.condition_report.reserve_price
                        ? <><CheckCircle2 className="w-4 h-4" />Reserve Price Met — Vehicle will sell</>
                        : <><AlertCircle className="w-4 h-4" />Reserve Not Met — Need {formatCurrency(selected.vehicle.condition_report.reserve_price - currentBid)} more</>
                      }
                    </div>
                  )}
                </div>
              </div>

              {/* Control buttons */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                <h3 className="font-bold text-slate-900 mb-4">Auction Controls</h3>
                <div className="grid grid-cols-2 gap-3">
                  {selected.status === 'draft' && (
                    <button onClick={() => setStatus('active')} disabled={processing}
                      className="col-span-2 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-5 rounded-xl text-lg transition-colors shadow-sm">
                      {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                      Start Auction — Go Live Now
                    </button>
                  )}
                  {selected.status === 'active' && (
                    <>
                      <button onClick={() => extendTime(5)} disabled={processing}
                        className="flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold py-4 rounded-xl transition-colors">
                        <Clock className="w-4 h-4" />+5 Min
                      </button>
                      <button onClick={() => extendTime(10)} disabled={processing}
                        className="flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold py-4 rounded-xl transition-colors">
                        <Clock className="w-4 h-4" />+10 Min
                      </button>
                      <button onClick={() => setStatus('ended')} disabled={processing}
                        className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-colors shadow-sm">
                        {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                        Mark Sold / End
                      </button>
                      <button onClick={() => setStatus('draft')} disabled={processing}
                        className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-xl transition-colors">
                        Back to Draft
                      </button>
                    </>
                  )}
                  {selected.status === 'ended' && (
                    <button onClick={() => setStatus('settled')} disabled={processing}
                      className="col-span-2 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-xl text-base transition-colors shadow-sm">
                      {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Mark as Settled (Payment Received)
                    </button>
                  )}
                </div>
              </div>

              {/* Bid feed */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">Live Bid Feed</h3>
                  <span className="text-xs text-slate-400">{bids.length} bids total</span>
                </div>
                {bids.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-sm">No bids yet</div>
                ) : (
                  <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                    {bids.map((bid, i) => (
                      <div key={bid.id} className={`flex items-center gap-4 px-6 py-3 ${i === 0 ? 'bg-emerald-50' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${i === 0 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          {i === 0 ? '★' : i + 1}
                        </div>
                        <div className="flex-1">
                          <p className={`font-semibold text-sm ${i === 0 ? 'text-emerald-700' : 'text-slate-800'}`}>{Array.isArray(bid.user) ? bid.user[0]?.full_name : (bid.user as { full_name: string } | null)?.full_name || 'Unknown'}</p>
                          <p className="text-slate-400 text-xs">{new Date(bid.created_at).toLocaleTimeString('en-EG', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}</p>
                        </div>
                        <p className={`font-black text-base ${i === 0 ? 'text-emerald-600' : 'text-slate-700'}`}>{formatCurrency(bid.amount)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
