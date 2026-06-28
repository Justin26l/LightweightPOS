import { db } from '../db'
import type { CartEntry } from '../types'

export function useOrders() {
  async function checkout(cartItems: CartEntry[], currencySymbol: string) {
    // Validate stock first
    const materials = await db.rawMaterials.toArray()
    const itemMats = await db.itemMaterials.toArray()
    const comboItems = await db.comboItems.toArray()

    // Calculate totals
    let totalAmount = 0
    let totalCost = 0
    let itemCount = 0

    // Build stock deduction map
    const deductionMap = new Map<number, number>() // materialId -> amount to deduct

    for (const entry of cartItems) {
      totalAmount += entry.price * entry.qty
      totalCost += entry.cost * entry.qty
      itemCount += entry.qty

      if (entry.type === 'item') {
        const mats = itemMats.filter(im => im.itemId === entry.refId)
        const item = await db.items.get(entry.refId)
        const minQty = item?.minQty ?? 1
        for (const m of mats) {
          deductionMap.set(m.materialId, (deductionMap.get(m.materialId) ?? 0) + m.amount * minQty * entry.qty)
        }
      } else if (entry.type === 'combo') {
        const cis = comboItems.filter(ci => ci.comboId === entry.refId)
        for (const ci of cis) {
          const mats = itemMats.filter(im => im.itemId === ci.itemId)
          const item = await db.items.get(ci.itemId)
          const minQty = item?.minQty ?? 1
          for (const m of mats) {
            deductionMap.set(m.materialId, (deductionMap.get(m.materialId) ?? 0) + m.amount * minQty * ci.qty * entry.qty)
          }
        }
      }
    }

    // Check stock sufficiency
    for (const [matId, needed] of deductionMap) {
      const mat = materials.find(m => m.id === matId)
      if (!mat || mat.currentStock < needed) {
        throw new Error(`Insufficient stock: ${mat?.name ?? 'unknown'} (need ${needed}, have ${mat?.currentStock ?? 0})`)
      }
    }

    // Create order
    const orderId = await db.orders.add({
      createdAt: new Date(),
      totalAmount,
      totalCost,
      itemCount,
    })

    // Create order items
    for (const entry of cartItems) {
      await db.orderItems.add({
        orderId,
        type: entry.type,
        refId: entry.refId,
        name: entry.name,
        qty: entry.qty,
        unitPrice: entry.price,
        unitCost: entry.cost,
      })
    }

    // Deduct stock
    for (const [matId, amount] of deductionMap) {
      const mat = materials.find(m => m.id === matId)!
      await db.rawMaterials.update(matId, {
        currentStock: Math.max(0, mat.currentStock - amount),
        updatedAt: new Date(),
      })
    }

    return orderId
  }

  async function getTodaySales() {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)

    const orders = await db.orders
      .where('createdAt')
      .between(start, end)
      .toArray()

    const orderIds = orders.map(o => o.id!)
    const orderItems = await db.orderItems
      .where('orderId')
      .anyOf(orderIds)
      .toArray()

    return { orders, orderItems }
  }

  async function getSalesByDateRange(start: Date, end: Date) {
    const orders = await db.orders
      .where('createdAt')
      .between(start, end)
      .toArray()

    const orderIds = orders.map(o => o.id!)
    const orderItems = await db.orderItems
      .where('orderId')
      .anyOf(orderIds)
      .toArray()

    return { orders, orderItems }
  }

  return { checkout, getTodaySales, getSalesByDateRange }
}
