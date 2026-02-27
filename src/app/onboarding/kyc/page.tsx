'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import {
  Gavel, Upload, CheckCircle2, AlertCircle,
  Loader2, ShieldCheck, FileImage, X
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function KYCPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

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

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (dropped) {
      const fakeEvent = { target: { files: [dropped] } } as unknown as React.ChangeEvent<HTMLInputElement>
      handleFileChange(fakeEvent)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return

    setUploading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const ext = file.name.split('.').pop()
      const path = `${user.id}/national-id.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('national-ids')
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('national-ids')
        .getPublicUrl(path)

      const { error: updateError } = await supabase
        .from('users')
        .update({ national_id_url: publicUrl })
        .eq('id', user.id)

      if (updateError) throw updateError

      setDone(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">ID Submitted</h2>
          <p className="text-slate-500 mb-2">
            Your national ID has been uploaded successfully.
            Our team will verify it within <strong>24 hours</strong>.
          </p>
          <p className="text-slate-400 text-sm mb-8">
            While you wait, go ahead and make your deposit to unlock bidding.
          </p>
          <Link
            href="/onboarding/deposit"
            className="inline-block w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors text-center"
          >
            Continue to Deposit →
          </Link>
          <Link
            href="/dashboard"
            className="inline-block w-full mt-3 text-slate-500 hover:text-slate-700 text-sm py-2"
          >
            Skip for now — go to dashboard
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
        <div className="max-w-md mx-auto flex items-center gap-2 text-xs text-slate-400">
          <span className="flex items-center gap-1 text-emerald-600 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> Account Created
          </span>
          <div className="flex-1 h-px bg-slate-200" />
          <span className="font-medium text-[#1E3A5F]">ID Verification</span>
          <div className="flex-1 h-px bg-slate-200" />
          <span>Deposit</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Verify your identity</h1>
                <p className="text-slate-500 text-sm">Required to start bidding</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 my-6 text-sm text-slate-600 space-y-1.5">
              <p className="font-medium text-slate-700">What you need:</p>
              <p>• Egyptian National ID card (الرقم القومى)</p>
              <p>• Clear photo or scan of both sides</p>
              <p>• File must be JPG, PNG, or PDF under 10MB</p>
            </div>

            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-5 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Drop zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  file
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    {preview ? (
                      <img src={preview} alt="ID preview" className="w-32 h-20 object-cover rounded-lg" />
                    ) : (
                      <FileImage className="w-10 h-10 text-emerald-500" />
                    )}
                    <p className="text-sm font-medium text-emerald-700">{file.name}</p>
                    <p className="text-xs text-emerald-600">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setFile(null); setPreview(null) }}
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 mt-1"
                    >
                      <X className="w-3 h-3" /> Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-slate-400" />
                    <p className="text-sm font-medium text-slate-600">
                      Drop your ID here, or <span className="text-[#1E3A5F] underline">browse</span>
                    </p>
                    <p className="text-xs text-slate-400">JPG, PNG or PDF · Max 10MB</p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!file || uploading}
                className="w-full bg-[#1E3A5F] hover:bg-[#162d4a] disabled:opacity-50 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                {uploading ? 'Uploading...' : 'Submit ID for Verification'}
              </button>
            </form>

            <p className="text-center text-xs text-slate-400 mt-4">
              Your ID is encrypted and stored securely. Never shared with third parties.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
