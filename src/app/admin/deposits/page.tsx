'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, XCircle, Loader2, DollarSign, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react'

interface DepositRow {
  id: string
  user_id: string
  amount: number
  status: string
  notes: string | null
  reference: string | null
  created_at: string
  user: { full_name: string; phone_number: string; deposit_balance: number; bidding_tier: number } | null
}

function formatCurrency(n: number) { return n.toLocaleString('en-EG') + ' EGP' }
function tierFromBalance(b: number) { if (b >= 50000) return 3; if (b >= 25000) return 2; if (b >= 10000) return 1; return 0 }

function Badge({ label, variant }: { label: string; variant: 'green' | 'amber' | 'red' | 'slate' }) {
  const cls = { green: 'bg-emerald-100 text-emerald-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', slate: 'bg-slate-100 text-slate-600' }
  return <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${cls[variant]}`}>{label}</span>
}

export default function DepositsPage() {
  const [deposits, setDeposits] = useState<DepositRow[]>([])
  const [tab, setTab] = useState<'pending' | 'completed' | 'failed'>('pending')
  const [selected, setSelected] = useState<DepositRow | null>(null)
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [loadingReceipt, setLoadingReceipt] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase
      .from('transactions')
      .select('*, user:users(full_name, phone_number, deposit_balance, bidding_tier)')
      .eq('type', 'deposit')
      .order('created_at', { ascending: false })
    setDeposits((data || []) as DepositRow[])
  }

  useEffect(() => { load() }, [])

  async function openDeposit(dep: DepositRow) {
    setSelected(dep)
    setReceiptUrl(null)
    if (!dep.reference || dep.reference === 'receipt-pending') return
    setLoadingReceipt(true)
    const supabase = createClient()
    if (dep.reference.startsWith('http')) {
      setReceiptUrl(dep.reference)
    } else {
      const { data } = await supabase.storage.from('deposit-receipts').createSignedUrl(dep.reference, 3600)
      setReceiptUrl(data?.signedUrl || null)
    }
    setLoadingReceipt(false)
  }

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function approve(dep: DepositRow) {
    setProcessing(true)
    const supabase = createClient()
    try {
      await supabase.from('transactions').update({ status: 'completed' }).eq('id', dep.id)
      const newBalance = (dep.user?.deposit_balance || 0) + dep.amount
      const newTier = tierFromBalance(newBalance)
      await supabase.from('users').update({ deposit_balance: newBalance, bidding_tier: newTier }).eq('id', dep.user_id)
      showToast(`Approved ${formatCurrency(dep.amount)} → ${dep.user?.full_name} is now Tier ${newTier}`)
      setSelected(null)
      await load()
    } catch { showToast('Failed to approve deposit', 'error') }
    setProcessing(false)
  }

  async function reject(dep: DepositRow) {
    setProcessing(true)
    const supabase = createClient()
    await supabase.from('transactions').update({ status: 'failed' }).eq('id', dep.id)
    showToast('Deposit rejected')
    setSelected(null)
    await load()
    setProcessing(false)
  }

  const filtered = deposits.filter(d => d.status === tab)
  const counts = { pending: deposits.filter(d => d.status === 'pending').length, completed: deposits.filter(d => d.status === 'completed').length, failed: deposits.filter(d => d.status === 'failed').length }

  return (
    <div className="p-8">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm shadow-lg ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Deposit Approvals</h1>
          <p className="text-slate-500 text-sm mt-1">Review transfer receipts and activate bidding tiers</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors">
          <RefreshCw className="w-4 h-4" />Refresh
        </button>
      </div>

      <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm w-fit mb-6">
        {(['pending', 'completed', 'failed'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setSelected(null) }}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors capitalize ${tab === t ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            {t} ({counts[t]})
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Table */}
        <div className={`flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden ${selected ? 'max-w-[58%]' : ''}`}>
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['User', 'Amount', 'Would Become', 'Receipt', 'Date', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16">
                  <DollarSign className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">No {tab} deposits</p>
                </td></tr>
              ) : filtered.map(dep => {
                const newBalance = (dep.user?.deposit_balance || 0) + dep.amount
                const newTier = tierFromBalance(newBalance)
                return (
                  <tr key={dep.id} onClick={() => openDeposit(dep)}
                    className={`cursor-pointer transition-colors ${selected?.id === dep.id ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                    <td className="px-4 py-3.5">
                      <p className="text-slate-900 text-sm font-semibold">{dep.user?.full_name}</p>
                      <p className="text-slate-400 text-xs">{dep.user?.phone_number}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-slate-900 font-bold text-sm">{formatCurrency(dep.amount)}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge label={`Tier ${newTier}`} variant={newTier >= 2 ? 'green' : newTier === 1 ? 'amber' : 'slate'} />
                    </td>
                    <td className="px-4 py-3.5">
                      {dep.reference && dep.reference !== 'receipt-pending'
                        ? <Badge label="Uploaded" variant="green" />
                        : <Badge label="Missing" variant="red" />}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs">
                      {new Date(dep.created_at).toLocaleDateString('en-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3.5">
                      {tab === 'pending' && <AlertCircle className="w-4 h-4 text-amber-400" />}
                      {tab === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {tab === 'failed' && <XCircle className="w-4 h-4 text-red-400" />}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Detail */}
        {selected && (
          <div className="w-80 flex-shrink-0 bg-white border border-slate-200 rounded-xl shadow-sm p-5 sticky top-6 h-fit">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Deposit Review</h3>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center">✕</button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 flex flex-col gap-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">User</span><span className="font-semibold text-slate-900">{selected.user?.full_name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Deposit Amount</span><span className="font-bold text-slate-900">{formatCurrency(selected.amount)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Current Balance</span><span className="text-slate-700">{formatCurrency(selected.user?.deposit_balance || 0)}</span></div>
              <div className="border-t border-slate-200 pt-2 flex justify-between"><span className="text-slate-500">New Balance</span><span className="font-bold text-emerald-600">{formatCurrency((selected.user?.deposit_balance || 0) + selected.amount)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">New Tier</span><span className="font-bold text-indigo-600">Tier {tierFromBalance((selected.user?.deposit_balance || 0) + selected.amount)}</span></div>
            </div>

            <div className="mb-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Transfer Receipt</p>
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 min-h-32 flex items-center justify-center">
                {loadingReceipt ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> :
                  receiptUrl ? (
                    receiptUrl.endsWith('.pdf') ? (
                      <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
                        className="flex flex-col items-center gap-2 p-6 text-indigo-600 hover:text-indigo-800">
                        <ExternalLink className="w-8 h-8" /><span className="text-sm font-medium">View PDF Receipt</span>
                      </a>
                    ) : (
                      <a href={receiptUrl} target="_blank" rel="noopener noreferrer">
                        <img src={receiptUrl} alt="Receipt" className="w-full object-contain max-h-48" />
                      </a>
                    )
                  ) : (
                    <div className="text-center p-6">
                      <AlertCircle className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                      <p className="text-slate-400 text-xs">No receipt uploaded</p>
                    </div>
                  )
                }
              </div>
            </div>

            {selected.status === 'pending' && (
              <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
                <button onClick={() => approve(selected)} disabled={processing}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Approve & Activate Tier
                </button>
                <button onClick={() => reject(selected)} disabled={processing}
                  className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-2.5 rounded-xl text-sm transition-colors border border-red-200">
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Reject Deposit
                </button>
              </div>
            )}
            {selected.status !== 'pending' && (
              <div className={`text-center py-3 rounded-xl text-sm font-bold ${selected.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                {selected.status === 'completed' ? '✓ Previously Approved' : '✕ Previously Rejected'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
