'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Radio, Gavel, Car, Clock, CheckCircle2, Loader2, Play, Square,
  SkipForward, Plus, Trash2, ChevronUp, ChevronDown, AlertCircle,
  RefreshCw, Trophy, ArrowRight
} from 'lucide-react'

interface Vehicle {
  id: string; make: string; model: string; year: number
  damage_type: string; images: string[]; mileage: number
}

interface CatalogLot {
  id: string; catalog_id: string; vehicle_id: string; lot_order: number
  status: 'pending' | 'active' | 'sold' | 'passed' | 'no_sale'
  starting_price: number; current_bid: number
  highest_bidder_id: string | null; highest_bidder_name: string | null
  end_time: string | null
  vehicle: Vehicle
}

interface Catalog {
  id: string; title: string; description: string
  status: 'scheduled' | 'active' | 'ended'
  scheduled_at: string; bid_increment: number
  current_lot_order: number
}

interface Bid {
  id: string; amount: number; bidder_name: string; created_at: string
}

function formatCurrency(n: number) { return n.toLocaleString('en-EG') + ' EGP' }

function Toast({ msg }: { msg: string }) {
  return (
    <div className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl font-semibold text-sm shadow-xl border border-slate-700">
      <CheckCircle2 className="w-4 h-4 text-emerald-400" />{msg}
    </div>
  )
}

