import { ref } from 'vue'
import { db } from '../db'
import type { Combo, ComboItem, ComboWithDetails, ItemWithDetails, RawMaterial, ItemMaterial } from '../types'
import { computeItemCost, computeItemStock, computeComboCost, computeComboStock } from '../utils/calculations'

export function useCombos() {
  const combos = ref<ComboWithDetails[]>([])

  async function loadCombos() {
    const rawCombos = await db.combos.toArray()
    const comboItems = await db.comboItems.toArray()
    const rawItems = await db.items.toArray()
    const allMaterials = await db.rawMaterials.toArray()
    const allItemMats = await db.itemMaterials.toArray()

    const computedItems = rawItems.map(item => {
      const mats = allItemMats.filter(im => im.itemId === item.id)
      return {
        ...item,
        unitCost: computeItemCost(allMaterials, mats, item.minQty),
        stock: computeItemStock(allMaterials, mats, item.minQty),
      }
    })

    combos.value = rawCombos.map(c => {
      const cis = comboItems.filter(ci => ci.comboId === c.id)
      return {
        ...c,
        cost: computeComboCost(computedItems, cis.map(ci => ({ itemId: ci.itemId, qty: ci.qty }))),
        stock: computeComboStock(computedItems, cis.map(ci => ({ itemId: ci.itemId, qty: ci.qty }))),
        items: cis,
      }
    })
  }

  async function addCombo(data: { name: string; price: number; items: { itemId: number; qty: number }[] }): Promise<number> {
    const id = await db.combos.add({
      name: data.name,
      price: data.price,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    for (const ci of data.items) {
      await db.comboItems.add({ comboId: id, itemId: ci.itemId, qty: ci.qty })
    }
    await loadCombos()
    return id
  }

  async function updateCombo(id: number, data: { name?: string; price?: number; items?: { itemId: number; qty: number }[] }) {
    await db.combos.update(id, { ...data, updatedAt: new Date() })
    if (data.items) {
      await db.comboItems.where('comboId').equals(id).delete()
      for (const ci of data.items) {
        await db.comboItems.add({ comboId: id, itemId: ci.itemId, qty: ci.qty })
      }
    }
    await loadCombos()
  }

  async function deleteCombo(id: number) {
    await db.combos.delete(id)
    await db.comboItems.where('comboId').equals(id).delete()
    await loadCombos()
  }

  return { combos, loadCombos, addCombo, updateCombo, deleteCombo }
}
