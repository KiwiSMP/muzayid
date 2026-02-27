'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Gavel, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/i18n/LangContext'

function LoginForm() {
  const { tr, isRTL } = useLang()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (error) {
        setError(
          error.message.includes('Invalid login credentials')
            ? 'Incorrect email or password. Please try again.'
            : error.message
        )
        setLoading(false)
        return
      }

      if (!data.session) {
        setError('No session created. Please check your email is confirmed.')
        setLoading(false)
        return
      }

      window.location.href = redirectTo === '/' ? '/dashboard' : redirectTo
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unexpected error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{tr('auth_login_title')}</h1>
        <p className="text-slate-500 text-sm mt-1">{tr('auth_login_subtitle')}</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-6 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide" htmlFor="email">
            {tr('auth_email')}
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] transition-colors"
            dir="ltr"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide" htmlFor="password">
              {tr('auth_password')}
            </label>
            <Link href="/auth/forgot-password" className="text-xs text-[#1E3A5F] hover:underline font-medium">
              {tr('auth_forgot')}
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] transition-colors"
              dir="ltr"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#1E3A5F] hover:bg-[#162d4a] disabled:opacity-60 text-white font-bold py-3.5 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? tr('auth_logging_in') : tr('auth_login_btn')}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        {tr('auth_no_account')}{' '}
        <Link href="/auth/register" className="text-[#1E3A5F] font-bold hover:underline">
          {tr('auth_register_link')}
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <div className="p-6">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#1E3A5F] rounded-lg flex items-center justify-center">
            <Gavel className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-black text-[#1E3A5F] text-base">مزايد</span>
            <span className="text-slate-400 text-[10px] font-semibold tracking-widest uppercase">Muzayid</span>
          </div>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Suspense fallback={
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center text-slate-400">
              Loading...
            </div>
          }>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
