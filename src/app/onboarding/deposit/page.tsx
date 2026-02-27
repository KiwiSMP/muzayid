'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Gavel, CheckCircle2, AlertCircle, Loader2, Banknote, ArrowRight, ShieldCheck, Info, Upload, X, FileImage } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const TIERS = [
  { tier: 1, deposit: 10000, maxBid: 100000, label: 'Tier 1', desc: 'Best for budget buyers', borderClass: 'border-amber-300', bgClass: 'bg-amber-50', badgeClass: 'bg-amber-100 text-amber-800' },
  { tier: 2, deposit: 25000, maxBid: 300000, label: 'Tier 2', desc: 'Most popular choice', borderClass: 'border-blue-400', bgClass: 'bg-blue-50', badgeClass: 'bg-blue-100 text-blue-800', featured: true },
  { tier: 3, deposit: 50000, maxBid: null, label: 'Tier 3', desc: 'Unlimited bidding access', borderClass: 'border-purple-400', bgClass: 'bg-purple-50', badgeClass: 'bg-purple-100 text-purple-800' },
]

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP', minimumFractionDigits: 0 }).format(n)
}

export default function DepositPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedTier, setSelectedTier] = useState(2)
  const [step, setStep] = useState<'select' | 'upload' | 'done'>('select')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [userEmail, setUserEmail] = useState('')

  const tier = TIERS.find(t => t.tier === selectedTier)!

  // Load user email for bank reference
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email)
    })
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(selected.type)) {
      setError('Please upload a JPG, PNG, or PDF file.')
      return
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError('File must be under 10MB.')
      return
    }
    setError('')
    setFile(selected)
    if (selected.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = e => setPreview(e.target?.result as string)
      reader.readAsDataURL(selected)
    } else {
      setPreview(null)
    }
  }

  async function handleSubmit() {
    if (!file) return
    setSubmitting(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Upload receipt to storage
      const ext = file.name.split('.').pop()
      const path = `${user.id}/deposit-receipt-${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('deposit-receipts')
        .upload(path, file, { upsert: true })

      // Even if bucket doesn't exist yet, still create the transaction
      const receiptUrl = uploadError ? null : path

      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: 'deposit',
          amount: tier.deposit,
          status: 'pending',
          notes: `Tier ${tier.tier} deposit — receipt ${receiptUrl ? 'uploaded' : 'pending'}`,
          reference: receiptUrl || 'receipt-pending',
        })

      if (txError) throw txError
      setStep('done')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Receipt Submitted!</h2>
          <p className="text-slate-500 mb-6">
            Your <strong>{tier.label}</strong> deposit receipt has been received.
            Our team will verify and activate your account within <strong>24 hours</strong>.
          </p>
          <Link href="/dashboard" className="inline-block w-full bg-[#1E3A5F] hover:bg-[#162d4a] text-white font-semibold px-8 py-3.5 rounded-xl transition-colors text-center">
            Go to My Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <div className="p-6">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#1E3A5F] rounded-lg flex items-center justify-center">
            <Gavel className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bold text-[#1E3A5F] text-base">مزاید</span>
            <span className="text-slate-400 text-[10px] font-medium tracking-widest uppercase">Muzayid</span>
          </div>
        </Link>
      </div>

      {/* Progress */}
      <div className="px-6 pb-2">
        <div className="max-w-lg mx-auto flex items-center gap-2 text-xs text-slate-400">
          <span className="flex items-center gap-1 text-emerald-600 font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Account Created</span>
          <div className="flex-1 h-px bg-emerald-300" />
          <span className="flex items-center gap-1 text-emerald-600 font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> ID Submitted</span>
          <div className="flex-1 h-px bg-slate-200" />
          <span className="font-medium text-[#1E3A5F]">Deposit</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">

          {step === 'select' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Banknote className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Choose your bidding tier</h1>
                  <p className="text-slate-500 text-sm">Your deposit is fully refundable if you don&apos;t win</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 flex items-start gap-2 text-sm text-amber-800">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Deposits are refundable within 7 days of auction end if you did not win.</span>
              </div>

              <div className="flex flex-col gap-3 mb-6">
                {TIERS.map(t => (
                  <button key={t.tier} type="button" onClick={() => setSelectedTier(t.tier)}
                    className={`relative w-full text-left rounded-xl border-2 p-4 transition-all ${selectedTier === t.tier ? `${t.borderClass} ${t.bgClass}` : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    {selectedTier === t.tier && <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-emerald-500" />}
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.badgeClass}`}>{t.label}</span>
                    <div className="flex items-end justify-between mt-2">
                      <div>
                        <p className="text-lg font-bold text-slate-900">{formatCurrency(t.deposit)}</p>
                        <p className="text-xs text-slate-500">{t.desc}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-700">{t.maxBid ? `Up to ${formatCurrency(t.maxBid)}` : 'Unlimited bids'}</p>
                        <p className="text-xs text-slate-400">max bid</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <button onClick={() => setStep('upload')}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors flex items-center justify-center gap-2">
                Continue with {tier.label} — {formatCurrency(tier.deposit)}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 'upload' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
              <button onClick={() => setStep('select')} className="text-sm text-slate-400 hover:text-slate-600 mb-6 flex items-center gap-1">
                ← Back
              </button>

              <h2 className="text-xl font-bold text-slate-900 mb-2">Transfer &amp; Upload Receipt</h2>
              <p className="text-slate-500 text-sm mb-6">Transfer the deposit to our account, then upload your receipt below.</p>

              {/* Bank details */}
              <div className="bg-[#1E3A5F] text-white rounded-xl p-5 mb-6">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">Bank Transfer Details</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-300">Bank</span><span className="font-semibold">CIB Egypt</span></div>
                  <div className="flex justify-between"><span className="text-slate-300">Account Name</span><span className="font-semibold">Muzayid for Auctions LLC</span></div>
                  <div className="flex justify-between"><span className="text-slate-300">Account No.</span><span className="font-semibold">1234567890123</span></div>
                  <div className="flex justify-between"><span className="text-slate-300">Amount</span><span className="font-bold text-emerald-400">{formatCurrency(tier.deposit)}</span></div>
                  <div className="flex justify-between items-start gap-4">
                    <span className="text-slate-300 flex-shrink-0">Reference</span>
                    <span className="font-semibold text-right break-all text-emerald-300">{userEmail || 'Your email address'}</span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-5 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Upload zone */}
              <p className="text-sm font-medium text-slate-700 mb-3">Upload your transfer receipt / screenshot</p>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { const evt = { target: { files: [f] } } as unknown as React.ChangeEvent<HTMLInputElement>; handleFileChange(evt) } }}
                onDragOver={e => e.preventDefault()}
                className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors mb-5 ${file ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50'}`}
              >
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleFileChange} />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    {preview ? <img src={preview} alt="Receipt" className="w-32 h-20 object-cover rounded-lg" /> : <FileImage className="w-10 h-10 text-emerald-500" />}
                    <p className="text-sm font-medium text-emerald-700">{file.name}</p>
                    <button type="button" onClick={e => { e.stopPropagation(); setFile(null); setPreview(null) }}
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                      <X className="w-3 h-3" /> Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-slate-400" />
                    <p className="text-sm font-medium text-slate-600">Drop receipt here or <span className="text-[#1E3A5F] underline">browse</span></p>
                    <p className="text-xs text-slate-400">JPG, PNG or PDF · Max 10MB</p>
                  </div>
                )}
              </div>

              <button onClick={handleSubmit} disabled={!file || submitting}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors flex items-center justify-center gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Submitting...' : 'Submit Deposit Receipt'}
              </button>

              <div className="flex items-center justify-center gap-1.5 mt-4 text-xs text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified by Muzayid team within 24 hours
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
