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
  unit: string          // Pcs/g/ml/Pack
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
  orderNumber: number       // 当日序号（每天从0开始递增）
  paymentMethod: string     // 支付方式（从settings列表选取的快照）
  paid: boolean             // 是否已付款
  paidAt: Date | null       // 付款时间
  delivered: boolean        // 是否已取餐/送达
  deliveredAt: Date | null  // 送达时间
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

export interface ExportData {
  version: number
  exportedAt: string
  rawMaterials: RawMaterial[]
  items: Item[]
  itemMaterials: ItemMaterial[]
  combos: Combo[]
  comboItems: ComboItem[]
  settings: Setting[]
}
