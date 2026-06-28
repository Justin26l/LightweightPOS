export interface Item {
  id?: number
  name: string
  price: number
  minQty: number       // 起售量, default 1
  groupName: string     // 自由标签分组
  createdAt: Date
  updatedAt: Date
}

export interface Combo {
  id?: number
  name: string
  price: number
  createdAt: Date
  updatedAt: Date
}

export interface ComboItem {
  id?: number
  comboId: number
  itemId: number
  qty: number
}

export interface RawMaterial {
  id?: number
  name: string
  unit: string          // 个/g/ml/包
  unitCost: number
  currentStock: number
  alertThreshold: number
  createdAt: Date
  updatedAt: Date
}

export interface ItemMaterial {
  id?: number
  itemId: number
  materialId: number
  amount: number        // 用量(按原材料的unit)
}

export interface Order {
  id?: number
  createdAt: Date
  totalAmount: number
  totalCost: number
  itemCount: number
}

export interface OrderItem {
  id?: number
  orderId: number
  type: 'item' | 'combo'
  refId: number
  name: string
  qty: number
  unitPrice: number
  unitCost: number
}

export interface Setting {
  key: string
  value: any
}

// View models (computed at runtime, not stored in DB)
export interface ItemWithDetails extends Item {
  unitCost: number
  stock: number
}

export interface ComboWithDetails extends Combo {
  cost: number
  stock: number
  items: ComboItem[]
}

export interface CartEntry {
  type: 'item' | 'combo'
  refId: number
  name: string
  price: number
  cost: number
  qty: number
}
