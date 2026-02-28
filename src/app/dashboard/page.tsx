import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import { Gavel, ShieldCheck, AlertCircle, DollarSign, TrendingUp, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-EG', { minimumFractionDigits: 0 }).format(n) + ' EGP'
}

export default async function DashboardPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?redirect=/dashboard')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login?redirect=/dashboard')

  const { data: bids } = await supabase
    .from('bids')
    .select('*, auction:auctions(id, status, current_highest_bid, vehicle:vehicles(make, model, year, images))')
    .eq('bidder_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const tierNames: Record<number, string> = { 0: 'No tier', 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3' }
  const tierColors: Record<number, string> = {
    0: 'bg-slate-100 text-slate-500',
    1: 'bg-amber-100 text-amber-700',
    2: 'bg-blue-100 text-blue-700',
    3: 'bg-purple-100 text-purple-700',
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Navbar initialUser={{ id: profile.id, full_name: profile.full_name, bidding_tier: profile.bidding_tier, is_admin: profile.is_admin }} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-slate-900">Welcome back, {profile.full_name?.split(' ')[0]} 👋</h1>
          <p className="text-slate-500 text-sm mt-1">Here&apos;s your bidding overview</p>
        </div>

        {!profile.is_verified && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-5 flex items-center gap-4">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-amber-800 font-semibold text-sm">Identity verification pending</p>
              <p className="text-amber-700 text-xs mt-0.5">Our team will verify your ID within 24 hours.</p>
            </div>
            {!profile.national_id_url && (
              <Link href="/onboarding/kyc" className="text-xs font-semibold bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors">Upload ID</Link>
            )}
          </div>
        )}

        {profile.bidding_tier === 0 && (
          <div className="bg-[#1E3A5F] text-white rounded-xl px-5 py-4 mb-5 flex items-center gap-4">
            <DollarSign className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-sm">No deposit yet — you can&apos;t bid</p>
              <p className="text-slate-300 text-xs mt-0.5">Make a refundable deposit to unlock bidding access.</p>
            </div>
            <Link href="/onboarding/deposit" className="text-xs font-semibold bg-emerald-500 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-400 transition-colors">Make Deposit</Link>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">Deposit Balance</p>
            <p className="text-xl font-black text-slate-900">{formatCurrency(profile.deposit_balance || 0)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">Bidding Tier</p>
            <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${tierColors[profile.bidding_tier || 0]}`}>
              {tierNames[profile.bidding_tier || 0]}
            </span>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">KYC Status</p>
            <div className={`flex items-center gap-1.5 text-sm font-bold ${profile.is_verified ? 'text-emerald-600' : 'text-amber-500'}`}>
              <ShieldCheck className="w-4 h-4" />
              {profile.is_verified ? 'Verified' : 'Pending'}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">Total Bids</p>
            <p className="text-xl font-black text-slate-900">{bids?.length || 0}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Your Recent Bids</h2>
              <Link href="/auctions" className="text-xs text-[#1E3A5F] font-semibold hover:underline">Browse more</Link>
            </div>
            {!bids || bids.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <Gavel className="w-8 h-8 text-slate-200 mb-3" />
                <p className="text-slate-500 text-sm font-medium">No bids yet</p>
                <Link href="/auctions" className="mt-3 text-xs font-semibold text-[#1E3A5F] hover:underline">Browse live auctions →</Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {bids.slice(0, 5).map((bid: { id: string; amount: number; auction?: { id: string; status: string; current_highest_bid: number; vehicle?: { make: string; model: string; year: number; images?: string[] } | null } | null }) => {
                  const auction = bid.auction
                  const vehicle = auction?.vehicle
                  const isWinning = auction?.current_highest_bid === bid.amount
                  return (
                    <div key={bid.id} className="flex items-center gap-3 px-6 py-3.5">
                      <div className="w-10 h-8 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                        {vehicle?.images?.[0] ? <img src={vehicle.images[0]} alt="" className="w-full h-full object-cover" /> : <Gavel className="w-3 h-3 text-slate-300 m-auto" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-800 text-sm font-semibold truncate">{vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'Unknown vehicle'}</p>
                        <p className="text-slate-400 text-xs">{formatCurrency(bid.amount)}</p>
                      </div>
                      {auction?.status === 'active' && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isWinning ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                          {isWinning ? 'Winning' : 'Outbid'}
                        </span>
                      )}
                      {auction?.status === 'ended' && isWinning && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Won!</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">Recent Transactions</h2>
            </div>
            {!transactions || transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <TrendingUp className="w-8 h-8 text-slate-200 mb-3" />
                <p className="text-slate-500 text-sm">No transactions yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {transactions.map((tx: { id: string; type: string; amount: number; status: string; created_at: string }) => (
                  <div key={tx.id} className="flex items-center gap-3 px-6 py-3.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${tx.type === 'deposit' ? 'bg-emerald-100' : tx.type === 'entry_fee' ? 'bg-blue-100' : 'bg-slate-100'}`}>
                      {tx.type === 'deposit' ? <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> :
                       tx.type === 'entry_fee' ? <Gavel className="w-3.5 h-3.5 text-blue-600" /> :
                       <Clock className="w-3.5 h-3.5 text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-800 text-sm font-semibold capitalize">{tx.type.replace('_', ' ')}</p>
                      <p className="text-slate-400 text-xs">{new Date(tx.created_at).toLocaleDateString('en-EG', { day: 'numeric', month: 'short' })}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-900 text-sm font-bold">{formatCurrency(tx.amount)}</p>
                      <span className={`text-xs font-medium ${tx.status === 'completed' ? 'text-emerald-600' : tx.status === 'pending' ? 'text-amber-500' : 'text-red-500'}`}>{tx.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
