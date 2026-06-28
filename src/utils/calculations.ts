import type { RawMaterial, ItemMaterial, ItemWithDetails, ComboWithDetails } from '../types'

export function computeItemCost(
  materials: RawMaterial[],
  itemMaterials: ItemMaterial[],
  minQty: number
): number {
  const perUnit = itemMaterials.reduce((sum, im) => {
    const mat = materials.find(m => m.id === im.materialId)
    return sum + (mat?.unitCost ?? 0) * im.amount
  }, 0)
  return perUnit * minQty
}

export function computeItemStock(
  materials: RawMaterial[],
  itemMaterials: ItemMaterial[],
  minQty: number
): number {
  let minRatio = Infinity
  for (const im of itemMaterials) {
    const mat = materials.find(m => m.id === im.materialId)
    if (!mat) return 0
    const ratio = mat.currentStock / im.amount
    if (ratio < minRatio) minRatio = ratio
  }
  if (minRatio === Infinity) return Infinity
  return Math.floor(minRatio / minQty)
}

export function computeComboCost(
  items: ItemWithDetails[],
  comboItemQtys: { itemId: number; qty: number }[]
): number {
  return comboItemQtys.reduce((sum, ci) => {
    const item = items.find(i => i.id === ci.itemId)
    return sum + (item?.unitCost ?? 0) * ci.qty
  }, 0)
}

export function computeComboStock(
  items: ItemWithDetails[],
  comboItemQtys: { itemId: number; qty: number }[]
): number {
  let min = Infinity
  for (const ci of comboItemQtys) {
    const item = items.find(i => i.id === ci.itemId)
    if (!item) return 0
    const ratio = item.stock / ci.qty
    if (ratio < min) min = Math.floor(ratio)
  }
  return min === Infinity ? 0 : min
}
