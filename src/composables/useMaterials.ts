import { ref } from 'vue'
import { db } from '../db'
import type { RawMaterial } from '../types'

export function useMaterials() {
  const materials = ref<RawMaterial[]>([])

  async function loadMaterials() {
    materials.value = await db.rawMaterials.toArray()
  }

  async function addMaterial(data: Omit<RawMaterial, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const id = await db.rawMaterials.add({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    await loadMaterials()
    return id
  }

  async function updateMaterial(id: number, data: Partial<RawMaterial>) {
    await db.rawMaterials.update(id, { ...data, updatedAt: new Date() })
    await loadMaterials()
  }

  async function deleteMaterial(id: number) {
    // Also remove all item_materials references
    await db.itemMaterials.where('materialId').equals(id).delete()
    await db.rawMaterials.delete(id)
    await loadMaterials()
  }

  async function adjustStock(id: number, delta: number) {
    const mat = await db.rawMaterials.get(id)
    if (!mat) return
    const newStock = Math.max(0, mat.currentStock + delta)
    await db.rawMaterials.update(id, { currentStock: newStock, updatedAt: new Date() })
    await loadMaterials()
  }

  return {
    materials,
    loadMaterials,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    adjustStock,
  }
}