function LOT_STATUS_BADGE({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-slate-100 text-slate-500',
    active: 'bg-emerald-100 text-emerald-700',
    sold: 'bg-blue-100 text-blue-700',
    passed: 'bg-red-100 text-red-600',
    no_sale: 'bg-amber-100 text-amber-700',
  }
  return <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${map[status] || 'bg-slate-100 text-slate-500'}`}>{status.toUpperCase()}</span>
}

export default function AdminCatalogPage() {
  const [catalogs, setCatalogs] = useState<Catalog[]>([])
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null)
  const [lots, setLots] = useState<CatalogLot[]>([])
  const [bids, setBids] = useState<Bid[]>([])
  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'create' | 'manage'>('list')

  // New catalog form
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newScheduledAt, setNewScheduledAt] = useState('')
  const [newBidIncrement, setNewBidIncrement] = useState('500')
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([])
  const [newStartingPrices, setNewStartingPrices] = useState<Record<string, string>>({})

  const selectedCatalog = catalogs.find(c => c.id === selectedCatalogId)
  const activeLot = lots.find(l => l.status === 'active')
  const activeBid = activeLot ? Math.max(activeLot.current_bid, activeLot.starting_price) : 0

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const loadCatalogs = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('auction_catalogs')
      .select('*')
      .order('scheduled_at', { ascending: false })
    setCatalogs((data || []) as Catalog[])
    if (!selectedCatalogId && data?.length) setSelectedCatalogId(data[0].id)
    setLoading(false)
  }, [selectedCatalogId])

  const loadLots = useCallback(async () => {
    if (!selectedCatalogId) return
    const supabase = createClient()
    const { data } = await supabase
      .from('catalog_lots')
      .select('*, vehicle:vehicles(id, make, model, year, damage_type, images, mileage)')
      .eq('catalog_id', selectedCatalogId)
      .order('lot_order')
    setLots((data || []) as CatalogLot[])
  }, [selectedCatalogId])

  const loadBids = useCallback(async () => {
    if (!activeLot) return
    const supabase = createClient()
    const { data } = await supabase
      .from('catalog_bids')
      .select('*, user:users(full_name)')
      .eq('lot_id', activeLot.id)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) {
      setBids(data.map((b: { id: string; amount: number; created_at: string; user: { full_name: string } | { full_name: string }[] | null }) => ({
        id: b.id, amount: b.amount, created_at: b.created_at,
        bidder_name: Array.isArray(b.user) ? b.user[0]?.full_name : b.user?.full_name || 'Bidder',
      })))
    }
  }, [activeLot])

  const loadAvailableVehicles = useCallback(async () => {
    const supabase = createClient()
    const { data: catalogLotVehicles } = await supabase.from('catalog_lots').select('vehicle_id').in('status', ['pending', 'active'])
    const usedIds = new Set((catalogLotVehicles || []).map((l: { vehicle_id: string }) => l.vehicle_id))
    const { data } = await supabase.from('vehicles').select('id, make, model, year, damage_type, images, mileage').eq('status', 'approved')
    setAvailableVehicles(((data || []) as Vehicle[]).filter(v => !usedIds.has(v.id)))
  }, [])

  useEffect(() => { loadCatalogs() }, [loadCatalogs])
  useEffect(() => { loadLots() }, [loadLots])
  useEffect(() => { loadBids() }, [loadBids])

  // Realtime
  useEffect(() => {
    if (!selectedCatalogId) return
    const supabase = createClient()
    const ch = supabase.channel(`admin-catalog-${selectedCatalogId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catalog_lots', filter: `catalog_id=eq.${selectedCatalogId}` }, () => { loadLots(); loadBids() })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'catalog_bids' }, () => loadBids())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [selectedCatalogId, loadLots, loadBids])

  async function createCatalog() {
    if (!newTitle || selectedVehicleIds.length === 0) return
    setProcessing(true)
    const supabase = createClient()
    const { data: catalog, error } = await supabase.from('auction_catalogs').insert({
      title: newTitle, description: newDesc,
      scheduled_at: newScheduledAt || new Date().toISOString(),
      bid_increment: parseInt(newBidIncrement) || 500,
      status: 'scheduled', current_lot_order: 1,
    }).select().single()

    if (error || !catalog) { showToast('Failed to create catalog'); setProcessing(false); return }

    // Insert lots in order
    const lotInserts = selectedVehicleIds.map((vid, i) => ({
      catalog_id: catalog.id, vehicle_id: vid, lot_order: i + 1,
      status: 'pending', current_bid: 0, highest_bidder_id: null,
      starting_price: parseInt(newStartingPrices[vid] || '1000'),
    }))
    await supabase.from('catalog_lots').insert(lotInserts)

    showToast('Catalog created!')
    setSelectedCatalogId(catalog.id)
    setView('manage')
    setNewTitle(''); setNewDesc(''); setSelectedVehicleIds([]); setNewStartingPrices({})
    loadCatalogs(); loadLots()
    setProcessing(false)
  }

  async function startCatalog() {
    if (!selectedCatalogId) return
    setProcessing(true)
    const supabase = createClient()
    // Start the catalog
    await supabase.from('auction_catalogs').update({ status: 'active', current_lot_order: 1 }).eq('id', selectedCatalogId)
    // Put first lot on block
    const firstLot = lots.find(l => l.lot_order === 1)
    if (firstLot) {
      const endTime = new Date(Date.now() + 90000).toISOString() // 90 seconds per lot default
      await supabase.from('catalog_lots').update({ status: 'active', end_time: endTime }).eq('id', firstLot.id)
    }
    showToast('Catalog is LIVE!')
    loadCatalogs(); loadLots()
    setProcessing(false)
  }

  async function advanceLot(action: 'sold' | 'pass') {
    if (!activeLot || !selectedCatalog) return
    setProcessing(true)
    const supabase = createClient()

    // Close current lot
    await supabase.from('catalog_lots').update({
      status: action === 'sold' ? 'sold' : 'no_sale',
      end_time: new Date().toISOString(),
    }).eq('id', activeLot.id)

    // Find next pending lot
    const nextLot = lots.filter(l => l.status === 'pending').sort((a, b) => a.lot_order - b.lot_order)[0]

    if (nextLot) {
      const endTime = new Date(Date.now() + 90000).toISOString()
      await supabase.from('catalog_lots').update({ status: 'active', end_time: endTime }).eq('id', nextLot.id)
      await supabase.from('auction_catalogs').update({ current_lot_order: nextLot.lot_order }).eq('id', selectedCatalogId)
      showToast(`Lot ${activeLot.lot_order} ${action === 'sold' ? 'SOLD' : 'PASSED'} → Lot ${nextLot.lot_order} now live`)
    } else {
      // Catalog done
      await supabase.from('auction_catalogs').update({ status: 'ended' }).eq('id', selectedCatalogId)
      showToast('🏁 Catalog complete!')
    }

    loadCatalogs(); loadLots(); loadBids()
    setProcessing(false)
  }

  async function extendLot(seconds: number) {
    if (!activeLot) return
    setProcessing(true)
    const supabase = createClient()
    const newEnd = new Date(new Date(activeLot.end_time || Date.now()).getTime() + seconds * 1000).toISOString()
    await supabase.from('catalog_lots').update({ end_time: newEnd }).eq('id', activeLot.id)
    showToast(`Extended by ${seconds}s`)
    loadLots()
    setProcessing(false)
  }

  async function deleteCatalog(id: string) {
    if (!confirm('Delete this catalog and all its lots?')) return
    const supabase = createClient()
    await supabase.from('catalog_lots').delete().eq('catalog_id', id)
    await supabase.from('auction_catalogs').delete().eq('id', id)
    showToast('Catalog deleted')
    if (selectedCatalogId === id) setSelectedCatalogId(null)
    loadCatalogs()
  }

  const inp = "w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"

  return (
    <div className="p-8">
      {toast && <Toast msg={toast} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Radio className="w-6 h-6 text-purple-600" />Catalog Auctions
          </h1>
          <p className="text-slate-500 text-sm mt-1">Copart-style sequential live bidding — multiple cars, one session</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { loadAvailableVehicles(); setView('create') }}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-colors">
            <Plus className="w-4 h-4" />New Catalog
          </button>
        </div>
      </div>

      {/* CREATE FORM */}
      {view === 'create' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 mb-6 max-w-2xl">
          <h2 className="font-bold text-slate-900 mb-5">Create New Catalog Auction</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Catalog Title</label>
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Weekly Salvage Auction — March 2026" className={inp} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description (optional)</label>
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} placeholder="Notes about this catalog..." className={inp + ' resize-none'} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Scheduled At</label>
                <input type="datetime-local" value={newScheduledAt} onChange={e => setNewScheduledAt(e.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Bid Increment (EGP)</label>
                <input type="number" value={newBidIncrement} onChange={e => setNewBidIncrement(e.target.value)} className={inp} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Select Vehicles ({selectedVehicleIds.length} selected)</label>
              {availableVehicles.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4 bg-slate-50 rounded-xl">No available approved vehicles</p>
              ) : (
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto border border-slate-200 rounded-xl p-2">
                  {availableVehicles.map(v => {
                    const isSelected = selectedVehicleIds.includes(v.id)
                    return (
                      <div key={v.id} className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                        onClick={() => {
                          setSelectedVehicleIds(prev => isSelected ? prev.filter(id => id !== v.id) : [...prev, v.id])
                          if (!isSelected && !newStartingPrices[v.id]) {
                            setNewStartingPrices(prev => ({ ...prev, [v.id]: '1000' }))
                          }
                        }}>
                        <div className="w-12 h-9 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                          {v.images?.[0] ? <img src={v.images[0]} alt="" className="w-full h-full object-cover" /> : <Car className="w-4 h-4 text-slate-300 m-auto" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-900 font-semibold text-sm truncate">{v.year} {v.make} {v.model}</p>
                          <p className="text-slate-400 text-xs capitalize">{v.damage_type?.replace(/_/g, ' ')}</p>
                        </div>
                        {isSelected && (
                          <input type="number" value={newStartingPrices[v.id] || ''} onChange={e => { e.stopPropagation(); setNewStartingPrices(prev => ({ ...prev, [v.id]: e.target.value })) }}
                            placeholder="Start EGP" onClick={e => e.stopPropagation()}
                            className="w-24 border border-indigo-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                        )}
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-indigo-500 flex-shrink-0" />}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={createCatalog} disabled={processing || !newTitle || selectedVehicleIds.length === 0}
                className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors">
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />}
                Create Catalog ({selectedVehicleIds.length} vehicles)
              </button>
              <button onClick={() => setView('list')} className="px-4 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" /></div>
      ) : catalogs.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl">
          <Radio className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="font-semibold text-slate-500">No catalog auctions yet</p>
          <p className="text-slate-400 text-sm mt-1">Create your first Copart-style sequential auction</p>
          <button onClick={() => { loadAvailableVehicles(); setView('create') }} className="mt-4 bg-purple-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors">
            Create First Catalog
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Catalog list */}
          <div className="xl:col-span-1">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Catalogs ({catalogs.length})</h2>
            <div className="flex flex-col gap-2">
              {catalogs.map(c => (
                <div key={c.id} onClick={() => { setSelectedCatalogId(c.id); setView('manage') }}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedCatalogId === c.id ? 'border-purple-500 bg-purple-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm truncate">{c.title}</p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {new Date(c.scheduled_at).toLocaleDateString('en-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${c.status === 'active' ? 'bg-emerald-100 text-emerald-700' : c.status === 'ended' ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'}`}>
                      {c.status === 'active' ? '● LIVE' : c.status === 'ended' ? 'Ended' : 'Scheduled'}
                    </span>
                    <button onClick={e => { e.stopPropagation(); deleteCatalog(c.id) }} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Catalog control panel */}
          {selectedCatalog && (
            <div className="xl:col-span-2 flex flex-col gap-5">

              {/* Header */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">{selectedCatalog.title}</h2>
                    {selectedCatalog.description && <p className="text-slate-500 text-sm mt-1">{selectedCatalog.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span>{lots.length} lots total</span>
                      <span>·</span>
                      <span>{lots.filter(l => l.status === 'sold').length} sold</span>
                      <span>·</span>
                      <span>{lots.filter(l => l.status === 'pending').length} remaining</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/catalog/${selectedCatalog.id}`} target="_blank"
                      className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-3 py-2 rounded-lg transition-colors">
                      View Live Page <ArrowRight className="w-3 h-3" />
                    </Link>
                    <button onClick={loadLots} className="p-2 text-slate-400 hover:text-slate-700 transition-colors">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Start button */}
                {selectedCatalog.status === 'scheduled' && (
                  <button onClick={startCatalog} disabled={processing || lots.length === 0}
                    className="mt-4 w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black py-4 rounded-xl text-base transition-colors">
                    {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                    Start Catalog Auction — Go Live
                  </button>
                )}
              </div>

              {/* Active lot control */}
              {activeLot && selectedCatalog.status === 'active' && (
                <div className="bg-slate-900 text-white rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="font-black text-sm text-emerald-400">LOT {activeLot.lot_order} — ON THE BLOCK</span>
                  </div>

                  <div className="flex gap-4 mb-4">
                    <div className="w-20 h-14 rounded-xl overflow-hidden bg-slate-700 flex-shrink-0">
                      {activeLot.vehicle?.images?.[0] ? <img src={activeLot.vehicle.images[0]} alt="" className="w-full h-full object-cover" /> : <Car className="w-4 h-4 text-slate-500 m-auto" />}
                    </div>
                    <div>
                      <h3 className="font-black text-lg">{activeLot.vehicle?.year} {activeLot.vehicle?.make} {activeLot.vehicle?.model}</h3>
                      <p className="text-3xl font-black text-emerald-400 mt-0.5">{formatCurrency(activeBid)}</p>
                      {activeLot.highest_bidder_name && (
                        <p className="text-slate-400 text-xs mt-0.5">Leader: <span className="text-white">{activeLot.highest_bidder_name}</span></p>
                      )}
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <button onClick={() => extendLot(30)} disabled={processing}
                      className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition-colors">
                      <Clock className="w-4 h-4" />+30s
                    </button>
                    <button onClick={() => extendLot(60)} disabled={processing}
                      className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition-colors">
                      <Clock className="w-4 h-4" />+60s
                    </button>
                    <button onClick={() => advanceLot('sold')} disabled={processing || !activeLot.highest_bidder_id}
                      className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black py-4 rounded-xl transition-colors">
                      {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />}
                      SOLD — Advance
                    </button>
                    <button onClick={() => advanceLot('pass')} disabled={processing}
                      className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-colors">
                      <SkipForward className="w-4 h-4" />Pass — Skip
                    </button>
                  </div>

                  {/* Live bid feed */}
                  <div className="bg-slate-800 rounded-xl overflow-hidden">
                    <p className="text-xs text-slate-400 font-bold uppercase px-3 py-2 border-b border-slate-700">Live Bids ({bids.length})</p>
                    <div className="max-h-32 overflow-y-auto">
                      {bids.length === 0 ? (
                        <p className="text-slate-600 text-xs text-center py-4">No bids yet</p>
                      ) : bids.map((bid, i) => (
                        <div key={bid.id} className={`flex items-center gap-3 px-3 py-2 border-b border-slate-700/50 ${i === 0 ? 'bg-emerald-900/20' : ''}`}>
                          <span className={`text-xs font-black ${i === 0 ? 'text-emerald-400' : 'text-slate-500'}`}>{i === 0 ? '★' : i + 1}</span>
                          <span className="text-xs text-slate-300 flex-1 truncate">{bid.bidder_name}</span>
                          <span className={`text-sm font-black ${i === 0 ? 'text-emerald-400' : 'text-slate-300'}`}>{formatCurrency(bid.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Lot list */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900">Lot Order</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {lots.map(lot => (
                    <div key={lot.id} className={`flex items-center gap-3 px-5 py-3.5 ${lot.status === 'active' ? 'bg-emerald-50' : ''}`}>
                      <span className="text-slate-400 text-sm font-bold w-6">{lot.lot_order}</span>
                      <div className="w-10 h-8 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                        {lot.vehicle?.images?.[0] ? <img src={lot.vehicle.images[0]} alt="" className="w-full h-full object-cover" /> : <Car className="w-3 h-3 text-slate-300 m-auto" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-900 font-semibold text-sm truncate">{lot.vehicle?.year} {lot.vehicle?.make} {lot.vehicle?.model}</p>
                        <p className="text-slate-400 text-xs">Start: {formatCurrency(lot.starting_price)}{lot.current_bid > 0 ? ` · Final: ${formatCurrency(lot.current_bid)}` : ''}</p>
                      </div>
                      <LOT_STATUS_BADGE status={lot.status} />
                      {lot.highest_bidder_name && lot.status === 'sold' && (
                        <span className="text-xs text-emerald-600 font-semibold truncate max-w-24">{lot.highest_bidder_name}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
