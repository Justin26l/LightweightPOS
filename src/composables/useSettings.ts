import { reactive } from 'vue'
import { db } from '../db'

interface SettingsState {
  storeName: string
  currencySymbol: string
  locale: string
}

const defaults: SettingsState = {
  storeName: '',
  currencySymbol: '¥',
  locale: navigator.language.startsWith('zh') ? 'zh-CN' : 'en',
}

const state = reactive<SettingsState>({ ...defaults })

export function useSettings() {
  async function loadSettings() {
    const keys = ['storeName', 'currencySymbol', 'locale'] as const
    for (const key of keys) {
      const val = await db.settings.get(key)
      if (val !== undefined) (state as any)[key] = val.value
    }
  }

  async function saveSetting(key: string, value: any) {
    await db.settings.put({ key, value })
    ;(state as any)[key] = value
    if (key === 'locale') {
      const { setLocale } = await import('../locales')
      setLocale(value)
    }
  }

  async function getAllGroups(): Promise<string[]> {
    const items = await db.items.toArray()
    const groups = [...new Set(items.map(i => i.groupName).filter(Boolean))]
    return groups.sort()
  }

  async function deleteGroup(groupName: string) {
    await db.items.where('groupName').equals(groupName).modify({ groupName: '' })
  }

  async function clearAllData() {
    await db.delete()
    await db.open()
    // reload defaults
    Object.assign(state, defaults)
  }

  return {
    settings: state,
    loadSettings,
    saveSetting,
    getAllGroups,
    deleteGroup,
    clearAllData,
  }
}
