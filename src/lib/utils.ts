import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-EG', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' EGP'
}

export function formatCurrencyAr(amount: number): string {
  return new Intl.NumberFormat('ar-EG', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' ج.م'
}

export function getTimeRemaining(endTime: string) {
  const now = new Date()
  const end = new Date(endTime)
  const diff = end.getTime() - now.getTime()

  if (diff <= 0) return { isExpired: true, days: 0, hours: 0, minutes: 0, seconds: 0 }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)
  const isUrgent = diff < 60 * 60 * 1000 // < 1 hour

  return { isExpired: false, days, hours, minutes, seconds, isUrgent }
}

export function getTimeUntil(startTime: string) {
  const now = new Date()
  const start = new Date(startTime)
  const diff = start.getTime() - now.getTime()
  if (diff <= 0) return null
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  return { days, hours, minutes }
}

export function damageTypeColor(type: string): string {
  const map: Record<string, string> = {
    front: 'bg-orange-100 text-orange-700 border-orange-200',
    rear: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    side: 'bg-blue-100 text-blue-700 border-blue-200',
    rollover: 'bg-red-100 text-red-700 border-red-200',
    flood: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    fire: 'bg-red-100 text-red-700 border-red-200',
    hail: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    mechanical: 'bg-slate-100 text-slate-600 border-slate-200',
    vandalism: 'bg-purple-100 text-purple-700 border-purple-200',
    theft: 'bg-rose-100 text-rose-700 border-rose-200',
  }
  return map[type?.toLowerCase()] || 'bg-slate-100 text-slate-600 border-slate-200'
}
