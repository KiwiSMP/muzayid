'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, XCircle, Eye, Search, Filter, AlertCircle, Loader2, User, Phone, Mail } from 'lucide-react'

interface UserRow {
  id: string
  full_name: string
  phone_number: string
  email?: string
  is_verified: boolean
  bidding_tier: number
  deposit_balance: number
  national_id_url: string | null
  created_at: string
  role: string
}

function TierBadge({ tier }: { tier: number }) {
  if (tier === 0) return <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">No Tier</span>
  const c = ['', 'bg-amber-500/10 text-amber-400', 'bg-blue-500/10 text-blue-400', 'bg-purple-500/10 text-purple-400']
  return <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${c[tier]}`}>Tier {tier}</span>
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP', minimumFractionDigits: 0 }).format(n)
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [filtered, setFiltered] = useState<UserRow[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending_kyc' | 'verified' | 'unverified'>('all')
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [idImageUrl, setIdImageUrl] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [toast, setToast] = useState('')

  async function loadUsers() {
    const supabase = createClient()
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false })
    setUsers(data || [])
    setFiltered(data || [])
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  useEffect(() => {
    let result = users
    if (search) result = result.filter(u => u.full_name.toLowerCase().includes(search.toLowerCase()) || u.phone_number?.includes(search))
    if (filter === 'pending_kyc') result = result.filter(u => !u.is_verified && u.national_id_url)
    if (filter === 'verified') result = result.filter(u => u.is_verified)
    if (filter === 'unverified') result = result.filter(u => !u.is_verified)
    setFiltered(result)
  }, [search, filter, users])

  async function openUser(user: UserRow) {
    setSelectedUser(user)
    setIdImageUrl(null)
    if (user.national_id_url) {
      const supabase = createClient()
      const { data } = await supabase.storage.from('national-ids').createSignedUrl(user.national_id_url.replace(/.*national-ids\//, ''), 3600)
      if (data) setIdImageUrl(data.signedUrl)
      else setIdImageUrl(user.national_id_url) // fallback to direct URL
    }
  }

  async function verifyUser(userId: string, verify: boolean) {
    setProcessing(true)
    const supabase = createClient()
    await supabase.from('users').update({ is_verified: verify }).eq('id', userId)
    setToast(verify ? 'User verified ✓' : 'Verification removed')
    setTimeout(() => setToast(''), 3000)
    await loadUsers()
    if (selectedUser?.id === userId) setSelectedUser(prev => prev ? { ...prev, is_verified: verify } : null)
    setProcessing(false)
  }

  async function setAdmin(userId: string) {
    setProcessing(true)
    const supabase = createClient()
    await supabase.from('users').update({ role: 'admin' }).eq('id', userId)
    setToast('User promoted to admin ✓')
    setTimeout(() => setToast(''), 3000)
    await loadUsers()
    setProcessing(false)
  }

  return (
    <div className="p-8">
      {toast && (
        <div className="fixed top-6 right-6 bg-emerald-500 text-white px-4 py-3 rounded-xl font-semibold text-sm z-50 shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Users & KYC</h1>
          <p className="text-slate-400 text-sm mt-1">{users.length} total users</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or phone..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-emerald-500" />
        </div>
        <div className="flex gap-2">
          {(['all', 'pending_kyc', 'verified', 'unverified'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${filter === f ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
              {f === 'pending_kyc' ? 'Pending KYC' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Table */}
        <div className={`flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden ${selectedUser ? 'max-w-[55%]' : 'w-full'}`}>
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-slate-500">No users found</div>
          ) : (
            <table className="w-full">
              <thead className="border-b border-slate-800">
                <tr>
                  {['User', 'Phone', 'Tier', 'Deposit', 'KYC', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.map(u => (
                  <tr key={u.id} onClick={() => openUser(u)}
                    className={`cursor-pointer transition-colors ${selectedUser?.id === u.id ? 'bg-emerald-500/5' : 'hover:bg-slate-800/50'}`}>
                    <td className="px-4 py-3">
                      <p className="text-white text-sm font-medium">{u.full_name}</p>
                      <p className="text-slate-400 text-xs">{new Date(u.created_at).toLocaleDateString('en-EG', { day: 'numeric', month: 'short' })}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-sm">{u.phone_number || '—'}</td>
                    <td className="px-4 py-3"><TierBadge tier={u.bidding_tier} /></td>
                    <td className="px-4 py-3 text-slate-300 text-sm">{formatCurrency(u.deposit_balance)}</td>
                    <td className="px-4 py-3">
                      {u.national_id_url
                        ? <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">Uploaded</span>
                        : <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">None</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {u.is_verified
                        ? <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="w-3 h-3" />Verified</span>
                        : <span className="flex items-center gap-1 text-xs text-amber-400"><AlertCircle className="w-3 h-3" />Pending</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <Eye className="w-4 h-4 text-slate-500" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* User detail panel */}
        {selectedUser && (
          <div className="w-80 flex-shrink-0 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 h-fit sticky top-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">User Details</h3>
              <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-white text-lg leading-none">✕</button>
            </div>

            <div className="flex flex-col gap-2.5 text-sm">
              <div className="flex items-start gap-2"><User className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" /><div><p className="text-slate-400 text-xs">Full Name</p><p className="text-white font-medium">{selectedUser.full_name}</p></div></div>
              <div className="flex items-start gap-2"><Phone className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" /><div><p className="text-slate-400 text-xs">Phone</p><p className="text-white font-medium">{selectedUser.phone_number || '—'}</p></div></div>
              <div className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" /><div><p className="text-slate-400 text-xs">Deposit Balance</p><p className="text-white font-medium">{formatCurrency(selectedUser.deposit_balance)}</p></div></div>
              <div className="flex items-start gap-2"><Filter className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" /><div><p className="text-slate-400 text-xs">Role</p><p className="text-white font-medium capitalize">{selectedUser.role}</p></div></div>
            </div>

            {/* National ID */}
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase mb-2">National ID</p>
              {idImageUrl ? (
                <a href={idImageUrl} target="_blank" rel="noopener noreferrer">
                  <img src={idImageUrl} alt="National ID" className="w-full rounded-xl border border-slate-700 object-cover max-h-40 hover:opacity-90 transition-opacity" />
                  <p className="text-xs text-blue-400 mt-1 text-center">Click to view full size</p>
                </a>
              ) : selectedUser.national_id_url ? (
                <div className="flex items-center justify-center py-6 bg-slate-800 rounded-xl"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
              ) : (
                <div className="flex items-center justify-center py-6 bg-slate-800 rounded-xl"><p className="text-slate-500 text-sm">No ID uploaded</p></div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
              {!selectedUser.is_verified ? (
                <button onClick={() => verifyUser(selectedUser.id, true)} disabled={processing || !selectedUser.national_id_url}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Verify User
                </button>
              ) : (
                <button onClick={() => verifyUser(selectedUser.id, false)} disabled={processing}
                  className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 border border-red-500/20">
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Remove Verification
                </button>
              )}
              {selectedUser.role !== 'admin' && (
                <button onClick={() => setAdmin(selectedUser.id)} disabled={processing}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl text-sm transition-colors">
                  Make Admin
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
