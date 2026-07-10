import { reactive } from 'vue'
import { db } from '../db'
import type { ExportData } from '../types'

interface SettingsState {
  storeName: string
  currencySymbol: string
  locale: string
}

const DEFAULT_PAYMENT_METHODS = ['CASH', 'Online Payment'];

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

  async function getPaymentMethods(): Promise<string[]> {
    const val = await db.settings.get('paymentMethods')
    return val?.value ?? DEFAULT_PAYMENT_METHODS
  }

  async function addPaymentMethod(name: string) {
    const methods = await getPaymentMethods()
    if (!methods.includes(name)) {
      methods.push(name)
      await db.settings.put({ key: 'paymentMethods', value: methods })
    }
  }

  async function deletePaymentMethod(name: string) {
    const methods = await getPaymentMethods()
    const idx = methods.indexOf(name)
    if (idx !== -1) {
      methods.splice(idx, 1)
      await db.settings.put({ key: 'paymentMethods', value: methods })
    }
  }

  async function clearAllData() {
    await db.delete()
    await db.open()
    // reload defaults
    Object.assign(state, defaults)
  }

  async function exportData(): Promise<string> {
    const [rawMaterials, items, itemMaterials, combos, comboItems, settings] = await Promise.all([
      db.rawMaterials.toArray(),
      db.items.toArray(),
      db.itemMaterials.toArray(),
      db.combos.toArray(),
      db.comboItems.toArray(),
      db.settings.toArray(),
    ])
    const data: ExportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      rawMaterials,
      items,
      itemMaterials,
      combos,
      comboItems,
      settings,
    }
    return JSON.stringify(data, null, 2)
  }

  function reviveDates<T extends Record<string, any>>(obj: T, dateFields: (keyof T)[]): T {
    for (const field of dateFields) {
      if (obj[field] && typeof obj[field] === 'string') {
        obj[field] = new Date(obj[field]) as any
      }
    }
    return obj
  }

  async function importData(data: ExportData): Promise<void> {
    // Validate basic structure
    if (data.version !== 1 || !Array.isArray(data.rawMaterials) || !Array.isArray(data.items) ||
        !Array.isArray(data.itemMaterials) || !Array.isArray(data.combos) ||
        !Array.isArray(data.comboItems) || !Array.isArray(data.settings)) {
      throw new Error('Invalid data format')
    }

    // Revive Date fields from strings
    const materials = data.rawMaterials.map(m => reviveDates(m, ['createdAt', 'updatedAt']))
    const items = data.items.map(i => reviveDates(i, ['createdAt', 'updatedAt']))
    const combos = data.combos.map(c => reviveDates(c, ['createdAt', 'updatedAt']))

    // Validate required fields on individual records
    for (const m of materials) {
      if (!m.name || !m.unit) throw new Error('Invalid material data: missing name or unit')
    }
    for (const i of items) {
      if (!i.name) throw new Error('Invalid item data: missing name')
    }
    for (const c of combos) {
      if (!c.name) throw new Error('Invalid combo data: missing name')
    }

    // Use transaction for atomic clear + write
    await db.transaction('rw', [db.comboItems, db.combos, db.itemMaterials, db.items, db.rawMaterials, db.settings], async () => {
      await db.comboItems.clear()
      await db.combos.clear()
      await db.itemMaterials.clear()
      await db.items.clear()
      await db.rawMaterials.clear()
      await db.settings.clear()

      await db.rawMaterials.bulkAdd(materials)
      await db.items.bulkAdd(items)
      await db.itemMaterials.bulkAdd(data.itemMaterials)
      await db.combos.bulkAdd(combos)
      await db.comboItems.bulkAdd(data.comboItems)
      await db.settings.bulkAdd(data.settings)
    })
  }

  return {
    settings: state,
    loadSettings,
    saveSetting,
    getAllGroups,
    deleteGroup,
    clearAllData,
    getPaymentMethods,
    addPaymentMethod,
    deletePaymentMethod,
    exportData,
    importData,
  }
}
