'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/layout/Navbar'
import { useLang } from '@/i18n/LangContext'
import { User, Bell, Globe, Loader2, CheckCircle2, AlertCircle, Shield, Mail, MessageCircle } from 'lucide-react'
import Link from 'next/link'

interface Profile {
  id: string
  full_name: string
  email?: string
  phone_number?: string
  is_verified: boolean
  bidding_tier: number
  deposit_balance: number
  whatsapp_alerts: boolean
  preferred_lang: 'en' | 'ar'
  email_notifications?: boolean
  notif_new_car?: boolean
  notif_outbid?: boolean
}

const inp = "w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30 focus:border-[#1E3A5F] transition-colors bg-white"

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-[#1E3A5F]' : 'bg-slate-200'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

export default function SettingsPage() {
  const { lang, setLang, tr, isRTL } = useLang()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'security'>('profile')

  const [form, setForm] = useState({
    full_name: '',
    phone_number: '',
    whatsapp_alerts: true,
    email_notifications: true,
    notif_new_car: true,
    notif_outbid: true,
    preferred_lang: 'en' as 'en' | 'ar',
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth/login'; return }

      const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
      if (data) {
        setProfile({ ...data, email: user.email })
        setForm({
          full_name: data.full_name || '',
          phone_number: data.phone_number || '',
          whatsapp_alerts: data.whatsapp_alerts !== false,
          email_notifications: data.email_notifications !== false,
          notif_new_car: data.notif_new_car !== false,
          notif_outbid: data.notif_outbid !== false,
          preferred_lang: data.preferred_lang || 'en',
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  function setF<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSave() {
    if (!profile) return
    setSaving(true); setError(''); setSaved(false)
    try {
      const supabase = createClient()
      const { error: err } = await supabase.from('users').update({
        full_name: form.full_name,
        phone_number: form.phone_number,
        whatsapp_alerts: form.whatsapp_alerts,
        email_notifications: form.email_notifications,
        notif_new_car: form.notif_new_car,
        notif_outbid: form.notif_outbid,
        preferred_lang: form.preferred_lang,
      }).eq('id', profile.id)
      if (err) throw err
      // Apply language change immediately
      setLang(form.preferred_lang)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const tierLabels: Record<number, string> = { 0: 'No Tier', 1: 'Starter', 2: 'Professional', 3: 'Elite' }
  const tierColors: Record<number, string> = {
    0: 'bg-slate-100 text-slate-500',
    1: 'bg-amber-100 text-amber-700',
    2: 'bg-blue-100 text-blue-700',
    3: 'bg-purple-100 text-purple-700',
  }

  if (loading) return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Navbar initialUser={null} />
      <div className="flex items-center justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-[#1E3A5F]" /></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC]" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar initialUser={profile ? { id: profile.id, full_name: profile.full_name, bidding_tier: profile.bidding_tier } : null} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-slate-900">{tr('settings_title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{profile?.email}</p>
        </div>

        {/* Account summary card */}
        <div className="bg-[#1E3A5F] text-white rounded-2xl p-5 mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-xl font-black">
              {profile?.full_name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <p className="font-bold text-base">{profile?.full_name}</p>
              <p className="text-slate-300 text-sm">{profile?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {profile && (
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tierColors[profile.bidding_tier]}`}>
                {tierLabels[profile.bidding_tier]}
              </span>
            )}
            {profile?.is_verified ? (
              <span className="flex items-center gap-1.5 text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" />Verified
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-300 text-xs font-semibold">
                <AlertCircle className="w-4 h-4" />Unverified
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 mb-6 w-fit shadow-sm">
          {([
            { key: 'profile', label: tr('settings_profile'), icon: User },
            { key: 'notifications', label: tr('settings_notifications'), icon: Bell },
            { key: 'security', label: tr('settings_security'), icon: Shield },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === key ? 'bg-[#1E3A5F] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-5 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{tr('settings_name')}</label>
              <input value={form.full_name} onChange={e => setF('full_name', e.target.value)} className={inp} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{tr('settings_email')}</label>
              <input value={profile?.email || ''} disabled className={inp + ' bg-slate-50 text-slate-400 cursor-not-allowed'} />
              <p className="text-xs text-slate-400 mt-1">Email cannot be changed here. Contact support.</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{tr('settings_phone')}</label>
              <input value={form.phone_number} onChange={e => setF('phone_number', e.target.value)} placeholder="+201000000000" className={inp} dir="ltr" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">{tr('settings_lang')}</label>
              <div className="flex gap-3">
                {(['en', 'ar'] as const).map(l => (
                  <button key={l} type="button"
                    onClick={() => setF('preferred_lang', l)}
                    className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-all ${form.preferred_lang === l ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 text-[#1E3A5F]' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    {l === 'en' ? '🇬🇧  English' : '🇪🇬  العربية المصرية'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {activeTab === 'notifications' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-5">
            {[
              {
                icon: Mail,
                key: 'email_notifications' as const,
                label: tr('settings_notif_email'),
                desc: tr('settings_notif_email_desc'),
                color: 'text-blue-600 bg-blue-50',
              },
              {
                icon: MessageCircle,
                key: 'whatsapp_alerts' as const,
                label: tr('settings_notif_whatsapp'),
                desc: tr('settings_notif_whatsapp_desc'),
                color: 'text-green-600 bg-green-50',
              },
              {
                icon: Bell,
                key: 'notif_new_car' as const,
                label: tr('settings_notif_new_car'),
                desc: tr('settings_notif_new_car_desc'),
                color: 'text-amber-600 bg-amber-50',
              },
              {
                icon: Bell,
                key: 'notif_outbid' as const,
                label: tr('settings_notif_outbid'),
                desc: tr('settings_notif_outbid_desc'),
                color: 'text-red-600 bg-red-50',
              },
            ].map(({ icon: Icon, key, label, desc, color }) => (
              <div key={key} className="flex items-center justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{label}</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
                <Toggle checked={form[key]} onChange={v => setF(key, v)} />
              </div>
            ))}
          </div>
        )}

        {/* SECURITY TAB */}
        {activeTab === 'security' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-slate-700 mb-1">KYC Verification Status</p>
              <div className={`flex items-center gap-2 text-sm font-bold ${profile?.is_verified ? 'text-emerald-600' : 'text-amber-600'}`}>
                {profile?.is_verified ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {profile?.is_verified ? 'Identity Verified' : 'Verification Pending'}
              </div>
              {!profile?.is_verified && (
                <Link href="/onboarding/kyc" className="inline-block mt-3 text-xs font-semibold bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors">
                  Upload ID to Verify
                </Link>
              )}
            </div>

            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-slate-700 mb-1">Bidding Tier</p>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tierColors[profile?.bidding_tier || 0]}`}>
                  {tierLabels[profile?.bidding_tier || 0]}
                </span>
                <span className="text-sm text-slate-500">
                  — Deposit: {(profile?.deposit_balance || 0).toLocaleString('en-EG')} EGP
                </span>
              </div>
              {(profile?.bidding_tier || 0) < 3 && (
                <Link href="/onboarding/deposit" className="inline-block mt-3 text-xs font-semibold bg-[#1E3A5F] text-white px-3 py-1.5 rounded-lg hover:bg-[#162d4a] transition-colors">
                  Upgrade Tier
                </Link>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
              <p className="font-semibold mb-1">Password</p>
              <p className="text-xs">To change your password, use the "Forgot Password" link on the login page.</p>
            </div>
          </div>
        )}

        {/* Save button */}
        {activeTab !== 'security' && (
          <button onClick={handleSave} disabled={saving}
            className="mt-5 w-full flex items-center justify-center gap-2 bg-[#1E3A5F] hover:bg-[#162d4a] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-colors">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />{tr('loading')}</> :
             saved ? <><CheckCircle2 className="w-4 h-4" />{tr('settings_saved')}</> :
             tr('settings_save')}
          </button>
        )}
      </div>
    </div>
  )
}
