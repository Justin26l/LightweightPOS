import Dexie, { type Table } from 'dexie'
import type { Item, Combo, ComboItem, RawMaterial, ItemMaterial, Order, OrderItem, Setting } from '../types'

export class AppDatabase extends Dexie {
  items!: Table<Item, number>
  combos!: Table<Combo, number>
  comboItems!: Table<ComboItem, number>
  rawMaterials!: Table<RawMaterial, number>
  itemMaterials!: Table<ItemMaterial, number>
  orders!: Table<Order, number>
  orderItems!: Table<OrderItem, number>
  settings!: Table<Setting, string>

  constructor() {
    super('LightweightPosDB')
    this.version(1).stores({
      items: '++id, groupName',
      combos: '++id',
      comboItems: '++id, comboId, itemId',
      rawMaterials: '++id',
      itemMaterials: '++id, itemId, materialId',
      orders: '++id, createdAt',
      orderItems: '++id, orderId',
      settings: 'key',
    })
  }
}

export const db = new AppDatabase()
