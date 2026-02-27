import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/layout/Navbar'
import AuctionCard from '@/components/auction/AuctionCard'
import HomepageClient from '@/components/home/HomepageClient'
import { Gavel, ShieldCheck, Clock, TrendingUp, Star, Users, Award, CheckCircle2, Phone, Mail, MapPin, ChevronRight } from 'lucide-react'
import type { AuctionWithVehicle } from '@/types'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function getData() {
  try {
    const supabase = createClient()

    const [userRes, auctionsRes, statsRes] = await Promise.all([
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return null
        const { data } = await supabase
          .from('users')
          .select('full_name, bidding_tier, is_admin')
          .eq('id', user.id)
          .single()
        return data
      }),
      supabase
        .from('auctions')
        .select('*, vehicle:vehicles (*)')
        .in('status', ['active', 'upcoming', 'draft'])
        .order('status', { ascending: false }) // active first
        .order('end_time', { ascending: true })
        .limit(12),
      supabase.rpc('get_platform_stats').then(({ data }) => data, () => null),
    ])

    return {
      user: userRes,
      auctions: (auctionsRes.data as AuctionWithVehicle[]) || [],
      stats: statsRes || { live_count: 0, total_vehicles: 0, active_bidders: 0 },
    }
  } catch {
    return { user: null, auctions: [], stats: { live_count: 0, total_vehicles: 0, active_bidders: 0 } }
  }
}

const TIERS = [
  {
    nameKey: 'Starter',
    nameAr: 'المبتدئ',
    deposit: 10000,
    maxBid: 100000,
    desc: 'Perfect for first-time buyers and budget vehicles',
    descAr: 'مثالي للمشترين الجدد والسيارات الاقتصادية',
    featured: false,
    color: 'border-amber-200 bg-amber-50/50',
    badge: 'bg-amber-100 text-amber-700',
  },
  {
    nameKey: 'Professional',
    nameAr: 'المحترف',
    deposit: 25000,
    maxBid: 300000,
    desc: 'Most popular — access mid-range vehicles and fleet sales',
    descAr: 'الأكثر شعبية — وصول للسيارات المتوسطة وأساطيل الشركات',
    featured: true,
    color: 'border-[#1E3A5F] bg-[#1E3A5F]/5 ring-2 ring-[#1E3A5F]/20',
    badge: 'bg-[#1E3A5F] text-white',
  },
  {
    nameKey: 'Elite',
    nameAr: 'النخبة',
    deposit: 50000,
    maxBid: null,
    desc: 'Full access to all auctions — no ceiling',
    descAr: 'وصول كامل لجميع المزادات — بدون سقف',
    featured: false,
    color: 'border-purple-200 bg-purple-50/50',
    badge: 'bg-purple-100 text-purple-700',
  },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    en: { title: 'Register & Verify', desc: 'Create your account, upload your national ID, and complete KYC in minutes.' },
    ar: { title: 'سجل وتحقق', desc: 'أنشئ حسابك، ارفع بطاقتك القومية، وأكمل التحقق في دقائق.' },
    icon: Users,
    color: 'bg-blue-100 text-blue-600',
  },
  {
    step: '02',
    en: { title: 'Make a Deposit', desc: 'Choose your bidding tier and make a fully refundable deposit to unlock bidding.' },
    ar: { title: 'قدم إيداعاً', desc: 'اختر مستوى المزايدة وقدم إيداعاً قابلاً للاسترداد لفتح المزايدة.' },
    icon: Award,
    color: 'bg-emerald-100 text-emerald-600',
  },
  {
    step: '03',
    en: { title: 'Browse & Bid', desc: 'Inspect detailed condition reports and photos, then place your bids in real time.' },
    ar: { title: 'تصفح وزايد', desc: 'افحص التقارير والصور التفصيلية، ثم ضع مزايداتك في الوقت الفعلي.' },
    icon: Gavel,
    color: 'bg-amber-100 text-amber-600',
  },
  {
    step: '04',
    en: { title: 'Win & Collect', desc: 'Win your auction, receive your invoice, and complete the transfer with full documentation.' },
    ar: { title: 'اربح واستلم', desc: 'اربح المزاد، استلم فاتورتك، وأكمل النقل مع التوثيق الكامل.' },
    icon: CheckCircle2,
    color: 'bg-purple-100 text-purple-600',
  },
]

