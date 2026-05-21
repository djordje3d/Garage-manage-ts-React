import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { setStoredLocale, type SupportedLocale } from '@/i18n'
import { StandardDropdown } from './StandardDropdown'

const localeOptions = [
  { id: 'en' as const, label: 'EN' },
  { id: 'sr' as const, label: 'SR' },
]

export function LanguageSwitcher() {
  const { i18n } = useTranslation()

  const current = useMemo((): SupportedLocale => {
    const v = String(i18n.language ?? '').toLowerCase()
    return v.startsWith('sr') ? 'sr' : 'en'
  }, [i18n.language])

  function changeLocale(next: number | string | null) {
    const locale = next as SupportedLocale | null
    if (locale == null || current === locale) return
    void i18n.changeLanguage(locale)
    setStoredLocale(locale)
  }

  return (
    <div className="flex items-center gap-1 text-sm">
      <StandardDropdown
        options={localeOptions}
        modelValue={current}
        nullable={false}
        onModelValueChange={changeLocale}
      />
    </div>
  )
}
