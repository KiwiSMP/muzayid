'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Car, Upload, X, Loader2, CheckCircle2, AlertCircle,
  Gavel, Eye, CloudUpload, Tag, Wrench, MapPin, Hash, Key,
  Gauge, FileText, ShieldCheck
} from 'lucide-react'

interface Vehicle {
  id: string; make: string; model: string; year: number
  damage_type: string; mileage: number; status: string
  images: string[]; fines_cleared: boolean; created_at: string
  has_auction?: boolean
  condition_report: { reserve_price?: number; run_drive_status?: string }
}

const DAMAGE_LABELS: Record<string, string> = {
  front_collision:'Front Collision', rear_collision:'Rear Collision', side_collision:'Side Collision',
  rollover:'Rollover', flood:'Flood Damage', fire:'Fire Damage', hail:'Hail Damage',
  theft_recovery:'Theft Recovery', mechanical:'Mechanical', other:'Other'
}

function Badge({ label, variant }: { label: string; variant: 'green'|'amber'|'red'|'slate'|'blue'|'purple' }) {
  const cls = { green:'bg-emerald-100 text-emerald-700', amber:'bg-amber-100 text-amber-700', red:'bg-red-100 text-red-700', slate:'bg-slate-100 text-slate-600', blue:'bg-blue-100 text-blue-700', purple:'bg-purple-100 text-purple-700' }
  return <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${cls[variant]}`}>{label}</span>
}

function SectionHeader({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 pb-3 border-b border-slate-200 mb-4">
      <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
        <Icon className="w-4 h-4 text-indigo-600" />
      </div>
      <div>
        <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
        {sub && <p className="text-slate-400 text-xs">{sub}</p>}
      </div>
    </div>
  )
}

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

const inp = "w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
const sel = "w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"

function TagInput({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('')
  const add = () => { const t = input.trim(); if (t && !value.includes(t)) { onChange([...value, t]); setInput('') } }
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5 min-h-8 mb-2">
        {value.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-medium">
            {tag}
            <button type="button" onClick={() => onChange(value.filter(t => t !== tag))}><X className="w-3 h-3 hover:text-red-500" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() }}}
          placeholder={placeholder} className={inp} />
        <button type="button" onClick={add} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap">Add</button>
      </div>
    </div>
  )
}

// ── ADD VEHICLE FORM ─────────────────────────────────────────
function AddVehicleForm({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [images, setImages] = useState<{ file: File; preview: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    make: '', model: '', year: new Date().getFullYear(), damage_type: 'front_collision',
    mileage: '', description: '', fines_cleared: false,
  })
  const [cr, setCr] = useState({
    primary_damage: '', secondary_damage: '', run_drive_status: 'starts_drives',
    odometer_actual: true, keys_available: true, chassis_number: '',
    license_status: 'active', location: '', lot_number: '', lane: '',
    reserve_price: '', // per-vehicle reserve
    exterior: [] as string[], interior: [] as string[],
    mechanical: [] as string[], missing_parts: [] as string[], notes: '',
  })

  function setF(k: string, v: unknown) { setForm(f => ({ ...f, [k]: v })) }
  function setCF(k: string, v: unknown) { setCr(c => ({ ...c, [k]: v })) }

  function addImages(files: FileList | null) {
    if (!files) return
    const newImgs = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 20 - images.length).map(file => ({ file, preview: URL.createObjectURL(file) }))
    setImages(prev => [...prev, ...newImgs])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (images.length === 0) { setError('Upload at least one photo.'); return }
    if (!form.make || !form.model || !form.mileage) { setError('Fill in all required fields.'); return }
    setSubmitting(true); setError('')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const urls: string[] = []
      for (const img of images) {
        const ext = img.file.name.split('.').pop() || 'jpg'
        const path = `vehicles/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage.from('vehicle-images').upload(path, img.file)
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from('vehicle-images').getPublicUrl(path)
        urls.push(publicUrl)
      }

      const { error: vErr } = await supabase.from('vehicles').insert({
        seller_id: user.id, make: form.make, model: form.model, year: form.year,
        damage_type: form.damage_type, mileage: parseInt(form.mileage),
        description: form.description, fines_cleared: form.fines_cleared,
        images: urls, status: 'approved',
        condition_report: {
          primary_damage: cr.primary_damage, secondary_damage: cr.secondary_damage,
          run_drive_status: cr.run_drive_status, odometer_actual: cr.odometer_actual,
          keys_available: cr.keys_available, chassis_number: cr.chassis_number,
          license_status: cr.license_status, location: cr.location,
          lot_number: cr.lot_number, lane: cr.lane,
          reserve_price: cr.reserve_price ? parseFloat(cr.reserve_price) : null,
          exterior: cr.exterior, interior: cr.interior,
          mechanical: cr.mechanical, missing_parts: cr.missing_parts, notes: cr.notes,
        }
      })
      if (vErr) throw vErr
      onDone()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save vehicle')
    }
    setSubmitting(false)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* Photos */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <SectionHeader icon={CloudUpload} title="Vehicle Photos" sub="First image will be the main thumbnail" />
        <div
          onDrop={e => { e.preventDefault(); setDragOver(false); addImages(e.dataTransfer.files) }}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${dragOver ? 'bg-indigo-50 border-indigo-500' : 'bg-slate-50 border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30'}`}>
          <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={e => addImages(e.target.files)} />
          <CloudUpload className={`w-10 h-10 mx-auto mb-3 ${dragOver ? 'text-indigo-500' : 'text-slate-400'}`} />
          <p className="font-semibold text-slate-700">Drag & drop images here or <span className="text-indigo-600 underline">click to browse</span></p>
          <p className="text-slate-400 text-sm mt-1">JPG, PNG, WebP · Up to 20 images · 20MB each</p>
        </div>
        {images.length > 0 && (
          <div className="grid grid-cols-5 gap-3 mt-4">
            {images.map((img, i) => (
              <div key={i} className="relative group aspect-square">
                <img src={img.preview} alt="" className="w-full h-full object-cover rounded-lg border border-slate-200" />
                {i === 0 && <span className="absolute bottom-1 left-1 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">MAIN</span>}
                <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white w-5 h-5 rounded-full items-center justify-center hidden group-hover:flex shadow-sm">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Basic info */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <SectionHeader icon={Car} title="Vehicle Details" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Make" required><input required value={form.make} onChange={e => setF('make', e.target.value)} placeholder="Toyota" className={inp} /></Field>
          <Field label="Model" required><input required value={form.model} onChange={e => setF('model', e.target.value)} placeholder="Corolla" className={inp} /></Field>
          <Field label="Year" required><input type="number" required min={1950} max={2100} value={form.year} onChange={e => setF('year', parseInt(e.target.value))} className={inp} /></Field>
          <Field label="Odometer (KMs)" required hint="Always in kilometers">
            <div className="relative"><input type="number" required min={0} value={form.mileage} onChange={e => setF('mileage', e.target.value)} placeholder="85,000" className={inp + ' pr-12'} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">km</span></div>
          </Field>
          <Field label="Damage Type" required>
            <select value={form.damage_type} onChange={e => setF('damage_type', e.target.value)} className={sel}>
              {Object.entries(DAMAGE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Fines (Mokhalafat)">
            <select value={String(form.fines_cleared)} onChange={e => setF('fines_cleared', e.target.value === 'true')} className={sel}>
              <option value="true">✓ Sold Clear of Fines</option>
              <option value="false">⚠ Buyer Assumes All Fines</option>
            </select>
          </Field>
          <Field label="Reserve Price (EGP)" hint="Hidden minimum price for this vehicle — leave blank for no reserve">
            <div className="relative"><input type="number" min={0} value={cr.reserve_price} onChange={e => setCF('reserve_price', e.target.value)} placeholder="Optional" className={inp + ' pr-12'} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">EGP</span></div>
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Description">
            <textarea value={form.description} onChange={e => setF('description', e.target.value)} rows={3} placeholder="Additional notes about the vehicle..." className={inp + ' resize-none'} />
          </Field>
        </div>
      </div>

      {/* Condition Report */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <SectionHeader icon={Wrench} title="Condition Report" sub="Brutal Transparency — all fields visible to buyers" />
        <div className="grid grid-cols-2 gap-4 mb-5">
          <Field label="Primary Damage"><input value={cr.primary_damage} onChange={e => setCF('primary_damage', e.target.value)} placeholder="e.g. Front end smash" className={inp} /></Field>
          <Field label="Secondary Damage"><input value={cr.secondary_damage} onChange={e => setCF('secondary_damage', e.target.value)} placeholder="e.g. Left side swipe" className={inp} /></Field>
          <Field label="Run & Drive Status">
            <select value={cr.run_drive_status} onChange={e => setCF('run_drive_status', e.target.value)} className={sel}>
              <option value="starts_drives">✓ Starts & Drives</option>
              <option value="engine_starts">⚠ Engine Starts Only</option>
              <option value="non_runner">✕ Non-Runner (Dead Engine)</option>
            </select>
          </Field>
          <Field label="Odometer Status">
            <select value={String(cr.odometer_actual)} onChange={e => setCF('odometer_actual', e.target.value === 'true')} className={sel}>
              <option value="true">✓ Actual Mileage</option>
              <option value="false">⚠ Not Actual (Broken Dash)</option>
            </select>
          </Field>
          <Field label="Keys Available">
            <select value={String(cr.keys_available)} onChange={e => setCF('keys_available', e.target.value === 'true')} className={sel}>
              <option value="true">✓ Keys Present</option>
              <option value="false">✕ No Keys</option>
            </select>
          </Field>
          <Field label="License Status">
            <select value={cr.license_status} onChange={e => setCF('license_status', e.target.value)} className={sel}>
              <option value="active">✓ Active Registration</option>
              <option value="expired">⚠ Expired Registration</option>
              <option value="cancelled">✕ Permanently Cancelled</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-5">
          <Field label="Chassis / VIN" hint="Buyers use this for background checks">
            <input value={cr.chassis_number} onChange={e => setCF('chassis_number', e.target.value)} placeholder="JTDBU4EE9A0123456" className={inp + ' font-mono tracking-wider'} />
          </Field>
          <Field label="Current Location" hint="For buyer towing cost calculation">
            <input value={cr.location} onChange={e => setCF('location', e.target.value)} placeholder="15th of May City Storage Lot" className={inp} />
          </Field>
          <Field label="Lot / Run Number" hint="Buyers estimate their car's time slot">
            <input value={cr.lot_number} onChange={e => setCF('lot_number', e.target.value)} placeholder="45" className={inp} />
          </Field>
          <Field label="Lane / Ring">
            <input value={cr.lane} onChange={e => setCF('lane', e.target.value)} placeholder="Lane A" className={inp} />
          </Field>
        </div>
        <div className="flex flex-col gap-4">
          <TagInput label="Exterior Damage Items" placeholder="e.g. Cracked windshield" value={cr.exterior} onChange={v => setCF('exterior', v)} />
          <TagInput label="Interior Damage Items" placeholder="e.g. Torn driver seat" value={cr.interior} onChange={v => setCF('interior', v)} />
          <TagInput label="Mechanical Issues" placeholder="e.g. Broken transmission" value={cr.mechanical} onChange={v => setCF('mechanical', v)} />
          <TagInput label="Missing Parts" placeholder="e.g. Side mirror" value={cr.missing_parts} onChange={v => setCF('missing_parts', v)} />
          <Field label="Inspector Notes">
            <textarea value={cr.notes} onChange={e => setCF('notes', e.target.value)} rows={3} placeholder="Any additional inspector observations..." className={inp + ' resize-none'} />
          </Field>
        </div>
      </div>

      <button type="submit" disabled={submitting}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl text-base transition-colors shadow-sm">
        {submitting ? <><Loader2 className="w-5 h-5 animate-spin" />Uploading & Saving...</> : <><CheckCircle2 className="w-5 h-5" />Add Vehicle to Inventory</>}
      </button>
    </form>
  )
}

// ── INVENTORY LIST ───────────────────────────────────────────
export default function InventoryPage() {
  const router = useRouter()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'add'>('list')
  const [filter, setFilter] = useState('all')

  async function load() {
    const supabase = createClient()
    const { data: vData } = await supabase.from('vehicles').select('*').order('created_at', { ascending: false })
    const { data: aData } = await supabase.from('auctions').select('vehicle_id')
    const auctionedIds = new Set((aData || []).map((a: { vehicle_id: string }) => a.vehicle_id))
    setVehicles(((vData || []) as Vehicle[]).map(v => ({ ...v, has_auction: auctionedIds.has(v.id) })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function handleDone() { load(); setView('list') }

  const filtered = vehicles.filter(v => {
    if (filter === 'ready') return v.status === 'approved' && !v.has_auction
    if (filter === 'all') return true
    return v.status === filter
  })

  if (view === 'add') return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 text-sm font-medium transition-colors">
          ← Back to Inventory
        </button>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Add New Vehicle</h1>
        <p className="text-slate-500 text-sm mt-1">All information is visible to buyers on the auction page</p>
      </div>
      <AddVehicleForm onDone={handleDone} />
    </div>
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="text-slate-500 text-sm mt-1">{vehicles.length} vehicles total</p>
        </div>
        <button onClick={() => setView('add')}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-colors">
          <Plus className="w-4 h-4" />Add Vehicle
        </button>
      </div>

      <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm w-fit mb-6">
        {[
          { key: 'all', label: 'All' },
          { key: 'approved', label: 'Approved' },
          { key: 'pending_review', label: 'Pending' },
          { key: 'ready', label: 'Ready to Auction' },
          { key: 'sold', label: 'Sold' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filter === key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl">
          <Car className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="font-semibold text-slate-500">No vehicles found</p>
          <button onClick={() => setView('add')} className="mt-4 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
            Add First Vehicle
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Vehicle', 'Odometer', 'Damage', 'Run Status', 'Reserve', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(v => (
                <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-9 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200">
                        {v.images?.[0] ? <img src={v.images[0]} alt="" className="w-full h-full object-cover" /> : <Car className="w-4 h-4 text-slate-300 m-auto" />}
                      </div>
                      <div>
                        <p className="text-slate-900 font-semibold text-sm">{v.year} {v.make} {v.model}</p>
                        <p className="text-slate-400 text-xs">{new Date(v.created_at).toLocaleDateString('en-EG', { day:'numeric', month:'short' })}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-700 text-sm font-medium">{v.mileage.toLocaleString()} km</td>
                  <td className="px-4 py-3.5"><Badge label={DAMAGE_LABELS[v.damage_type] || v.damage_type} variant="red" /></td>
                  <td className="px-4 py-3.5">
                    {v.condition_report?.run_drive_status === 'starts_drives' && <Badge label="Starts & Drives" variant="green" />}
                    {v.condition_report?.run_drive_status === 'engine_starts' && <Badge label="Engine Starts" variant="amber" />}
                    {v.condition_report?.run_drive_status === 'non_runner' && <Badge label="Non-Runner" variant="red" />}
                    {!v.condition_report?.run_drive_status && <span className="text-slate-300 text-sm">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-slate-700 text-sm">
                    {v.condition_report?.reserve_price ? `${Number(v.condition_report.reserve_price).toLocaleString('en-EG')} EGP` : <span className="text-slate-300">None</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    {v.has_auction ? <Badge label="Auctioned" variant="purple" /> :
                      v.status === 'approved' ? <Badge label="Approved" variant="green" /> :
                      v.status === 'pending_review' ? <Badge label="Pending" variant="amber" /> :
                      <Badge label={v.status} variant="slate" />}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      {!v.has_auction && v.status === 'approved' && (
                        <button onClick={() => router.push(`/admin/auctions/new?vehicle=${v.id}`)}
                          className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors">
                          <Gavel className="w-3 h-3" />Auction
                        </button>
                      )}
                      <a href={`/admin/inventory/${v.id}`}
                        className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors">
                        <Eye className="w-3 h-3" />View
                      </a>
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
