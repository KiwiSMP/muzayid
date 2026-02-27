'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Clock, Key, Gauge, AlertTriangle, CheckCircle, Timer } from 'lucide-react'
import type { AuctionWithVehicle } from '@/types'
import { formatCurrency, getTimeRemaining, damageTypeColor } from '@/lib/utils'
import { useLang } from '@/i18n/LangContext'

interface AuctionCardProps {
  auction: AuctionWithVehicle
}

function Countdown({ endTime, startTime, status }: { endTime: string; startTime: string; status: string }) {
  const [time, setTime] = useState(() =>
    status === 'active' ? getTimeRemaining(endTime) : null
  )

  useEffect(() => {
    if (status !== 'active') return
    const interval = setInterval(() => setTime(getTimeRemaining(endTime)), 1000)
    return () => clearInterval(interval)
  }, [endTime, status])

  if (status === 'upcoming') {
    const until = getTimeRemaining(startTime)
    if (!until || until.isExpired) return null
    return (
      <div className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold bg-blue-50 px-2.5 py-1.5 rounded-lg">
        <Timer className="w-3.5 h-3.5 flex-shrink-0" />
        <span>
          Starts in {until.days > 0 ? `${until.days}d ` : ''}{until.hours}h {until.minutes}m
        </span>
      </div>
    )
  }

  if (status === 'ended') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-100 px-2.5 py-1.5 rounded-lg">
        Auction Ended
      </div>
    )
  }

  if (!time || time.isExpired) return (
    <div className="text-xs text-slate-400 font-medium">Ended</div>
  )

  if (time.isUrgent) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-red-600 font-bold bg-red-50 px-2.5 py-1.5 rounded-lg animate-pulse">
        <Clock className="w-3.5 h-3.5 flex-shrink-0" />
        <span>
          {time.hours}:{String(time.minutes).padStart(2, '0')}:{String(time.seconds).padStart(2, '0')} left!
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium bg-slate-100 px-2.5 py-1.5 rounded-lg">
      <Clock className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
      <span>
        {time.days > 0 ? `${time.days}d ` : ''}{time.hours}h {time.minutes}m left
      </span>
    </div>
  )
}

export default function AuctionCard({ auction }: AuctionCardProps) {
  const { tr } = useLang()
  const v = auction.vehicle
  if (!v) return null

  const images = v.images?.filter(Boolean) || []
  const primaryImage = images[0]
  const hasReserve = v.condition_report?.reserve_price

  const statusColors = {
    active: 'bg-emerald-500',
    upcoming: 'bg-blue-500',
    ended: 'bg-slate-400',
    settled: 'bg-purple-500',
    cancelled: 'bg-red-400',
  }

  const displayBid = auction.current_highest_bid > 0
    ? auction.current_highest_bid
    : auction.starting_price

  const isActive = auction.status === 'active'
  const isEnded = auction.status === 'ended' || auction.status === 'settled'

  return (
    <Link href={`/auctions/${auction.id}`} className="group block">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-lg transition-all duration-200 h-full flex flex-col">

        {/* Image */}
        <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
          {primaryImage ? (
            <img
              src={primaryImage}
              alt={`${v.year} ${v.make} ${v.model}`}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-10 bg-slate-200 rounded-lg mx-auto mb-2 flex items-center justify-center">
                  <Gauge className="w-6 h-6 text-slate-300" />
                </div>
                <span className="text-slate-400 text-xs">No Image</span>
              </div>
            </div>
          )}

          {/* Multiple images indicator */}
          {images.length > 1 && (
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
              +{images.length - 1}
            </div>
          )}

          {/* Status badge */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
            <span className={`flex items-center gap-1 text-white text-[10px] font-bold px-2 py-1 rounded-full ${statusColors[auction.status] || 'bg-slate-400'}`}>
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
              {auction.status.toUpperCase()}
            </span>
          </div>

          {/* Lot number */}
          {auction.lot_number && (
            <div className="absolute top-2.5 right-2.5 bg-black/60 text-white text-[10px] font-semibold px-2 py-1 rounded-full">
              Lot #{auction.lot_number}
            </div>
          )}

          {/* Damage type badge */}
          {v.damage_type && (
            <div className={`absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${damageTypeColor(v.damage_type)}`}>
              {v.damage_type.charAt(0).toUpperCase() + v.damage_type.slice(1)} Damage
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col flex-1">

          {/* Title */}
          <h3 className="font-bold text-slate-900 text-base leading-snug mb-2">
            {v.year} {v.make} {v.model}
          </h3>

          {/* Vehicle specs row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mb-3">
            {v.mileage != null && (
              <span className="flex items-center gap-1">
                <Gauge className="w-3 h-3" />
                {v.mileage.toLocaleString()} km
              </span>
            )}
            {v.condition_report?.keys_available !== undefined && (
              <span className={`flex items-center gap-1 ${v.condition_report.keys_available ? 'text-emerald-600' : 'text-red-500'}`}>
                <Key className="w-3 h-3" />
                {v.condition_report.keys_available ? 'Keys ✓' : 'No Keys'}
              </span>
            )}
            {v.condition_report?.run_drive_status && (
              <span className={`flex items-center gap-1 ${v.condition_report.run_drive_status === 'starts_drives' ? 'text-emerald-600' : v.condition_report.run_drive_status === 'engine_starts' ? 'text-amber-500' : 'text-red-500'}`}>
                {v.condition_report.run_drive_status === 'starts_drives'
                  ? <CheckCircle className="w-3 h-3" />
                  : <AlertTriangle className="w-3 h-3" />}
                {v.condition_report.run_drive_status === 'starts_drives' ? 'Runs' : v.condition_report.run_drive_status === 'engine_starts' ? 'Eng. Starts' : "Non-Runner"}
              </span>
            )}
            {v.fines_cleared === false && (
              <span className="flex items-center gap-1 text-orange-500 font-semibold">
                <AlertTriangle className="w-3 h-3" />
                Fines apply
              </span>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Bid info */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-end justify-between mb-2.5">
              <div>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-0.5">
                  {auction.current_highest_bid > 0 ? tr('card_current_bid') : tr('card_starting_bid')}
                </p>
                <p className={`font-black text-xl leading-none ${isEnded ? 'text-slate-400' : 'text-slate-900'}`}>
                  {formatCurrency(displayBid)}
                </p>
                {auction.current_highest_bid === 0 && (
                  <p className="text-[10px] text-slate-400 mt-0.5">{tr('card_no_bids')}</p>
                )}
              </div>
              <Countdown endTime={auction.end_time} startTime={auction.start_time} status={auction.status} />
            </div>

            {/* CTA */}
            {isActive && (
              <div className="w-full bg-[#1E3A5F] hover:bg-[#162d4a] text-white text-sm font-bold py-2.5 rounded-xl text-center transition-colors">
                {tr('card_bid_now')}
              </div>
            )}
            {!isActive && !isEnded && (
              <div className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2.5 rounded-xl text-center transition-colors">
                {tr('card_view')}
              </div>
            )}
            {isEnded && (
              <div className="w-full bg-slate-100 text-slate-500 text-sm font-semibold py-2.5 rounded-xl text-center">
                {tr('card_ended')} — View Results
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
