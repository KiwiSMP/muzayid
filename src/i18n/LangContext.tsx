'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { t, Lang, TranslationKey } from './translations'

interface LangContextType {
  lang: Lang
  setLang: (l: Lang) => void
  tr: (key: TranslationKey) => string
  isRTL: boolean
}

const LangContext = createContext<LangContextType>({
  lang: 'en',
  setLang: () => {},
  tr: (key) => key,
  isRTL: false,
})

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    const saved = localStorage.getItem('muzayid-lang') as Lang | null
    if (saved === 'ar' || saved === 'en') {
      setLangState(saved)
    }
  }, [])

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem('muzayid-lang', l)
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = l
  }

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
  }, [lang])

  const tr = (key: TranslationKey): string => t[lang][key] as string

  return (
    <LangContext.Provider value={{ lang, setLang, tr, isRTL: lang === 'ar' }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
