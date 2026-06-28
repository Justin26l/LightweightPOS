import { ref } from 'vue'
import { db } from '../db'
import type { Item, ItemWithDetails, RawMaterial, ItemMaterial } from '../types'
import { computeItemCost, computeItemStock } from '../utils/calculations'

export function useItems() {
  const items = ref<ItemWithDetails[]>([])

  async function loadItems() {
    const rawItems = await db.items.toArray()
    const materials = await db.rawMaterials.toArray()
    const itemMats = await db.itemMaterials.toArray()

    items.value = rawItems.map(item => {
      const mats = itemMats.filter(im => im.itemId === item.id)
      const unitCost = computeItemCost(materials, mats, item.minQty)
      const stock = computeItemStock(materials, mats, item.minQty)
      return { ...item, unitCost, stock }
    })
  }

  async function addItem(data: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const id = await db.items.add({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    await loadItems()
    return id
  }

  async function updateItem(id: number, data: Partial<Item>) {
    await db.items.update(id, { ...data, updatedAt: new Date() })
    await loadItems()
  }

  async function deleteItem(id: number) {
    await db.items.delete(id)
    await db.itemMaterials.where('itemId').equals(id).delete()
    await loadItems()
  }

  async function getItemMaterials(itemId: number): Promise<ItemMaterial[]> {
    return db.itemMaterials.where('itemId').equals(itemId).toArray()
  }

  return {
    items,
    loadItems,
    addItem,
    updateItem,
    deleteItem,
    getItemMaterials,
  }
}
