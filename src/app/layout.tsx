import type { Metadata } from 'next'
import { Cairo, Outfit } from 'next/font/google'
import { LangProvider } from '@/i18n/LangContext'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
})

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
})

export const metadata: Metadata = {
  title: "مزايد · Muzayid — Egypt's Auto Auction Platform",
  description: 'Real-time bidding on salvage, crash-damaged, and corporate fleet vehicles in Egypt.',
  keywords: ['car auction', 'Egypt', 'salvage cars', 'مزاد سيارات', 'مصر'],
  openGraph: {
    title: "Muzayid · مزايد — Egypt's Auto Auction Platform",
    description: 'Real-time car auctions in Egypt. 100% transparent.',
    type: 'website',
    locale: 'ar_EG',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={`${outfit.variable} ${cairo.variable}`}>
      <body className="font-outfit antialiased bg-[#F8FAFC] text-slate-900">
        <LangProvider>
          {children}
        </LangProvider>
      </body>
    </html>
  )
}
