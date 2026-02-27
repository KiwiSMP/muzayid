'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Upload, X, Loader2, CheckCircle2, AlertCircle, Image, Plus, Trash2 } from 'lucide-react'

const DAMAGE_TYPES = ['front_collision','rear_collision','side_collision','rollover','flood','fire','hail','theft_recovery','mechanical','other']
const DAMAGE_LABELS: Record<string, string> = { front_collision:'Front Collision', rear_collision:'Rear Collision', side_collision:'Side Collision', rollover:'Rollover', flood:'Flood Damage', fire:'Fire Damage', hail:'Hail Damage', theft_recovery:'Theft Recovery', mechanical:'Mechanical', other:'Other' }

function TagInput({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('')
  function add() {
    const trimmed = input.trim()
    if (trimmed && !value.includes(trimmed)) { onChange([...value, trimmed]); setInput('') }
  }
  return (
    <div>
      <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">{label}</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map(tag => (
          <span key={tag} className="flex items-center gap-1 bg-slate-700 text-slate-200 text-xs px-2 py-1 rounded-lg">
            {tag}
            <button onClick={() => onChange(value.filter(t => t !== tag))} type="button"><X className="w-3 h-3 hover:text-red-400" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={`Add ${label.toLowerCase()}...`}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500" />
        <button type="button" onClick={add} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-xl text-sm"><Plus className="w-4 h-4" /></button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">{label}</label>{children}</div>
}

const inputCls = "w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500"
const selectCls = "w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"

export default function NewVehiclePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    make: '', model: '', year: new Date().getFullYear(), damage_type: 'front_collision',
    mileage: '', description: '', fines_cleared: false,
  })
  const [cr, setCr] = useState({
    primary_damage: '', secondary_damage: '', run_drive_status: 'starts_drives',
    odometer_actual: true, keys_available: true,
    chassis_number: '', license_status: 'active', location: '', lot_number: '', lane: '',
    exterior: [] as string[], interior: [] as string[], mechanical: [] as string[], missing_parts: [] as string[], notes: '',
  })
  const [images, setImages] = useState<{ file: File; preview: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  function set(k: string, v: unknown) { setForm(f => ({ ...f, [k]: v })) }
  function setCrField(k: string, v: unknown) { setCr(c => ({ ...c, [k]: v })) }

  function handleFiles(files: FileList | null) {
    if (!files) return
    const newImages = Array.from(files).filter(f => f.type.startsWith('image/')).map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }))
    setImages(prev => [...prev, ...newImages].slice(0, 20))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.make || !form.model || !form.mileage) { setError('Please fill in all required fields.'); return }
    if (images.length === 0) { setError('Please upload at least one vehicle photo.'); return }

    setUploading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Upload images
      const imageUrls: string[] = []
      for (const img of images) {
        const ext = img.file.name.split('.').pop()
        const path = `vehicles/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('vehicle-images').upload(path, img.file)
        if (uploadErr) throw uploadErr
        const { data: { publicUrl } } = supabase.storage.from('vehicle-images').getPublicUrl(path)
        imageUrls.push(publicUrl)
      }

      // Insert vehicle
      const { data: vehicle, error: vehicleErr } = await supabase.from('vehicles').insert({
        seller_id: user.id,
        make: form.make,
        model: form.model,
        year: form.year,
        damage_type: form.damage_type,
        mileage: parseInt(form.mileage),
        description: form.description,
        fines_cleared: form.fines_cleared,
        images: imageUrls,
        status: 'approved', // admin-added vehicles are auto-approved
        condition_report: {
          primary_damage: cr.primary_damage,
          secondary_damage: cr.secondary_damage,
          run_drive_status: cr.run_drive_status,
          odometer_actual: cr.odometer_actual,
          keys_available: cr.keys_available,
          chassis_number: cr.chassis_number,
          license_status: cr.license_status,
          location: cr.location,
          lot_number: cr.lot_number,
          lane: cr.lane,
          exterior: cr.exterior,
          interior: cr.interior,
          mechanical: cr.mechanical,
          missing_parts: cr.missing_parts,
          notes: cr.notes,
        }
      }).select().single()

      if (vehicleErr) throw vehicleErr
      setDone(true)
      setTimeout(() => router.push('/admin/vehicles'), 1500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save vehicle')
    } finally {
      setUploading(false)
    }
  }

  if (done) return (
    <div className="p-8 flex items-center justify-center min-h-96">
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-8 h-8 text-emerald-400" /></div>
        <h2 className="text-xl font-bold text-white mb-1">Vehicle Added!</h2>
        <p className="text-slate-400 text-sm">Redirecting to vehicles list...</p>
      </div>
    </div>
  )

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm mb-4 flex items-center gap-1">← Back</button>
        <h1 className="text-2xl font-bold text-white">Add New Vehicle</h1>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 mb-6 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        {/* ── Images ── */}
        <section>
          <h2 className="text-white font-bold text-lg mb-4 pb-2 border-b border-slate-800">Photos</h2>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
            onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl p-8 text-center cursor-pointer transition-colors mb-4"
          >
            <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={e => handleFiles(e.target.files)} />
            <Image className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">Drop photos here or <span className="text-emerald-400 underline">browse</span></p>
            <p className="text-slate-500 text-xs mt-1">Up to 20 images · JPG, PNG, WebP</p>
          </div>
          {images.length > 0 && (
            <div className="grid grid-cols-5 gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative group">
                  <img src={img.preview} alt="" className="w-full h-20 object-cover rounded-xl" />
                  {i === 0 && <span className="absolute top-1 left-1 bg-emerald-500 text-white text-xs px-1.5 py-0.5 rounded font-bold">Main</span>}
                  <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 items-center justify-center hidden group-hover:flex">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Basic Info ── */}
        <section>
          <h2 className="text-white font-bold text-lg mb-4 pb-2 border-b border-slate-800">Vehicle Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Make *"><input required value={form.make} onChange={e => set('make', e.target.value)} placeholder="Toyota" className={inputCls} /></Field>
            <Field label="Model *"><input required value={form.model} onChange={e => set('model', e.target.value)} placeholder="Corolla" className={inputCls} /></Field>
            <Field label="Year *"><input type="number" required min={1950} max={2100} value={form.year} onChange={e => set('year', parseInt(e.target.value))} className={inputCls} /></Field>
            <Field label="Mileage (km) *"><input type="number" required min={0} value={form.mileage} onChange={e => set('mileage', e.target.value)} placeholder="85000" className={inputCls} /></Field>
            <Field label="Damage Type *">
              <select value={form.damage_type} onChange={e => set('damage_type', e.target.value)} className={selectCls}>
                {DAMAGE_TYPES.map(d => <option key={d} value={d}>{DAMAGE_LABELS[d]}</option>)}
              </select>
            </Field>
            <Field label="Fines Status">
              <select value={String(form.fines_cleared)} onChange={e => set('fines_cleared', e.target.value === 'true')} className={selectCls}>
                <option value="true">Sold Clear of Fines</option>
                <option value="false">Buyer Assumes Fines</option>
              </select>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Description">
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} placeholder="Additional notes about the vehicle..." className={inputCls + ' resize-none'} />
            </Field>
          </div>
        </section>

        {/* ── Condition Report ── */}
        <section>
          <h2 className="text-white font-bold text-lg mb-4 pb-2 border-b border-slate-800">Condition Report (Brutal Transparency)</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Primary Damage"><input value={cr.primary_damage} onChange={e => setCrField('primary_damage', e.target.value)} placeholder="e.g. Front end smash" className={inputCls} /></Field>
            <Field label="Secondary Damage"><input value={cr.secondary_damage} onChange={e => setCrField('secondary_damage', e.target.value)} placeholder="e.g. Left side swipe" className={inputCls} /></Field>
            <Field label="Run & Drive Status">
              <select value={cr.run_drive_status} onChange={e => setCrField('run_drive_status', e.target.value)} className={selectCls}>
                <option value="starts_drives">Starts & Drives</option>
                <option value="engine_starts">Engine Starts Only</option>
                <option value="non_runner">Non-Runner (Dead Engine)</option>
              </select>
            </Field>
            <Field label="Odometer Reading">
              <select value={String(cr.odometer_actual)} onChange={e => setCrField('odometer_actual', e.target.value === 'true')} className={selectCls}>
                <option value="true">Actual Mileage</option>
                <option value="false">Not Actual (Broken Dash)</option>
              </select>
            </Field>
            <Field label="Keys Available">
              <select value={String(cr.keys_available)} onChange={e => setCrField('keys_available', e.target.value === 'true')} className={selectCls}>
                <option value="true">Yes — Keys Present</option>
                <option value="false">No Keys</option>
              </select>
            </Field>
            <Field label="License Status">
              <select value={cr.license_status} onChange={e => setCrField('license_status', e.target.value)} className={selectCls}>
                <option value="active">Active Registration</option>
                <option value="expired">Expired Registration</option>
                <option value="cancelled">Permanently Cancelled</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Chassis / VIN"><input value={cr.chassis_number} onChange={e => setCrField('chassis_number', e.target.value)} placeholder="JTDBU4EE9A0..." className={inputCls + ' font-mono'} /></Field>
            <Field label="Current Location"><input value={cr.location} onChange={e => setCrField('location', e.target.value)} placeholder="15th of May City Storage Lot" className={inputCls} /></Field>
            <Field label="Lot / Run Number"><input value={cr.lot_number} onChange={e => setCrField('lot_number', e.target.value)} placeholder="45" className={inputCls} /></Field>
            <Field label="Lane / Ring"><input value={cr.lane} onChange={e => setCrField('lane', e.target.value)} placeholder="Lane A" className={inputCls} /></Field>
          </div>
          <div className="flex flex-col gap-4">
            <TagInput label="Exterior Damage" value={cr.exterior} onChange={v => setCrField('exterior', v)} />
            <TagInput label="Interior Damage" value={cr.interior} onChange={v => setCrField('interior', v)} />
            <TagInput label="Mechanical Issues" value={cr.mechanical} onChange={v => setCrField('mechanical', v)} />
            <TagInput label="Missing Parts" value={cr.missing_parts} onChange={v => setCrField('missing_parts', v)} />
            <Field label="Inspector Notes">
              <textarea value={cr.notes} onChange={e => setCrField('notes', e.target.value)} rows={3} placeholder="Any additional observations..." className={inputCls + ' resize-none'} />
            </Field>
          </div>
        </section>

        <button type="submit" disabled={uploading}
          className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-bold py-4 rounded-xl text-lg transition-colors flex items-center justify-center gap-2">
          {uploading && <Loader2 className="w-5 h-5 animate-spin" />}
          {uploading ? 'Uploading & Saving...' : 'Add Vehicle'}
        </button>
      </form>
    </div>
  )
}
