'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Plus, Car, Loader2, CheckCircle2, Clock, Gavel } from 'lucide-react'

interface VehicleRow {
  id: string
  make: string
  model: string
  year: number
  damage_type: string
  mileage: number
  status: string
  images: string[]
  fines_cleared: boolean
  created_at: string
  has_auction?: boolean
}

const DAMAGE_LABELS: Record<string, string> = { front_collision:'Front Collision', rear_collision:'Rear Collision', side_collision:'Side Collision', rollover:'Rollover', flood:'Flood Damage', fire:'Fire Damage', hail:'Hail Damage', theft_recovery:'Theft Recovery', mechanical:'Mechanical', other:'Other' }

export default function AdminVehiclesPage() {
  const [vehicles, setVehicles] = useState<VehicleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: vehicles } = await supabase.from('vehicles').select('*').order('created_at', { ascending: false })
      const { data: auctions } = await supabase.from('auctions').select('vehicle_id')
      const auctionedIds = new Set((auctions || []).map((a: { vehicle_id: string }) => a.vehicle_id))
      const enriched = (vehicles || []).map(v => ({ ...v, has_auction: auctionedIds.has(v.id) }))
      setVehicles(enriched as VehicleRow[])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = filter === 'all' ? vehicles : vehicles.filter(v => {
    if (filter === 'no_auction') return !v.has_auction && v.status === 'approved'
    return v.status === filter
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Vehicles</h1>
          <p className="text-slate-400 text-sm mt-1">{vehicles.length} total vehicles</p>
        </div>
        <Link href="/admin/vehicles/new"
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
          <Plus className="w-4 h-4" />Add Vehicle
        </Link>
      </div>

      <div className="flex gap-2 mb-6">
        {[
          { key: 'all', label: 'All' },
          { key: 'approved', label: 'Approved' },
          { key: 'pending_review', label: 'Pending Review' },
          { key: 'no_auction', label: 'Ready to Auction' },
          { key: 'sold', label: 'Sold' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${filter === key ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Car className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 mb-4">No vehicles found</p>
          <Link href="/admin/vehicles/new" className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-400 transition-colors">
            Add First Vehicle
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(v => (
            <div key={v.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors">
              <div className="aspect-video bg-slate-800 relative">
                {v.images?.[0]
                  ? <img src={v.images[0]} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Car className="w-12 h-12 text-slate-600" /></div>
                }
                <div className="absolute top-2 left-2 flex gap-1.5">
                  {v.status === 'approved' && <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Approved</span>}
                  {v.status === 'pending_review' && <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><Clock className="w-3 h-3" />Pending</span>}
                </div>
                {v.has_auction && <span className="absolute top-2 right-2 bg-purple-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><Gavel className="w-3 h-3" />Auctioned</span>}
              </div>
              <div className="p-4">
                <h3 className="font-bold text-white">{v.year} {v.make} {v.model}</h3>
                <p className="text-slate-400 text-sm mt-0.5">{DAMAGE_LABELS[v.damage_type]} · {v.mileage.toLocaleString()} km</p>
                <div className="flex gap-2 mt-3">
                  {!v.has_auction && v.status === 'approved' && (
                    <Link href={`/admin/auctions/new?vehicle=${v.id}`}
                      className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold px-3 py-2 rounded-lg text-center transition-colors border border-emerald-500/20">
                      Create Auction
                    </Link>
                  )}
                  <Link href={`/admin/inventory`}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-3 py-2 rounded-lg text-center transition-colors">
                    View in Inventory
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
