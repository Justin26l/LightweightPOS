import { db } from '../db'
import type { CartEntry, Order, OrderItem } from '../types'

export function useOrders() {
  async function getNextOrderNumber(): Promise<number> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayOrders = await db.orders
      .where('createdAt')
      .between(today, tomorrow)
      .toArray()
    const maxOrderNumber = todayOrders.reduce(
      (max, o) => Math.max(max, o.orderNumber ?? 0), -1
    )
    return maxOrderNumber + 1
  }

  async function checkout(cartItems: CartEntry[], currencySymbol: string, paymentMethod: string, paid: boolean) {
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

    const orderNumber = await getNextOrderNumber()

    // Create order
    const orderId = await db.orders.add({
      createdAt: new Date(),
      totalAmount,
      totalCost,
      itemCount,
      orderNumber,
      paymentMethod,
      paid,
      paidAt: paid ? new Date() : null,
      delivered: false,
      deliveredAt: null,
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

  async function getOrders(): Promise<Order[]> {
    return db.orders.orderBy('createdAt').reverse().toArray()
  }

  async function getOrderItems(orderId: number): Promise<OrderItem[]> {
    return db.orderItems.where('orderId').equals(orderId).toArray()
  }

  async function markOrderPaid(orderId: number) {
    await db.orders.update(orderId, { paid: true, paidAt: new Date() })
  }

  async function markOrderDelivered(orderId: number) {
    await db.orders.update(orderId, { delivered: true, deliveredAt: new Date() })
  }

  async function updateOrderItems(orderId: number, items: { type: 'item' | 'combo'; refId: number; name: string; qty: number; unitPrice: number; unitCost: number }[]) {
    await db.transaction('rw', db.orderItems, db.orders, async () => {
      // 全删重建 order items
      await db.orderItems.where('orderId').equals(orderId).delete()
      for (const item of items) {
        await db.orderItems.add({ orderId, ...item })
      }
      // 重新计算 totals
      let totalAmount = 0
      let totalCost = 0
      let itemCount = 0
      for (const item of items) {
        totalAmount += item.unitPrice * item.qty
        totalCost += item.unitCost * item.qty
        itemCount += item.qty
      }
      await db.orders.update(orderId, { totalAmount, totalCost, itemCount })
    })
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

  return { getNextOrderNumber, checkout, getOrders, getOrderItems, markOrderPaid, markOrderDelivered, updateOrderItems, getTodaySales, getSalesByDateRange }
}