const TRUST_POINTS = [
  { en: '100% verified vehicles with full condition reports', ar: 'سيارات موثقة 100% مع تقارير حالة كاملة' },
  { en: 'Refundable deposits — no risk if you don\'t win', ar: 'إيداعات قابلة للاسترداد — لا مخاطرة إن لم تفز' },
  { en: 'Licensed by Egyptian auto trade authorities', ar: 'مرخصة من سلطات تجارة السيارات المصرية' },
  { en: 'Full ownership transfer documentation included', ar: 'توثيق نقل الملكية الكامل متضمن' },
  { en: 'Real-time bidding with instant outbid notifications', ar: 'مزايدة لحظية مع إشعارات فورية عند تجاوزك' },
  { en: 'Dedicated support in Arabic and English', ar: 'دعم متخصص بالعربية والإنجليزية' },
]

export default async function HomePage() {
  const { user, auctions, stats } = await getData()

  const liveAuctions = auctions.filter(a => a.status === 'active')
  const upcomingAuctions = auctions.filter(a => a.status === 'upcoming')

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Navbar initialUser={user} />

      {/* HERO */}
      <section className="relative bg-[#0F2337] text-white overflow-hidden">
        {/* Background grid pattern */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0F2337]/80" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-28">
          <div className="max-w-3xl">
            {/* Live badge */}
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-4 py-1.5 text-sm font-semibold text-emerald-300 mb-8">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              <span>مزادات حية الآن · {stats.live_count || liveAuctions.length} Live Auctions Active</span>
            </div>

            {/* Bilingual title */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-tight mb-3">
              مزايد<span className="text-emerald-400">.</span>
            </h1>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-300 mb-6">
              Egypt's Premier <span className="text-emerald-400">Auto Auction</span> Platform
            </h2>
            <p className="text-lg text-slate-400 mb-8 max-w-xl leading-relaxed">
              مزايدة فورية على السيارات المتضررة وسيارات الأساطيل.<br className="hidden sm:block" />
              Real-time bidding on salvage & corporate fleet vehicles. 100% transparent.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <a href="#auctions"
                className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-8 py-4 rounded-xl text-lg text-center transition-colors shadow-lg shadow-emerald-500/20">
                تصفح المزادات · Browse Auctions
              </a>
              <Link href="/auth/register"
                className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-8 py-4 rounded-xl text-lg text-center transition-colors">
                Register Free →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE STATS BAR */}
      <section className="bg-[#1E3A5F] text-white border-b border-[#162d4a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10">
            {[
              { icon: Gavel, value: liveAuctions.length.toString(), label: 'Live Auctions · مزادات حية' },
              { icon: TrendingUp, value: stats.total_vehicles?.toString() || '—', label: 'Vehicles Listed · سيارة مدرجة' },
              { icon: Users, value: stats.active_bidders?.toString() || '—', label: 'Active Bidders · مزايد نشط' },
              { icon: Clock, value: '5–7', label: 'Avg. Days Per Auction · أيام متوسط المزاد' },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex items-center gap-3 py-4 px-5 sm:px-8">
                <Icon className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-white font-black text-xl leading-none">{value}</p>
                  <p className="text-slate-400 text-xs mt-0.5 leading-tight">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AUCTION LISTINGS with filters */}
      <section id="auctions" className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-black text-slate-900">
              Live Auctions · <span className="text-[#1E3A5F]">المزادات الحية</span>
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              {liveAuctions.length > 0 ? `${liveAuctions.length} auctions live now` : 'Updated in real time'}
              {upcomingAuctions.length > 0 && ` · ${upcomingAuctions.length} upcoming`}
            </p>
          </div>
          <Link href="/auctions" className="text-sm font-semibold text-[#1E3A5F] hover:underline flex items-center gap-1">
            View all auctions <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Client-side filter tabs + search */}
        <HomepageClient auctions={auctions} />
      </section>

      {/* TRUST SIGNALS + HOW IT WORKS */}
      <section className="bg-white border-y border-slate-200 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

            {/* How it works */}
            <div>
              <div className="inline-flex items-center gap-2 bg-[#1E3A5F]/10 text-[#1E3A5F] rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider mb-4">
                How It Works · كيف يعمل
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-8 leading-tight">
                Simple. Transparent.<br />
                <span className="text-[#1E3A5F]">شفاف وسهل.</span>
              </h2>
              <div className="space-y-6">
                {HOW_IT_WORKS.map(({ step, en, ar, icon: Icon, color }) => (
                  <div key={step} className="flex gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="w-px flex-1 bg-slate-100" />
                    </div>
                    <div className="pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-black text-slate-300 tracking-wider">{step}</span>
                        <h3 className="font-bold text-slate-900">{en.title}</h3>
                        <span className="text-slate-300 hidden sm:block">·</span>
                        <h3 className="font-bold text-slate-500 hidden sm:block text-sm">{ar.title}</h3>
                      </div>
                      <p className="text-sm text-slate-500 leading-relaxed">{en.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust points */}
            <div>
              <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider mb-4">
                Why Muzayid · لماذا مزايد
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-8">
                Built for<br />
                <span className="text-emerald-600">Egypt's Market.</span>
              </h2>
              <div className="space-y-4">
                {TRUST_POINTS.map(({ en, ar }) => (
                  <div key={en} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{en}</p>
                      <p className="text-xs text-slate-400 mt-0.5" dir="rtl">{ar}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Testimonial */}
              <div className="mt-8 bg-slate-50 rounded-2xl p-5 border border-slate-200">
                <div className="flex items-center gap-1 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  "I found my workshop's next car at half the market price. The condition report was spot-on and the process was completely hassle-free."
                </p>
                <p className="text-xs text-slate-400 mt-2 font-semibold">— Ahmed M., Cairo · أحمد م.، القاهرة</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* UPCOMING AUCTIONS */}
      {upcomingAuctions.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black text-slate-900">
                Upcoming · <span className="text-blue-600">قادمة قريباً</span>
              </h2>
              <p className="text-slate-500 text-sm mt-1">Ending soon — register to bid</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {upcomingAuctions.slice(0, 4).map(auction => (
              <AuctionCard key={auction.id} auction={auction} />
            ))}
          </div>
        </section>
      )}

      {/* BIDDING TIERS */}
      <section className="bg-[#0F2337] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-4 py-1.5 text-sm font-bold text-emerald-300 mb-4">
              Refundable Deposits · إيداعات قابلة للاسترداد
            </div>
            <h2 className="text-3xl font-black mb-3">
              Choose Your Bidding Tier<br />
              <span className="text-slate-400">اختر مستوى مزايدتك</span>
            </h2>
            <p className="text-slate-400 max-w-lg mx-auto text-sm">
              Your deposit is 100% refundable if you don't win any auctions within 7 days.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {TIERS.map((tier) => (
              <div key={tier.nameKey}
                className={`rounded-2xl p-6 border ${tier.featured
                  ? 'bg-white text-slate-900 border-emerald-400 shadow-xl shadow-emerald-500/10'
                  : 'bg-white/5 text-white border-white/10'
                }`}>
                {tier.featured && (
                  <div className="text-[10px] font-black bg-emerald-400 text-slate-900 px-3 py-1 rounded-full inline-block mb-3 uppercase tracking-wider">
                    ★ Most Popular · الأكثر شعبية
                  </div>
                )}
                <h3 className={`font-black text-xl mb-0.5 ${tier.featured ? 'text-slate-900' : 'text-white'}`}>
                  {tier.nameKey}
                </h3>
                <p className={`text-sm mb-1 ${tier.featured ? 'text-slate-600' : 'text-slate-400'}`}>{tier.nameAr}</p>
                <p className={`text-xs mb-5 ${tier.featured ? 'text-slate-500' : 'text-slate-400'}`}>{tier.desc}</p>
                <div className={`space-y-3 text-sm mb-6 pt-4 border-t ${tier.featured ? 'border-slate-200' : 'border-white/10'}`}>
                  <div className="flex justify-between items-center">
                    <span className={tier.featured ? 'text-slate-500' : 'text-slate-400'}>Deposit Required</span>
                    <span className={`font-black text-base ${tier.featured ? 'text-slate-900' : 'text-white'}`}>
                      {tier.deposit.toLocaleString()} EGP
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={tier.featured ? 'text-slate-500' : 'text-slate-400'}>Max Bid</span>
                    <span className={`font-bold ${tier.featured ? 'text-emerald-600' : 'text-emerald-400'}`}>
                      {tier.maxBid ? `${tier.maxBid.toLocaleString()} EGP` : '∞ Unlimited'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={tier.featured ? 'text-slate-500' : 'text-slate-400'}>Refundable</span>
                    <span className="text-emerald-500 font-semibold">✓ Yes</span>
                  </div>
                </div>
                <Link href="/auth/register"
                  className={`block w-full text-center font-bold py-3 rounded-xl text-sm transition-colors ${tier.featured
                    ? 'bg-[#1E3A5F] hover:bg-[#162d4a] text-white'
                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                  }`}>
                  Get Started →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-black mb-3">
            Ready to Start Bidding? · مستعد للبدء؟
          </h2>
          <p className="text-emerald-100 mb-6 max-w-lg mx-auto">
            Join thousands of buyers finding their next vehicle on Egypt's most trusted auction platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/register"
              className="bg-white text-emerald-600 hover:bg-emerald-50 font-black px-8 py-3.5 rounded-xl text-sm transition-colors shadow-lg">
              إنشاء حساب مجاني · Register Free
            </Link>
            <Link href="/auctions"
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-8 py-3.5 rounded-xl text-sm transition-colors border border-emerald-400">
              Browse All Auctions
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-slate-800">

            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center">
                  <Gavel className="w-4 h-4 text-slate-300" />
                </div>
                <div>
                  <div className="font-black text-slate-200">مزايد · Muzayid</div>
                  <div className="text-xs">Egyptian Auto Auctions</div>
                </div>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed mb-4">
                Egypt's transparent auto auction platform. منصة مزادات السيارات الشفافة في مصر.
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Cairo, Egypt · القاهرة، مصر</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5" />
                  <span>+20 100 000 0000</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5" />
                  <span>support@muzayid.com</span>
                </div>
              </div>
            </div>

            {/* Quick links */}
            <div>
              <h4 className="font-bold text-slate-300 text-sm mb-4">Quick Links · روابط</h4>
              <div className="space-y-2 text-sm">
                {[
                  { en: 'Home', ar: 'الرئيسية', href: '/' },
                  { en: 'Live Auctions', ar: 'المزادات الحية', href: '/auctions' },
                  { en: 'How It Works', ar: 'كيف يعمل', href: '/how-it-works' },
                  { en: 'Register', ar: 'التسجيل', href: '/auth/register' },
                  { en: 'Dashboard', ar: 'لوحة التحكم', href: '/dashboard' },
                ].map(link => (
                  <Link key={link.href} href={link.href} className="flex items-center gap-1 hover:text-slate-200 transition-colors">
                    {link.en} · {link.ar}
                  </Link>
                ))}
              </div>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-bold text-slate-300 text-sm mb-4">Legal · قانوني</h4>
              <div className="space-y-2 text-sm">
                {[
                  { en: 'Privacy Policy', ar: 'سياسة الخصوصية', href: '/privacy' },
                  { en: 'Terms of Service', ar: 'شروط الخدمة', href: '/terms' },
                  { en: 'Bidding Rules', ar: 'قواعد المزايدة', href: '/rules' },
                  { en: 'Refund Policy', ar: 'سياسة الاسترداد', href: '/refunds' },
                ].map(link => (
                  <Link key={link.href} href={link.href} className="flex items-center gap-1 hover:text-slate-200 transition-colors">
                    {link.en} · {link.ar}
                  </Link>
                ))}
              </div>
            </div>

            {/* WhatsApp alerts */}
            <div>
              <h4 className="font-bold text-slate-300 text-sm mb-4">Get Alerts · احصل على تنبيهات</h4>
              <div className="bg-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-slate-200 font-semibold text-sm">WhatsApp Alerts</p>
                    <p className="text-slate-500 text-xs">تنبيهات واتساب</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                  Get instant alerts when new cars are listed or auctions are starting.
                  احصل على تنبيهات فورية عند إدراج سيارات جديدة أو بدء مزادات.
                </p>
                <Link href="/auth/register"
                  className="block w-full bg-green-600 hover:bg-green-500 text-white font-bold text-sm py-2.5 rounded-lg text-center transition-colors">
                  Enable Alerts · فعّل التنبيهات
                </Link>
              </div>
            </div>
          </div>

          {/* Footer bottom */}
          <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
            <p>© {new Date().getFullYear()} Muzayid · مزايد. All rights reserved · جميع الحقوق محفوظة.</p>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 text-emerald-500 font-semibold">
                <ShieldCheck className="w-4 h-4" />
                Secure Platform
              </span>
              <span className="text-slate-600">·</span>
              <span>Cairo, Egypt</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
