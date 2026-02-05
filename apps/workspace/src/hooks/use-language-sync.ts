/**
 * Hook to sync language preference between i18n, localStorage, and database.
 * On mount: reads DB language and syncs to i18n if different from localStorage.
 * On change: updates localStorage + i18n immediately, persists to DB in background.
 */
import { useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api-client'
import type { Language } from '../lib/api-client'

const STORAGE_KEY = 'ella-language'

function toI18nLang(dbLang: Language): string {
  return dbLang === 'VI' ? 'vi' : 'en'
}

function toDbLang(i18nLang: string): Language {
  return i18nLang === 'en' ? 'EN' : 'VI'
}

export function useLanguageSync() {
  const { i18n } = useTranslation()

  // Sync from DB on mount (background, non-blocking)
  useEffect(() => {
    api.staff.me()
      .then((staff) => {
        const dbLang = toI18nLang(staff.language)
        const currentLang = localStorage.getItem(STORAGE_KEY) || i18n.language
        if (dbLang !== currentLang) {
          i18n.changeLanguage(dbLang)
        }
      })
      .catch(() => {
        // Silently fail — localStorage/default language is fine as fallback
      })
  }, [i18n])

  // Change language: update localStorage + i18n immediately, persist to DB
  const changeLanguage = useCallback(
    (lang: Language) => {
      const i18nLang = toI18nLang(lang)
      i18n.changeLanguage(i18nLang)
      // Persist to DB in background
      api.staff.updateLanguage(lang).catch(() => {
        // Silently fail — localStorage already saved by i18next-browser-languagedetector
      })
    },
    [i18n]
  )

  return {
    currentLanguage: toDbLang(i18n.language) as Language,
    changeLanguage,
  }
}
