import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/layout/Navbar'
import AuctionCard from '@/components/auction/AuctionCard'
import { Gavel, Search, SlidersHorizontal } from 'lucide-react'
import type { AuctionWithVehicle } from '@/types'

export const dynamic = 'force-dynamic'

const DAMAGE_LABELS: Record<string, string> = {
  front_collision: 'Front Collision', rear_collision: 'Rear Collision',
  side_collision: 'Side Collision', rollover: 'Rollover', flood: 'Flood',
  fire: 'Fire', hail: 'Hail', theft_recovery: 'Theft Recovery',
  mechanical: 'Mechanical', other: 'Other',
}

async function getAuctions(status?: string, damage?: string): Promise<AuctionWithVehicle[]> {
  try {
    const supabase = createClient()
    let query = supabase
      .from('auctions')
      .select('*, vehicle:vehicles(*)')
      .order('end_time', { ascending: true })

    if (status === 'active') query = query.eq('status', 'active')
    else if (status === 'upcoming') query = query.eq('status', 'draft')
    else query = query.in('status', ['active', 'draft'])

    const { data } = await query
    let results = (data || []) as AuctionWithVehicle[]
    if (damage) results = results.filter(a => a.vehicle?.damage_type === damage)
    return results
  } catch { return [] }
}

async function getCurrentUser() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase.from('users').select('full_name, bidding_tier').eq('id', user.id).single()
    return data
  } catch { return null }
}

export default async function AuctionsPage({
  searchParams,
}: {
  searchParams: { status?: string; damage?: string }
}) {
  const [auctions, user] = await Promise.all([
    getAuctions(searchParams.status, searchParams.damage),
    getCurrentUser(),
  ])

  const activeCount = auctions.filter(a => a.status === 'active').length
  const upcomingCount = auctions.filter(a => a.status === 'upcoming').length

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar initialUser={user} />

      {/* Page header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-black text-slate-900">All Auctions</h1>
              <p className="text-slate-500 mt-1">
                <span className="font-semibold text-emerald-600">{activeCount} live</span>
                {upcomingCount > 0 && <> · <span className="font-semibold text-slate-600">{upcomingCount} upcoming</span></>}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 mt-5 flex-wrap">
            {/* Status filter */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {[
                { value: '', label: 'All' },
                { value: 'active', label: '● Live Now' },
                { value: 'upcoming', label: 'Upcoming' },
              ].map(f => (
                <a key={f.value} href={`/auctions${f.value ? `?status=${f.value}` : ''}`}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${(!searchParams.status && f.value === '') || searchParams.status === f.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  {f.label}
                </a>
              ))}
            </div>

            {/* Damage filter */}
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(DAMAGE_LABELS).map(([key, label]) => (
                <a key={key}
                  href={`/auctions?${searchParams.status ? `status=${searchParams.status}&` : ''}damage=${key}`}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${searchParams.damage === key ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900'}`}>
                  {label}
                </a>
              ))}
              {searchParams.damage && (
                <a href={`/auctions${searchParams.status ? `?status=${searchParams.status}` : ''}`}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors">
                  ✕ Clear filter
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {auctions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-2xl border border-slate-200">
            <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mb-6">
              <Gavel className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-700 mb-2">No Auctions Found</h3>
            <p className="text-slate-400 max-w-sm">
              {searchParams.damage
                ? `No ${DAMAGE_LABELS[searchParams.damage] || ''} auctions right now. Try clearing the filter.`
                : 'No auctions are live right now. Register to get notified when new vehicles go live.'}
            </p>
            {(searchParams.status || searchParams.damage) && (
              <a href="/auctions" className="mt-5 bg-[#1E3A5F] text-white font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-[#162d4a] transition-colors">
                View All Auctions
              </a>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-5">{auctions.length} auction{auctions.length !== 1 ? 's' : ''} found</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {auctions.map(auction => (
                <AuctionCard key={auction.id} auction={auction} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
