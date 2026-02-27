'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Plus, Gavel, Loader2, TrendingUp, Eye } from 'lucide-react'

interface AuctionRow {
  id: string; status: string; start_time: string; end_time: string
  starting_price: number; current_highest_bid: number; created_at: string
  bid_count?: number
  vehicle: { make: string; model: string; year: number; images: string[]; damage_type: string } | null
}

function formatCurrency(n: number) { return n.toLocaleString('en-EG') + ' EGP' }

function Badge({ label, variant }: { label: string; variant: 'green'|'amber'|'red'|'slate'|'blue'|'purple' }) {
  const cls = { green:'bg-emerald-100 text-emerald-700', amber:'bg-amber-100 text-amber-700', red:'bg-red-100 text-red-700', slate:'bg-slate-100 text-slate-600', blue:'bg-blue-100 text-blue-700', purple:'bg-purple-100 text-purple-700' }
  return <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${cls[variant]}`}>{label}</span>
}

export default function AuctionsPage() {
  const [auctions, setAuctions] = useState<AuctionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [updating, setUpdating] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  async function load() {
    const supabase = createClient()
    const { data } = await supabase
      .from('auctions')
      .select('*, vehicle:vehicles(make, model, year, images, damage_type)')
      .order('created_at', { ascending: false })
    const ids = (data || []).map((a: { id: string }) => a.id)
    const bidCounts: Record<string, number> = {}
    if (ids.length) {
      const { data: bids } = await supabase.from('bids').select('auction_id').in('auction_id', ids)
      for (const b of (bids || [])) { bidCounts[b.auction_id] = (bidCounts[b.auction_id] || 0) + 1 }
    }
    setAuctions(((data || []) as AuctionRow[]).map(a => ({ ...a, bid_count: bidCounts[a.id] || 0 })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function updateStatus(id: string, status: string) {
    setUpdating(id)
    const supabase = createClient()
    await supabase.from('auctions').update({ status }).eq('id', id)
    setToast(`Set to ${status}`)
    setTimeout(() => setToast(''), 3000)
    await load()
    setUpdating(null)
  }

  const filtered = filter === 'all' ? auctions : auctions.filter(a => a.status === filter)
  const counts = { all: auctions.length, draft: auctions.filter(a => a.status==='draft').length, active: auctions.filter(a => a.status==='active').length, ended: auctions.filter(a => a.status==='ended').length, settled: auctions.filter(a => a.status==='settled').length }

  return (
    <div className="p-8">
      {toast && <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl font-semibold text-sm shadow-xl">{toast}</div>}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Auctions</h1>
          <p className="text-slate-500 text-sm mt-1">{auctions.length} total auctions</p>
        </div>
        <Link href="/admin/auctions/new" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-colors">
          <Plus className="w-4 h-4" />New Auction
        </Link>
      </div>

      <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm w-fit mb-6">
        {(['all','draft','active','ended','settled'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize ${filter === f ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
          <Gavel className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">No {filter} auctions</p>
          <Link href="/admin/auctions/new" className="mt-4 inline-block bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">Create Auction</Link>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Vehicle','Status','Schedule','Current Bid','Bids','Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-8 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                        {a.vehicle?.images?.[0] ? <img src={a.vehicle.images[0]} alt="" className="w-full h-full object-cover" /> : <Gavel className="w-3 h-3 text-slate-300 m-auto" />}
                      </div>
                      <div>
                        <p className="text-slate-900 font-semibold text-sm">{a.vehicle ? `${a.vehicle.year} ${a.vehicle.make} ${a.vehicle.model}` : 'Unknown'}</p>
                        <p className="text-slate-400 text-xs capitalize">{a.vehicle?.damage_type?.replace(/_/g,' ')}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    {a.status === 'active' && <Badge label="● Live" variant="green" />}
                    {a.status === 'draft' && <Badge label="Draft" variant="slate" />}
                    {a.status === 'ended' && <Badge label="Ended" variant="amber" />}
                    {a.status === 'settled' && <Badge label="Settled" variant="blue" />}
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-slate-600 text-xs">{new Date(a.start_time).toLocaleDateString('en-EG',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>
                    <p className="text-slate-400 text-xs">→ {new Date(a.end_time).toLocaleDateString('en-EG',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-emerald-600 font-bold text-sm">{formatCurrency(Math.max(a.current_highest_bid, a.starting_price))}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1 text-slate-600 text-sm font-medium">
                      <TrendingUp className="w-3.5 h-3.5 text-slate-400" />{a.bid_count}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      {a.status === 'draft' && <button onClick={() => updateStatus(a.id,'active')} disabled={updating===a.id} className="text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-lg transition-colors">{updating===a.id ? '...' : 'Go Live'}</button>}
                      {a.status === 'active' && <button onClick={() => updateStatus(a.id,'ended')} disabled={updating===a.id} className="text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2.5 py-1.5 rounded-lg transition-colors">{updating===a.id ? '...' : 'End'}</button>}
                      {a.status === 'ended' && <button onClick={() => updateStatus(a.id,'settled')} disabled={updating===a.id} className="text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-600 border border-purple-200 px-2.5 py-1.5 rounded-lg transition-colors">Settle</button>}
                      <Link href={`/auctions/${a.id}`} target="_blank" className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors">
                        <Eye className="w-3 h-3" />View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
