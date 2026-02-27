'use client'

import { useState, useEffect, useCallback } from 'react'
import { getTimeRemaining } from '@/lib/utils'

export function useCountdown(endTime: string | null) {
  const compute = useCallback(() => {
    if (!endTime) return null
    return getTimeRemaining(endTime)
  }, [endTime])

  const [remaining, setRemaining] = useState(compute)

  useEffect(() => {
    if (!endTime) return

    const interval = setInterval(() => {
      const result = compute()
      setRemaining(result)
      if (result?.isExpired) clearInterval(interval)
    }, 1000)

    return () => clearInterval(interval)
  }, [endTime, compute])

  return remaining
}
