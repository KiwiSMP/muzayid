'use client'

import { useState, useMemo } from 'react'
import AuctionCard from '@/components/auction/AuctionCard'
import { Search, Gavel, SlidersHorizontal } from 'lucide-react'
import type { AuctionWithVehicle } from '@/types'
import { useLang } from '@/i18n/LangContext'
import Link from 'next/link'

interface Props {
  auctions: AuctionWithVehicle[]
}

const TABS = [
  { key: 'all', en: 'All', ar: 'الكل' },
  { key: 'active', en: 'Live Now', ar: 'حية الآن' },
  { key: 'upcoming', en: 'Upcoming', ar: 'قادمة' },
]

const DAMAGE_TYPES = ['front', 'rear', 'side', 'rollover', 'flood', 'fire', 'hail', 'mechanical']

export default function HomepageClient({ auctions }: Props) {
  const { lang } = useLang()
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [damageFilter, setDamageFilter] = useState('')
  const [sort, setSort] = useState('ending_soon')

  const filtered = useMemo(() => {
    let list = [...auctions]

    if (tab !== 'all') {
      list = list.filter(a => a.status === tab)
    }
    if (search.trim()) {
      const s = search.toLowerCase()
      list = list.filter(a =>
        a.vehicle?.make?.toLowerCase().includes(s) ||
        a.vehicle?.model?.toLowerCase().includes(s) ||
        String(a.vehicle?.year).includes(s)
      )
    }
    if (damageFilter) {
      list = list.filter(a => a.vehicle?.damage_type?.toLowerCase() === damageFilter)
    }

    switch (sort) {
      case 'ending_soon':
        list.sort((a, b) => new Date(a.end_time).getTime() - new Date(b.end_time).getTime())
        break
      case 'newest':
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      case 'lowest_bid':
        list.sort((a, b) => (a.current_highest_bid || a.starting_price) - (b.current_highest_bid || b.starting_price))
        break
      case 'highest_bid':
        list.sort((a, b) => (b.current_highest_bid || b.starting_price) - (a.current_highest_bid || a.starting_price))
        break
    }

    return list
  }, [auctions, tab, search, damageFilter, sort])

  return (
    <div>
      {/* Tabs + Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 flex-shrink-0">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-sm font-semibold px-4 py-2 rounded-lg transition-all ${tab === t.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {lang === 'ar' ? t.ar : t.en}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'ar' ? 'ابحث عن الماركة، الموديل...' : 'Search make, model, year...'}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]"
          />
        </div>

        {/* Damage filter */}
        <select
          value={damageFilter}
          onChange={e => setDamageFilter(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 text-slate-600 min-w-[140px]"
        >
          <option value="">All Damage Types</option>
          {DAMAGE_TYPES.map(d => (
            <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 text-slate-600 min-w-[140px]"
        >
          <option value="ending_soon">Ending Soon</option>
          <option value="newest">Newest First</option>
          <option value="lowest_bid">Lowest Bid</option>
          <option value="highest_bid">Highest Bid</option>
        </select>
      </div>

      {/* Results count */}
      <p className="text-xs text-slate-400 mb-4">
        {filtered.length} {filtered.length === 1 ? 'auction' : 'auctions'} found
        {search && ` for "${search}"`}
      </p>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
            <Gavel className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">No Auctions Found</h3>
          <p className="text-slate-400 text-sm max-w-sm mb-6">
            {search || damageFilter
              ? 'Try adjusting your filters or search term.'
              : 'New auctions are added regularly. Register for alerts.'}
          </p>
          {(search || damageFilter) ? (
            <button
              onClick={() => { setSearch(''); setDamageFilter('') }}
              className="bg-[#1E3A5F] text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-[#162d4a] transition-colors"
            >
              Clear Filters
            </button>
          ) : (
            <Link href="/auth/register"
              className="bg-[#1E3A5F] text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-[#162d4a] transition-colors">
              Register for Alerts
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(auction => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </div>
      )}
    </div>
  )
}
