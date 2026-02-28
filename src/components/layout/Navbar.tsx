'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/i18n/LangContext'
import {
  Gavel, Bell, ChevronDown, User, LogOut, LayoutDashboard,
  Shield, Menu, X, Globe, Settings
} from 'lucide-react'
import type { UserProfile, Notification } from '@/types'

interface NavbarProps {
  // server-rendered user for SSR, client will hydrate
  initialUser?: { full_name: string; bidding_tier: number; is_admin?: boolean } | null
}

export default function Navbar({ initialUser }: NavbarProps) {
  const { lang, setLang, tr, isRTL } = useLang()
  const [user, setUser] = useState(initialUser || null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotif, setShowNotif] = useState(false)
  const [showUser, setShowUser] = useState(false)
  const [showMobile, setShowMobile] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()

    // Listen for auth changes — this is the KEY fix for "loading forever"
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // On initial load, trust the server-rendered initialUser to avoid flash of logged-out state
      if (event === 'INITIAL_SESSION' && initialUser) return

      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('full_name, bidding_tier, is_admin')
          .eq('id', session.user.id)
          .single()
        setUser(profile)

        // Load notifications
        const { data: notifs } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(20)
        if (notifs) {
          setNotifications(notifs)
          setUnreadCount(notifs.filter((n: Notification) => !n.read).length)
        }
      } else {
        setUser(null)
        setNotifications([])
        setUnreadCount(0)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false)
      if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUser(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut({ scope: 'global' })
    window.location.replace('/')
  }

  async function markAllRead() {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', authUser.id).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  const tierBadge: Record<number, string> = {
    0: '',
    1: 'bg-amber-100 text-amber-700',
    2: 'bg-blue-100 text-blue-700',
    3: 'bg-purple-100 text-purple-700',
  }
  const tierLabel: Record<number, string> = {
    0: '', 1: 'T1', 2: 'T2', 3: 'T3'
  }

  return (
    <nav className={`sticky top-0 z-50 transition-all duration-200 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200' : 'bg-white border-b border-slate-200'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-9 h-9 bg-[#1E3A5F] rounded-xl flex items-center justify-center shadow-sm">
              <Gavel className="w-[18px] h-[18px] text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-black text-[#1E3A5F] text-base tracking-tight">مزايد</span>
              <span className="text-slate-400 text-[9px] font-semibold tracking-[0.15em] uppercase">MUZAYID</span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              {tr('nav_home')}
            </Link>
            <Link href="/auctions" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              {tr('nav_auctions')}
            </Link>
            <Link href="/how-it-works" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              {tr('nav_how')}
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">

            {/* Language toggle */}
            <button
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg px-2.5 py-1.5 transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              {lang === 'en' ? 'عربي' : 'EN'}
            </button>

            {user ? (
              <>
                {/* Notifications bell */}
                <div ref={notifRef} className="relative">
                  <button
                    onClick={() => { setShowNotif(!showNotif); setShowUser(false) }}
                    className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center min-w-[18px] min-h-[18px] px-0.5">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotif && (
                    <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} top-full mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50`}>
                      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                        <span className="font-bold text-slate-900 text-sm">{tr('notif_title')}</span>
                        {unreadCount > 0 && (
                          <button onClick={markAllRead} className="text-xs text-[#1E3A5F] hover:underline font-medium">
                            {tr('notif_mark_read')}
                          </button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="py-8 text-center text-sm text-slate-400">
                            {tr('notif_empty')}
                          </div>
                        ) : (
                          notifications.map(n => (
                            <div key={n.id} className={`px-4 py-3 border-b border-slate-50 ${!n.read ? 'bg-blue-50/60' : ''}`}>
                              {!n.read && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full inline-block mr-2" />}
                              <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>
                              <p className="text-xs text-slate-400 mt-1">
                                {new Date(n.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* User menu */}
                <div ref={userRef} className="relative">
                  <button
                    onClick={() => { setShowUser(!showUser); setShowNotif(false) }}
                    className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#1E3A5F] flex items-center justify-center text-white text-xs font-bold">
                      {user.full_name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="hidden sm:flex flex-col items-start leading-none">
                      <span className="text-xs font-semibold text-slate-800 max-w-[100px] truncate">
                        {user.full_name?.split(' ')[0]}
                      </span>
                      {user.bidding_tier > 0 && (
                        <span className={`text-[10px] font-bold px-1 rounded mt-0.5 ${tierBadge[user.bidding_tier]}`}>
                          {tierLabel[user.bidding_tier]}
                        </span>
                      )}
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {showUser && (
                    <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} top-full mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50`}>
                      <div className="px-4 py-3 border-b border-slate-100">
                        <p className="font-semibold text-slate-900 text-sm truncate">{user.full_name}</p>
                        {user.bidding_tier > 0 && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tierBadge[user.bidding_tier]}`}>
                            Tier {user.bidding_tier}
                          </span>
                        )}
                      </div>
                      <Link href="/dashboard" onClick={() => setShowUser(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                        <LayoutDashboard className="w-4 h-4 text-slate-400" />
                        {tr('nav_dashboard')}
                      </Link>
                      <Link href="/settings" onClick={() => setShowUser(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                        <Settings className="w-4 h-4 text-slate-400" />
                        {tr('nav_settings')}
                      </Link>
                      {user.is_admin && (
                        <Link href="/admin" onClick={() => setShowUser(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                          <Shield className="w-4 h-4 text-slate-400" />
                          {tr('nav_admin')}
                        </Link>
                      )}
                      <button onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-slate-100">
                        <LogOut className="w-4 h-4" />
                        {tr('nav_logout')}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/auth/login"
                  className="hidden sm:inline-flex text-sm font-semibold text-slate-700 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors">
                  {tr('nav_login')}
                </Link>
                <Link href="/auth/register"
                  className="inline-flex bg-[#1E3A5F] hover:bg-[#162d4a] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm">
                  {tr('nav_register')}
                </Link>
              </>
            )}

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              onClick={() => setShowMobile(!showMobile)}
            >
              {showMobile ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {showMobile && (
          <div className="md:hidden py-3 border-t border-slate-100 space-y-1">
            <Link href="/" onClick={() => setShowMobile(false)}
              className="block px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg">
              {tr('nav_home')}
            </Link>
            <Link href="/auctions" onClick={() => setShowMobile(false)}
              className="block px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg">
              {tr('nav_auctions')}
            </Link>
            <Link href="/how-it-works" onClick={() => setShowMobile(false)}
              className="block px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg">
              {tr('nav_how')}
            </Link>
            <button
              onClick={() => { setLang(lang === 'en' ? 'ar' : 'en'); setShowMobile(false) }}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg w-full">
              <Globe className="w-4 h-4" />
              {lang === 'en' ? 'عربي' : 'English'}
            </button>
            {!user && (
              <div className="pt-2 flex gap-2">
                <Link href="/auth/login" onClick={() => setShowMobile(false)}
                  className="flex-1 text-center text-sm font-semibold text-slate-700 py-2 border border-slate-200 rounded-xl">
                  {tr('nav_login')}
                </Link>
                <Link href="/auth/register" onClick={() => setShowMobile(false)}
                  className="flex-1 text-center text-sm font-semibold text-white bg-[#1E3A5F] py-2 rounded-xl">
                  {tr('nav_register')}
                </Link>
              </div>
            )}
            {user && (
              <button onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg w-full">
                <LogOut className="w-4 h-4" />
                {tr('nav_logout')}
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
