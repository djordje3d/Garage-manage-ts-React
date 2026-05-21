import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import sr from './locales/sr.json'

export type SupportedLocale = 'en' | 'sr'

const STORAGE_KEY = 'parking-dashboard-locale'

function getStoredLocale(): SupportedLocale | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'sr') return stored
  } catch {
    // ignore
  }
  return null
}

export function setStoredLocale(locale: SupportedLocale) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, locale)
    void i18n.changeLanguage(locale)
  } catch {
    // ignore
  }
}

export const LOCALE_STORAGE_KEY = STORAGE_KEY

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    sr: { translation: sr },
  },
  lng: getStoredLocale() ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
