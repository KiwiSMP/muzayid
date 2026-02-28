'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Gavel, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/i18n/LangContext'

// Password strength checker
function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[0-9]/.test(password)) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  if (score <= 1) return { score, label: 'Weak · ضعيفة', color: 'bg-red-500' }
  if (score <= 2) return { score, label: 'Fair · مقبولة', color: 'bg-orange-400' }
  if (score <= 3) return { score, label: 'Good · جيدة', color: 'bg-yellow-400' }
  if (score <= 4) return { score, label: 'Strong · قوية', color: 'bg-emerald-400' }
  return { score, label: 'Very Strong · قوية جداً', color: 'bg-emerald-600' }
}

function PasswordStrengthBar({ password }: { password: string }) {
  if (!password) return null
  const { score, label, color } = getPasswordStrength(password)
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < score ? color : 'bg-slate-200'}`} />
        ))}
      </div>
      <p className={`text-xs font-medium ${score <= 2 ? 'text-red-500' : score <= 3 ? 'text-yellow-600' : 'text-emerald-600'}`}>
        {label}
      </p>
    </div>
  )
}

function PasswordChecklist({ password }: { password: string }) {
  const checks = [
    { en: 'At least 8 characters', ar: '8 أحرف على الأقل', pass: password.length >= 8 },
    { en: 'Contains a number', ar: 'يحتوي على رقم', pass: /\d/.test(password) },
    { en: 'Contains uppercase & lowercase', ar: 'يحتوي على أحرف كبيرة وصغيرة', pass: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { en: 'Contains a special character', ar: 'يحتوي على رمز خاص', pass: /[^a-zA-Z0-9]/.test(password) },
  ]
  if (!password) return null
  return (
    <div className="flex flex-col gap-1 mt-2">
      {checks.map(c => (
        <div key={c.en} className={`flex items-center gap-1.5 text-xs ${c.pass ? 'text-emerald-600' : 'text-slate-400'}`}>
          <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
          {c.en}
        </div>
      ))}
    </div>
  )
}

export default function RegisterPage() {
  const { tr, isRTL } = useLang()

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [whatsappConsent, setWhatsappConsent] = useState(true)
  const [emailConsent, setEmailConsent] = useState(true)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const validateEgyptianPhone = useCallback((p: string) => {
    return /^(\+20|0)?1[0125]\d{8}$/.test(p.replace(/\s/g, ''))
  }, [])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Client-side validation
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. · كلمتا المرور غير متطابقتين.')
      setLoading(false)
      return
    }

    const strength = getPasswordStrength(password)
    if (strength.score < 2) {
      setError('Please choose a stronger password. Include numbers and uppercase letters.')
      setLoading(false)
      return
    }

    if (!validateEgyptianPhone(phone)) {
      setError('Please enter a valid Egyptian phone number (e.g. 01012345678). · أدخل رقم هاتف مصري صالح.')
      setLoading(false)
      return
    }

    if (!termsAccepted) {
      setError('Please accept the Terms of Service to continue.')
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()

      // Check if email already registered (gracefully)
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone_number: phone.replace(/\s/g, ''),
            whatsapp_alerts: whatsappConsent,
            email_notifications: emailConsent,
            notif_new_car: true,
            notif_outbid: true,
            preferred_lang: 'en',
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('This email is already registered. Please sign in. · هذا البريد مسجل بالفعل.')
        } else {
          setError(signUpError.message)
        }
        setLoading(false)
        return
      }

      setDone(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">{tr('auth_check_email')}</h2>
          <p className="text-slate-500 mb-2 text-sm">
            {tr('auth_check_email_desc')}{' '}
            <span className="font-semibold text-slate-700">{email}</span>.
          </p>
          <p className="text-slate-400 text-sm mb-6">
            Click the confirmation link to activate your account, then sign in.
            انقر على رابط التأكيد لتفعيل حسابك، ثم سجل الدخول.
          </p>
          <Link href="/auth/login"
            className="inline-block bg-[#1E3A5F] text-white font-bold px-8 py-3 rounded-xl hover:bg-[#162d4a] transition-colors text-sm">
            {tr('auth_go_login')}
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
            <span className="font-black text-[#1E3A5F] text-base">مزايد</span>
            <span className="text-slate-400 text-[10px] font-semibold tracking-widest uppercase">Muzayid</span>
          </div>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-[#1E3A5F]" />
              <h1 className="text-2xl font-bold text-slate-900">{tr('auth_register_title')}</h1>
            </div>
            <p className="text-slate-500 text-sm mb-7">{tr('auth_register_subtitle')}</p>

            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-6 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="flex flex-col gap-5">
              {/* Full name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{tr('auth_fullname')}</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Ahmed Mohamed · أحمد محمد"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]"
                />
              </div>

              {/* Egyptian phone */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{tr('auth_phone')}</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="01012345678"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]"
                  dir="ltr"
                />
                {phone && !validateEgyptianPhone(phone) && (
                  <p className="text-xs text-red-500 mt-0.5">Enter a valid Egyptian number: 010, 011, 012, or 015</p>
                )}
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{tr('auth_email')}</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]"
                  dir="ltr"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{tr('auth_password')}</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]"
                    dir="ltr"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordStrengthBar password={password} />
                <PasswordChecklist password={password} />
              </div>

              {/* Confirm password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{tr('auth_confirm_password')}</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 ${confirmPassword && password !== confirmPassword ? 'border-red-300 bg-red-50' : 'border-slate-200 focus:border-[#1E3A5F]'}`}
                  dir="ltr"
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-red-500">Passwords don't match</p>
                )}
                {confirmPassword && password === confirmPassword && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Passwords match
                  </p>
                )}
              </div>

              {/* Notification consents */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Notifications · الإشعارات</p>

                <label className="flex items-start gap-3 cursor-pointer bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <input
                    type="checkbox"
                    checked={emailConsent}
                    onChange={e => setEmailConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-blue-600 flex-shrink-0"
                  />
                  <div>
                    <p className="text-sm font-semibold text-blue-800">
                      ✉️ Email Alerts · تنبيهات البريد
                    </p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      Outbid alerts, auction wins &amp; new listings — recommended
                      <br />تنبيهات التجاوز والفوز والعربيات الجديدة — مستحسن
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer bg-green-50 border border-green-200 rounded-xl p-3">
                  <input
                    type="checkbox"
                    checked={whatsappConsent}
                    onChange={e => setWhatsappConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-green-600 flex-shrink-0"
                  />
                  <div>
                    <p className="text-sm font-semibold text-green-800">
                      📱 WhatsApp Alerts · تنبيهات واتساب
                    </p>
                    <p className="text-xs text-green-700 mt-0.5">
                      {tr('auth_whatsapp_consent')}
                    </p>
                  </div>
                </label>
              </div>

              {/* Terms */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={termsAccepted}
                  onChange={e => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#1E3A5F] flex-shrink-0"
                />
                <p className="text-xs text-slate-500">
                  {tr('auth_terms')}{' '}
                  <Link href="/terms" className="text-[#1E3A5F] hover:underline font-semibold">{tr('auth_terms_link')}</Link>
                  {' '}{tr('auth_and')}{' '}
                  <Link href="/privacy" className="text-[#1E3A5F] hover:underline font-semibold">{tr('auth_privacy_link')}</Link>.
                </p>
              </label>

              <button
                type="submit"
                disabled={loading || password !== confirmPassword}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-bold py-3.5 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? tr('auth_registering') : tr('auth_register_btn')}
              </button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-6">
              {tr('auth_have_account')}{' '}
              <Link href="/auth/login" className="text-[#1E3A5F] font-bold hover:underline">
                {tr('auth_login_link')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
