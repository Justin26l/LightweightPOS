import { createI18n } from 'vue-i18n'
import zhCN from './zh-CN'
import en from './en'

function detectLocale(): string {
  const stored = localStorage.getItem('locale')
  if (stored) return stored
  return navigator.language.startsWith('zh') ? 'zh-CN' : 'en'
}

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages: { 'zh-CN': zhCN, en },
})

export function setLocale(locale: string) {
  i18n.global.locale.value = locale
  localStorage.setItem('locale', locale)
}
