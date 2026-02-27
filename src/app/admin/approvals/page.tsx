'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, XCircle, Search, Eye, Loader2, User, Phone, Calendar, ShieldCheck, AlertCircle, ChevronRight } from 'lucide-react'

interface UserRow {
  id: string
  full_name: string
  phone_number: string
  is_verified: boolean
  bidding_tier: number
  deposit_balance: number
  national_id_url: string | null
  created_at: string
  role: string
  email?: string
}

function formatCurrency(n: number) {
  return n.toLocaleString('en-EG') + ' EGP'
}

function Badge({ label, variant }: { label: string; variant: 'green' | 'amber' | 'red' | 'slate' | 'blue' }) {
  const cls = {
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    slate: 'bg-slate-100 text-slate-600',
    blue: 'bg-blue-100 text-blue-700',
  }
  return <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ${cls[variant]}`}>{label}</span>
}

export default function ApprovalsPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [filtered, setFiltered] = useState<UserRow[]>([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'pending' | 'verified' | 'all'>('pending')
  const [selected, setSelected] = useState<UserRow | null>(null)
  const [idUrl, setIdUrl] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false })
    setUsers(data || [])
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    let r = users
    if (tab === 'pending') r = r.filter(u => !u.is_verified)
    if (tab === 'verified') r = r.filter(u => u.is_verified)
    if (search) r = r.filter(u => u.full_name.toLowerCase().includes(search.toLowerCase()) || u.phone_number?.includes(search))
    setFiltered(r)
  }, [users, tab, search])

  async function openUser(u: UserRow) {
    setSelected(u)
    setIdUrl(null)
    if (!u.national_id_url) return
    setLoadingId(true)
    const supabase = createClient()
    // Try signed URL first, fallback to direct
    const path = u.national_id_url.includes('national-ids/')
      ? u.national_id_url.split('national-ids/')[1]
      : u.national_id_url
    const { data } = await supabase.storage.from('national-ids').createSignedUrl(path, 3600)
    setIdUrl(data?.signedUrl || u.national_id_url)
    setLoadingId(false)
  }

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function verify(userId: string, approve: boolean) {
    setProcessing(true)
    const supabase = createClient()
    const { error } = await supabase.from('users').update({ is_verified: approve }).eq('id', userId)
    if (error) { showToast('Failed: ' + error.message, 'error') }
    else {
      showToast(approve ? 'User verified successfully' : 'Verification removed')
      await load()
      setSelected(prev => prev?.id === userId ? { ...prev, is_verified: approve } : prev)
    }
    setProcessing(false)
  }

  async function makeAdmin(userId: string) {
    setProcessing(true)
    const supabase = createClient()
    await supabase.from('users').update({ role: 'admin' }).eq('id', userId)
    showToast('User promoted to Admin')
    await load()
    setProcessing(false)
  }

  const counts = { all: users.length, pending: users.filter(u => !u.is_verified).length, verified: users.filter(u => u.is_verified).length }

  return (
    <div className="p-8">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm shadow-lg ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">KYC Approvals</h1>
        <p className="text-slate-500 text-sm mt-1">Review user identity documents and verify accounts</p>
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          {(['pending', 'verified', 'all'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors capitalize ${tab === t ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              {t} <span className="ml-1 opacity-70">({counts[t]})</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name or phone..."
            className="bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm w-64" />
        </div>
      </div>

      <div className="flex gap-6">
        {/* Table */}
        <div className={`flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden ${selected ? 'max-w-[58%]' : ''}`}>
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['User', 'Phone', 'Tier / Deposit', 'ID Doc', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-slate-400 text-sm">No users found</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id} onClick={() => openUser(u)}
                  className={`cursor-pointer transition-colors ${selected?.id === u.id ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-slate-900 text-sm font-semibold">{u.full_name}</p>
                        <p className="text-slate-400 text-xs">{new Date(u.created_at).toLocaleDateString('en-EG', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 text-sm">{u.phone_number || '—'}</td>
                  <td className="px-4 py-3.5">
                    {u.bidding_tier > 0
                      ? <><p className="text-sm font-semibold text-slate-800">Tier {u.bidding_tier}</p><p className="text-xs text-slate-400">{formatCurrency(u.deposit_balance)}</p></>
                      : <span className="text-slate-400 text-sm">No deposit</span>
                    }
                  </td>
                  <td className="px-4 py-3.5">
                    {u.national_id_url
                      ? <Badge label="Uploaded" variant="blue" />
                      : <Badge label="Not uploaded" variant="slate" />
                    }
                  </td>
                  <td className="px-4 py-3.5">
                    {u.is_verified
                      ? <Badge label="Verified" variant="green" />
                      : u.national_id_url
                        ? <Badge label="Needs Review" variant="amber" />
                        : <Badge label="Incomplete" variant="red" />
                    }
                  </td>
                  <td className="px-4 py-3.5">
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-80 flex-shrink-0 bg-white border border-slate-200 rounded-xl shadow-sm p-5 sticky top-6 h-fit">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">User Profile</h3>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">✕</button>
            </div>

            {/* Info */}
            <div className="flex flex-col gap-3 mb-5 text-sm">
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div><p className="text-slate-400 text-xs">Full Name</p><p className="text-slate-900 font-semibold">{selected.full_name}</p></div>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div><p className="text-slate-400 text-xs">Phone</p><p className="text-slate-900 font-semibold">{selected.phone_number || '—'}</p></div>
              </div>
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div><p className="text-slate-400 text-xs">Registered</p><p className="text-slate-900 font-semibold">{new Date(selected.created_at).toLocaleDateString('en-EG', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div><p className="text-slate-400 text-xs">Role</p><p className="text-slate-900 font-semibold capitalize">{selected.role}</p></div>
              </div>
            </div>

            {/* National ID viewer */}
            <div className="mb-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">National ID (Raqam Qawmy)</p>
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 aspect-video flex items-center justify-center">
                {loadingId ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                ) : idUrl ? (
                  <a href={idUrl} target="_blank" rel="noopener noreferrer" className="w-full h-full">
                    <img src={idUrl} alt="National ID" className="w-full h-full object-contain hover:opacity-90 transition-opacity" />
                  </a>
                ) : (
                  <div className="text-center">
                    <AlertCircle className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                    <p className="text-slate-400 text-xs">No ID uploaded</p>
                  </div>
                )}
              </div>
              {idUrl && <p className="text-xs text-center text-slate-400 mt-1">Click image to view full size</p>}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
              {!selected.is_verified ? (
                <button onClick={() => verify(selected.id, true)}
                  disabled={processing || !selected.national_id_url}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Approve & Verify
                </button>
              ) : (
                <button onClick={() => verify(selected.id, false)} disabled={processing}
                  className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-2.5 rounded-xl text-sm transition-colors border border-red-200">
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Remove Verification
                </button>
              )}
              {selected.role !== 'admin' && (
                <button onClick={() => makeAdmin(selected.id)} disabled={processing}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-sm transition-colors">
                  Promote to Admin
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
