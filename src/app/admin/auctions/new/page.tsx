'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2, AlertCircle, Gavel, Car, Calendar, DollarSign, Clock } from 'lucide-react'

interface Vehicle {
  id: string; make: string; model: string; year: number
  damage_type: string; images: string[]
  condition_report: { reserve_price?: number }
}

const inp = "w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

function toISO(local: string) { return local ? new Date(local).toISOString() : '' }

function nowLocal() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

function formatDuration(startStr: string, endStr: string): string {
  const diffMs = new Date(endStr).getTime() - new Date(startStr).getTime()
  if (diffMs <= 0) return ''
  const totalMinutes = Math.floor(diffMs / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  const parts: string[] = []
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`)
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`)
  if (minutes > 0 && days === 0) parts.push(`${minutes} min`)
  return parts.join(' ')
}

function CreateAuctionForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselected = searchParams.get('vehicle')

  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [selectedId, setSelectedId] = useState(preselected || '')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    start_time: nowLocal(),
    end_time: '',
    starting_price: '',
    status: 'draft',
  })

  function setF(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: vData } = await supabase.from('vehicles').select('*').eq('status', 'approved').order('created_at', { ascending: false })
      // Only exclude vehicles that currently have an active/draft/upcoming auction.
      // ended, settled, cancelled → vehicle is available to re-auction.
      const { data: aData } = await supabase.from('auctions').select('vehicle_id, status')
      const blockedIds = new Set(
        (aData || [])
          .filter((a: { vehicle_id: string; status: string }) =>
            !['ended', 'settled', 'cancelled'].includes(a.status)
          )
          .map((a: { vehicle_id: string }) => a.vehicle_id)
      )
      const available = ((vData || []) as Vehicle[]).filter(v => !blockedIds.has(v.id))
      setVehicles(available)
      setLoading(false)
    }
    load()
  }, [])

  const selected = vehicles.find(v => v.id === selectedId)
  const reservePrice = selected?.condition_report?.reserve_price

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId) { setError('Please select a vehicle.'); return }
    if (!form.start_time || !form.end_time) { setError('Please set start and end times.'); return }
    if (!form.starting_price) { setError('Please set a starting price.'); return }
    if (new Date(form.end_time) <= new Date(form.start_time)) { setError('End time must be after start time.'); return }

    setSubmitting(true); setError('')
    const supabase = createClient()

    // Only block if there is a CONCURRENT (non-ended) auction for this vehicle.
    // After running the DB migration, ended/settled vehicles CAN be re-auctioned.
    const { data: existing } = await supabase
      .from('auctions')
      .select('id, status')
      .eq('vehicle_id', selectedId)
      .not('status', 'in', '(ended,settled,cancelled)')
      .maybeSingle()

    if (existing) {
      setError(
        `This vehicle has a ${existing.status} auction. ` +
        `Go to Live Control to end or cancel it first.`
      )
      setSubmitting(false)
      return
    }

    const { error: err } = await supabase.from('auctions').insert({
      vehicle_id: selectedId,
      start_time: toISO(form.start_time),
      end_time: toISO(form.end_time),
      starting_price: parseFloat(form.starting_price),
      reserve_price: reservePrice || null,
      current_highest_bid: 0,
      status: form.status,
    })
    if (err) {
      if (err.message.includes('unique') || err.message.includes('duplicate')) {
        setError(
          'A concurrent auction already exists for this vehicle. ' +
          'Open Live Control, check all statuses, and cancel it first.'
        )
      } else if (err.message.includes('duration')) {
        setError('Invalid auction duration. Please check start and end times.')
      } else {
        setError(`Failed to create: ${err.message}`)
      }
      setSubmitting(false)
      return
    }
    setDone(true)
    setTimeout(() => router.push('/admin/live-control'), 1500)
  }

  if (done) return (
    <div className="flex items-center justify-center min-h-96">
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Auction Created!</h2>
        <p className="text-slate-500 text-sm">Redirecting to Live Controller...</p>
      </div>
    </div>
  )

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-900 text-sm font-medium mb-3 block transition-colors">← Back</button>
        <h1 className="text-2xl font-bold text-slate-900">Create Auction</h1>
        <p className="text-slate-500 text-sm mt-1">Set schedule and pricing, then go live</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-6 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-5">
        {/* Vehicle select */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-200 mb-4">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center"><Car className="w-4 h-4 text-indigo-600" /></div>
            <h2 className="font-bold text-slate-900">Select Vehicle</h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : vehicles.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
              <Car className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-500 text-sm">No vehicles ready to auction</p>
              <p className="text-slate-400 text-xs mt-1">Add approved vehicles in Inventory first, or end existing auctions</p>
              <button type="button" onClick={() => router.push('/admin/inventory')}
                className="mt-3 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors">
                Go to Inventory
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
              {vehicles.map(v => (
                <button key={v.id} type="button" onClick={() => setSelectedId(v.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${selectedId === v.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                  <div className="w-14 h-10 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200">
                    {v.images?.[0] ? <img src={v.images[0]} alt="" className="w-full h-full object-cover" /> : <Car className="w-4 h-4 text-slate-300 m-auto" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-900 font-semibold text-sm">{v.year} {v.make} {v.model}</p>
                    <p className="text-slate-400 text-xs capitalize">{v.damage_type?.replace(/_/g, ' ')}</p>
                  </div>
                  {v.condition_report?.reserve_price && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                      Reserve: {Number(v.condition_report.reserve_price).toLocaleString('en-EG')} EGP
                    </span>
                  )}
                  {selectedId === v.id && <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                </button>
              ))}
            </div>
          )}

          {selected && reservePrice && (
            <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-3 py-2.5 text-sm">
              <DollarSign className="w-4 h-4 flex-shrink-0" />
              <span>This vehicle has a reserve of <strong>{Number(reservePrice).toLocaleString('en-EG')} EGP</strong>.</span>
            </div>
          )}
        </div>

        {/* Schedule */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-200 mb-4">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center"><Calendar className="w-4 h-4 text-indigo-600" /></div>
            <div>
              <h2 className="font-bold text-slate-900">Schedule</h2>
              <p className="text-slate-400 text-xs">Times are in your local timezone</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Date & Time">
              <input type="datetime-local" required value={form.start_time} onChange={e => setF('start_time', e.target.value)} className={inp} />
            </Field>
            <Field label="End Date & Time">
              <input type="datetime-local" required value={form.end_time} min={form.start_time} onChange={e => setF('end_time', e.target.value)} className={inp} />
            </Field>
          </div>
          {form.start_time && form.end_time && new Date(form.end_time) > new Date(form.start_time) && (
            <div className="mt-3 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600">
              <Clock className="w-4 h-4 text-slate-400" />
              Duration: <span className="font-semibold ml-1">{formatDuration(form.start_time, form.end_time)}</span>
            </div>
          )}
        </div>

        {/* Pricing */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-200 mb-4">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center"><DollarSign className="w-4 h-4 text-indigo-600" /></div>
            <h2 className="font-bold text-slate-900">Pricing</h2>
          </div>
          <Field label="Starting Price (EGP)" hint="Minimum opening bid for this auction">
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9,]*"
                required
                value={form.starting_price}
                onChange={e => setF('starting_price', e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="e.g. 5000"
                className={inp + ' pr-14'}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium pointer-events-none">EGP</span>
            </div>
          </Field>
        </div>

        {/* Status */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-200 mb-4">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center"><Gavel className="w-4 h-4 text-indigo-600" /></div>
            <h2 className="font-bold text-slate-900">Launch Status</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'draft', label: 'Draft', desc: 'Visible for preview. Not live yet.', icon: Clock },
              { value: 'active', label: 'Go Live Now', desc: 'Opens immediately for live bidding.', icon: Gavel },
            ].map(s => {
              const Icon = s.icon
              return (
                <button key={s.value} type="button" onClick={() => setF('status', s.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${form.status === s.value ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 ${form.status === s.value ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <p className={`font-bold text-sm ${form.status === s.value ? 'text-indigo-700' : 'text-slate-700'}`}>{s.label}</p>
                  </div>
                  <p className="text-slate-500 text-xs">{s.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        <button type="submit" disabled={submitting || !selectedId || vehicles.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl text-base transition-colors shadow-sm">
          {submitting ? <><Loader2 className="w-5 h-5 animate-spin" />Creating...</> : <><Gavel className="w-5 h-5" />Create Auction</>}
        </button>
      </form>
    </div>
  )
}

export default function NewAuctionPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-96"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}>
      <CreateAuctionForm />
    </Suspense>
  )
}
