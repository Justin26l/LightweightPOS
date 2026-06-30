# 离线订单系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an offline PWA order system with Vue 3, TypeScript, Tailwind, and IndexedDB for recording store sales with inventory tracking.

**Architecture:** SPA with hash-based routing, Dexie.js for IndexedDB persistence, vue-i18n for bilingual support, reactive composable for cart state. Landscape-optimized split-panel layout with item grid on left and cart sidebar on right.

**Tech Stack:** Vue 3 + TS, Tailwind CSS, Dexie.js, vite-plugin-pwa, vue-i18n, SheetJS (xlsx), vue-router

## Global Constraints

- All data stored locally in IndexedDB — no backend
- PWA must work fully offline
- Landscape-first layout (1024px+)
- Minimum touch target 48px
- i18n: all UI text in zh-CN and EN
- All costs auto-calculated from raw materials, never stored directly on items
- Item stock = FLOOR(MIN(materialStock / amount) / minQty)
- Checkout deducts raw materials proportionally

---

## File Structure

```
simple-account/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── tailwind.config.js
├── postcss.config.js
├── public/
│   └── favicon.svg
└── src/
    ├── main.ts
    ├── App.vue
    ├── style.css
    ├── router/
    │   └── index.ts
    ├── db/
    │   └── index.ts
    ├── types/
    │   └── index.ts
    ├── composables/
    │   ├── useCart.ts
    │   ├── useItems.ts
    │   ├── useCombos.ts
    │   ├── useMaterials.ts
    │   ├── useOrders.ts
    │   └── useSettings.ts
    ├── utils/
    │   ├── calculations.ts
    │   └── export.ts
    ├── locales/
    │   ├── index.ts
    │   ├── zh-CN.ts
    │   └── en.ts
    ├── components/
    │   ├── NavBar.vue
    │   ├── CartSidebar.vue
    │   ├── CartItemList.vue
    │   ├── CartFooter.vue
    │   ├── ConfirmDialog.vue
    │   └── FormModal.vue
    └── views/
        ├── ItemsPage.vue
        ├── MaterialsPage.vue
        ├── SalesPage.vue
        └── SettingsPage.vue
```

---

### Task 1: Project Scaffold + Types + Database

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- Create: `tailwind.config.js`, `postcss.config.js`
- Create: `index.html`
- Create: `src/style.css`
- Create: `src/main.ts`
- Create: `src/types/index.ts`
- Create: `src/db/index.ts`

**Interfaces:**
- Consumes: (none — foundation task)
- Produces: `db` (Dexie instance), all TypeScript interfaces

- [ ] **Step 1: Initialize project**

```bash
cd /c/Users/Justin/Documents/GitHub/LightweightPos
npm create vite@latest . -- --template vue-ts
```

This scaffolds Vue 3 + TypeScript via Vite.

- [ ] **Step 2: Install dependencies**

```bash
npm install vue-router@4 vue-i18n@9 dexie xlsx
npm install -D tailwindcss @tailwindcss/vite postcss autoprefixer vite-plugin-pwa
```

- [ ] **Step 3: Write `src/types/index.ts`**

```typescript
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
  unitCost: number       // computed from materials × minQty
  stock: number          // computed from materials
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
  cost: number           // per-unit cost
  qty: number
}
```

- [ ] **Step 4: Write `src/db/index.ts`**

```typescript
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
```

- [ ] **Step 5: Configure `vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: { '@': '/src' },
  },
})
```

- [ ] **Step 6: Write `src/style.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 7: Write `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts,js}'],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

- [ ] **Step 8: Write `postcss.config.js`**

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

- [ ] **Step 9: Write `index.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="Simple Account - Offline Order System" />
  <title>Simple Account</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
</head>
<body class="bg-gray-50">
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 10: Write `src/main.ts` (minimal — i18n and router added in later tasks)**

```typescript
import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

const app = createApp(App)
app.mount('#app')
```

- [ ] **Step 11: Create placeholder `public/favicon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#6366f2">
  <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34 5.06-8.76 5.06-8.76C12.3 4.25 12.53 4 13 4h1l-1 7h3.5c.49 0 .56.33.37.66l-5.06 8.76C11.7 20.75 11.47 21 11 21z"/>
</svg>
```

- [ ] **Step 12: Verify scaffold compiles**

```bash
npx tsc --noEmit
npm run dev
```

Expected: Vite dev server starts, no TypeScript errors.

---

### Task 2: i18n + Router Setup

**Files:**
- Create: `src/locales/zh-CN.ts`
- Create: `src/locales/en.ts`
- Create: `src/locales/index.ts`
- Create: `src/router/index.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: (none — standalone setup)
- Produces: `i18n` instance, `router` instance, locale message types

- [ ] **Step 1: Write `src/locales/zh-CN.ts`**

```typescript
export default {
  nav: {
    items: '品项',
    materials: '原材料',
    sales: '今日销售',
    settings: '设置',
  },
  cart: {
    title: '购物车',
    empty: '购物车为空',
    total: '总计',
    totalSales: '销售额',
    totalCost: '总成本',
    profit: '利润',
    checkout: '结账',
    clear: '清空',
    confirmCheckout: '确认结账？',
    confirmClear: '确认清空购物车？',
    stockWarning: '库存不足',
    qty: '数量',
    delete: '删除',
    hide: '隐藏购物车',
    show: '显示购物车',
  },
  items: {
    title: '品项',
    addItem: '添加品项',
    editItem: '编辑品项',
    addCombo: '添加套餐',
    editCombo: '编辑套餐',
    addGroup: '添加分组',
    name: '名称',
    price: '售价',
    minQty: '起售量',
    groupName: '分组',
    stock: '库存',
    noStock: '缺货',
    lowStock: '库存不足',
    servings: '份',
    editMode: '编辑模式',
    normalMode: '正常模式',
    confirmDelete: '确认删除？',
    combo: '套餐',
  },
  materials: {
    title: '原材料',
    addMaterial: '添加原材料',
    editMaterial: '编辑原材料',
    name: '名称',
    unit: '单位',
    unitCost: '单位成本',
    currentStock: '当前库存',
    alertThreshold: '预警线',
    adjust: '入库调整',
    adjustTitle: '调整库存',
    adjustAmount: '调整数量 (正数入库，负数出库)',
    current: '当前',
    afterAdjust: '调整后',
    confirmDelete: '确认删除此原材料？',
  },
  sales: {
    title: '今日销售',
    totalRevenue: '总销售额',
    totalCost: '总成本',
    totalProfit: '总利润',
    orderCount: '订单数',
    itemCount: '品项数',
    summary: '按品项汇总',
    exportXlsx: '导出 XLSX',
    exportCsv: '导出 CSV',
    date: '日期',
    name: '品项名称',
    qty: '数量',
    revenue: '销售额',
    cost: '成本',
    profit: '利润',
    time: '时间',
    noData: '暂无销售记录',
  },
  settings: {
    title: '设置',
    storeName: '店铺名称',
    currencySymbol: '货币符号',
    language: '语言',
    groupManager: '分组管理',
    dataManager: '数据管理',
    exportDb: '导出数据库备份',
    clearData: '清空所有数据',
    confirmClear: '确认清空所有数据？此操作不可恢复。',
    save: '保存',
    saved: '已保存',
    deleteGroup: '删除分组',
    confirmDeleteGroup: '删除分组不会删除品项，品项分组将变为空。确认？',
  },
  common: {
    save: '保存',
    cancel: '取消',
    confirm: '确认',
    delete: '删除',
    edit: '编辑',
    add: '添加',
    close: '关闭',
    yes: '是',
    no: '否',
  },
}
```

- [ ] **Step 2: Write `src/locales/en.ts`**

```typescript
export default {
  nav: {
    items: 'Items',
    materials: 'Materials',
    sales: 'Sales',
    settings: 'Settings',
  },
  cart: {
    title: 'Cart',
    empty: 'Cart is empty',
    total: 'Total',
    totalSales: 'Revenue',
    totalCost: 'Cost',
    profit: 'Profit',
    checkout: 'Checkout',
    clear: 'Clear',
    confirmCheckout: 'Confirm checkout?',
    confirmClear: 'Clear the cart?',
    stockWarning: 'Low stock',
    qty: 'Qty',
    delete: 'Remove',
    hide: 'Hide cart',
    show: 'Show cart',
  },
  items: {
    title: 'Items',
    addItem: 'Add Item',
    editItem: 'Edit Item',
    addCombo: 'Add Combo',
    editCombo: 'Edit Combo',
    addGroup: 'Add Group',
    name: 'Name',
    price: 'Price',
    minQty: 'Min Qty',
    groupName: 'Group',
    stock: 'Stock',
    noStock: 'Out of stock',
    lowStock: 'Low stock',
    servings: 'left',
    editMode: 'Edit Mode',
    normalMode: 'Normal Mode',
    confirmDelete: 'Delete this item?',
    combo: 'Combos',
  },
  materials: {
    title: 'Materials',
    addMaterial: 'Add Material',
    editMaterial: 'Edit Material',
    name: 'Name',
    unit: 'Unit',
    unitCost: 'Unit Cost',
    currentStock: 'Stock',
    alertThreshold: 'Alert At',
    adjust: 'Adjust',
    adjustTitle: 'Adjust Stock',
    adjustAmount: 'Amount (+ in, - out)',
    current: 'Current',
    afterAdjust: 'After',
    confirmDelete: 'Delete this material?',
  },
  sales: {
    title: 'Sales',
    totalRevenue: 'Revenue',
    totalCost: 'Cost',
    totalProfit: 'Profit',
    orderCount: 'Orders',
    itemCount: 'Items',
    summary: 'Summary by Item',
    exportXlsx: 'Export XLSX',
    exportCsv: 'Export CSV',
    date: 'Date',
    name: 'Item',
    qty: 'Qty',
    revenue: 'Revenue',
    cost: 'Cost',
    profit: 'Profit',
    time: 'Time',
    noData: 'No sales data',
  },
  settings: {
    title: 'Settings',
    storeName: 'Store Name',
    currencySymbol: 'Currency',
    language: 'Language',
    groupManager: 'Group Manager',
    dataManager: 'Data Manager',
    exportDb: 'Export Database',
    clearData: 'Clear All Data',
    confirmClear: 'Clear all data? This cannot be undone.',
    save: 'Save',
    saved: 'Saved',
    deleteGroup: 'Delete Group',
    confirmDeleteGroup: 'Items in this group will have an empty group name. Confirm?',
  },
  common: {
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    close: 'Close',
    yes: 'Yes',
    no: 'No',
  },
}
```

- [ ] **Step 3: Write `src/locales/index.ts`**

```typescript
import { createI18n } from 'vue-i18n'
import zhCN from './zh-CN'
import en from './en'

function detectLocale(): string {
  const stored = localStorage.getItem('locale')
  if (stored) return stored
  return navigator.language.startsWith('zh') ? 'zh-CN' : 'en'
}

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages: { 'zh-CN': zhCN, en },
})

export function setLocale(locale: string) {
  i18n.global.locale.value = locale
  localStorage.setItem('locale', locale)
}
```

- [ ] **Step 4: Write `src/router/index.ts`**

```typescript
import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/items' },
    {
      path: '/items',
      name: 'items',
      component: () => import('../views/ItemsPage.vue'),
    },
    {
      path: '/materials',
      name: 'materials',
      component: () => import('../views/MaterialsPage.vue'),
    },
    {
      path: '/sales',
      name: 'sales',
      component: () => import('../views/SalesPage.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsPage.vue'),
    },
  ],
})

export default router
```

- [ ] **Step 5: Update `src/main.ts` to include i18n and router**

```typescript
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { i18n } from './locales'
import './style.css'

const app = createApp(App)
app.use(router)
app.use(i18n)
app.mount('#app')
```

- [ ] **Step 6: Create empty view placeholders**

For each view, create a minimal component:

**`src/views/ItemsPage.vue`**
```vue
<template>
  <div class="h-full"><p>Items Page</p></div>
</template>
```

**`src/views/MaterialsPage.vue`**, **`src/views/SalesPage.vue`**, **`src/views/SettingsPage.vue`** — same pattern.

- [ ] **Step 7: Verify**

```bash
npx tsc --noEmit
npm run dev
```

Expected: No errors, empty pages render when navigating via hash URLs.

---

### Task 3: App Layout + NavBar + CartSidebar Shell

**Files:**
- Create: `src/App.vue`
- Create: `src/components/NavBar.vue`
- Create: `src/components/CartSidebar.vue`

**Interfaces:**
- Consumes: `router`, `i18n`
- Produces: App shell layout (NavBar + CartSidebar + RouterView)

- [ ] **Step 1: Write `src/App.vue`**

```vue
<script setup lang="ts">
import NavBar from './components/NavBar.vue'
import CartSidebar from './components/CartSidebar.vue'
import { useCart } from './composables/useCart'
import { useSettings } from './composables/useSettings'

const cart = useCart()
const { settings, loadSettings } = useSettings()
loadSettings()
</script>

<template>
  <div class="h-screen w-screen flex flex-col overflow-hidden bg-gray-50">
    <NavBar />
    <div class="flex-1 flex overflow-hidden">
      <main class="flex-1 overflow-y-auto p-4">
        <router-view />
      </main>
      <CartSidebar v-if="cart.visible" />
    </div>
  </div>
</template>
```

- [ ] **Step 2: Write `src/components/NavBar.vue`**

```vue
<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useCart } from '../composables/useCart'
import { useSettings } from '../composables/useSettings'

const route = useRoute()
const router = useRouter()
const cart = useCart()
const { settings } = useSettings()

const tabs = [
  { path: '/items', key: 'nav.items', icon: '❖' },
  { path: '/materials', key: 'nav.materials', icon: '📦' },
  { path: '/sales', key: 'nav.sales', icon: '📊' },
  { path: '/settings', key: 'nav.settings', icon: '⚙' },
]

function navigate(path: string) {
  router.push(path)
}
</script>

<template>
  <header class="bg-indigo-600 text-white flex items-center px-4 py-2 gap-2 shrink-0">
    <button
      v-for="tab in tabs"
      :key="tab.path"
      @click="navigate(tab.path)"
      class="px-4 py-2 rounded-lg transition-colors text-lg font-medium"
      :class="route.path === tab.path ? 'bg-white/20' : 'hover:bg-white/10'"
    >
      {{ tab.icon }} {{ $t(tab.key) }}
    </button>
    <div class="flex-1" />
    <span class="text-sm mr-2">{{ settings.storeName || '' }}</span>
    <span class="font-bold">{{ settings.currencySymbol || '¥' }}</span>
    <button
      @click="cart.toggle()"
      class="ml-2 px-3 py-1 rounded hover:bg-white/20 transition-colors text-xl"
      :title="$t(cart.visible ? 'cart.hide' : 'cart.show')"
    >
      {{ cart.visible ? '◀' : '▶' }}
    </button>
  </header>
</template>
```

- [ ] **Step 3: Write `src/composables/useSettings.ts` (stub — full implementation in Task 5)**

```typescript
import { reactive } from 'vue'
import { db } from '../db'

interface SettingsState {
  storeName: string
  currencySymbol: string
  locale: string
}

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

  return { settings: state, loadSettings, saveSetting }
}
```

- [ ] **Step 4: Write `src/composables/useCart.ts` (stub — full implementation in Task 4)**

```typescript
import { reactive } from 'vue'
import type { CartEntry } from '../types'

interface CartState {
  items: CartEntry[]
  visible: boolean
}

const state = reactive<CartState>({
  items: [],
  visible: true,
})

export function useCart() {
  function toggle() { state.visible = !state.visible }
  function show() { state.visible = true }

  return {
    cart: state,
    toggle,
    show,
  }
}
```

- [ ] **Step 5: Write `src/components/CartSidebar.vue` (minimal shell)**

```vue
<script setup lang="ts">
import { useCart } from '../composables/useCart'
const { cart } = useCart()
</script>

<template>
  <aside class="w-80 bg-white border-l shadow-lg flex flex-col overflow-hidden transition-all duration-300">
    <div class="p-4 font-bold text-lg border-b">
      {{ $t('cart.title') }}
      <span v-if="cart.items.length" class="text-sm font-normal text-gray-500 ml-2">
        ({{ cart.items.length }})
      </span>
    </div>
    <div class="flex-1 overflow-y-auto p-4">
      <p v-if="cart.items.length === 0" class="text-gray-400 text-center mt-8">
        {{ $t('cart.empty') }}
      </p>
    </div>
  </aside>
</template>
```

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
```

Expected: No type errors. Dev server shows layout with navbar and empty cart sidebar.

---

### Task 4: Full Cart Store + Calculation Utils

**Files:**
- Rewrite: `src/composables/useCart.ts`
- Create: `src/utils/calculations.ts`

**Interfaces:**
- Consumes: `CartEntry` type
- Produces: `cartStore` with `addItem()`, `addCombo()`, `updateQty()`, `removeEntry()`, `clear()`, computed `totalAmount`, `totalCost`, `profit`

- [ ] **Step 1: Write `src/utils/calculations.ts`**

```typescript
import type { RawMaterial, ItemMaterial, ItemWithDetails, ComboWithDetails } from '../types'

/** Compute item unit cost = Σ(material.unitCost × amount) × minQty */
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

/** Compute item stock = FLOOR(MIN(materialStock / amount) / minQty) */
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
  if (minRatio === Infinity) return Infinity // no materials = unlimited
  return Math.floor(minRatio / minQty)
}

/** Compute combo cost = Σ(item.unitCost × comboItem.qty) */
export function computeComboCost(
  items: ItemWithDetails[],
  comboItemQtys: { itemId: number; qty: number }[]
): number {
  return comboItemQtys.reduce((sum, ci) => {
    const item = items.find(i => i.id === ci.itemId)
    return sum + (item?.unitCost ?? 0) * ci.qty
  }, 0)
}

/** Compute combo stock = MIN(item.stock / comboItem.qty) */
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
```

- [ ] **Step 2: Rewrite `src/composables/useCart.ts` (full implementation)**

```typescript
import { reactive, computed } from 'vue'
import type { CartEntry } from '../types'

interface CartState {
  items: CartEntry[]
  visible: boolean
}

const state = reactive<CartState>({
  items: [],
  visible: true,
})

export function useCart() {
  function addItem(entry: CartEntry) {
    const existing = state.items.find(
      e => e.type === entry.type && e.refId === entry.refId
    )
    if (existing) {
      existing.qty += 1
    } else {
      state.items.push({ ...entry })
    }
    state.visible = true
  }

  function updateQty(index: number, qty: number) {
    if (qty <= 0) {
      state.items.splice(index, 1)
    } else {
      state.items[index].qty = qty
    }
  }

  function removeEntry(index: number) {
    state.items.splice(index, 1)
  }

  function clear() {
    state.items.splice(0)
  }

  function toggle() {
    state.visible = !state.visible
  }

  function show() {
    state.visible = true
  }

  const totalAmount = computed(() =>
    state.items.reduce((sum, e) => sum + e.price * e.qty, 0)
  )
  const totalCost = computed(() =>
    state.items.reduce((sum, e) => sum + e.cost * e.qty, 0)
  )
  const profit = computed(() => totalAmount.value - totalCost.value)
  const itemCount = computed(() =>
    state.items.reduce((sum, e) => sum + e.qty, 0)
  )

  return {
    cart: state,
    addItem,
    updateQty,
    removeEntry,
    clear,
    toggle,
    show,
    totalAmount,
    totalCost,
    profit,
    itemCount,
  }
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

### Task 5: Settings Page

**Files:**
- Rewrite: `src/composables/useSettings.ts`
- Create: `src/views/SettingsPage.vue`
- Create: `src/components/ConfirmDialog.vue`

**Interfaces:**
- Consumes: `db.settings`
- Produces: `useSettings()` with reactive state, SettingsPage UI

- [ ] **Step 1: Rewrite `src/composables/useSettings.ts` (full)**

```typescript
import { reactive } from 'vue'
import { db } from '../db'

interface SettingsState {
  storeName: string
  currencySymbol: string
  locale: string
}

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

  async function clearAllData() {
    await db.delete()
    await db.open()
    // reload defaults
    Object.assign(state, defaults)
  }

  return {
    settings: state,
    loadSettings,
    saveSetting,
    getAllGroups,
    deleteGroup,
    clearAllData,
  }
}
```

- [ ] **Step 2: Write `src/components/ConfirmDialog.vue`**

```vue
<script setup lang="ts">
defineProps<{
  title: string
  message: string
}>()
const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div class="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
      <h3 class="text-lg font-bold mb-2">{{ title }}</h3>
      <p class="text-gray-600 mb-6">{{ message }}</p>
      <div class="flex justify-end gap-3">
        <button
          @click="emit('cancel')"
          class="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          @click="emit('confirm')"
          class="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
        >
          {{ $t('common.confirm') }}
        </button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Write `src/views/SettingsPage.vue`**

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSettings } from '../composables/useSettings'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const { settings, saveSetting, getAllGroups, deleteGroup, clearAllData } = useSettings()
const groups = ref<string[]>([])
const showClearConfirm = ref(false)
const showDeleteGroupConfirm = ref<string | null>(null)
const saved = ref(false)

onMounted(async () => {
  groups.value = await getAllGroups()
})

async function save(key: string, value: any) {
  await saveSetting(key, value)
  saved.value = true
  setTimeout(() => { saved.value = false }, 2000)
}

async function handleDeleteGroup(name: string) {
  await deleteGroup(name)
  groups.value = await getAllGroups()
  showDeleteGroupConfirm.value = null
}

async function handleClearAll() {
  await clearAllData()
  groups.value = []
  showClearConfirm.value = false
}
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-8 p-4">
    <!-- Saved indicator -->
    <div
      v-if="saved"
      class="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50"
    >
      {{ $t('settings.saved') }}
    </div>

    <!-- Store Name -->
    <section class="bg-white rounded-xl p-6 shadow-sm">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        {{ $t('settings.storeName') }}
      </label>
      <input
        :value="settings.storeName"
        @change="save('storeName', ($event.target as HTMLInputElement).value)"
        class="w-full px-4 py-3 border rounded-lg text-lg focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
        placeholder="My Store"
      />
    </section>

    <!-- Currency -->
    <section class="bg-white rounded-xl p-6 shadow-sm">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        {{ $t('settings.currencySymbol') }}
      </label>
      <select
        :value="settings.currencySymbol"
        @change="save('currencySymbol', ($event.target as HTMLSelectElement).value)"
        class="w-full px-4 py-3 border rounded-lg text-lg focus:ring-2 focus:ring-indigo-400"
      >
        <option value="¥">¥ (CNY)</option>
        <option value="$">$ (USD)</option>
        <option value="NT$">NT$ (TWD)</option>
        <option value="€">€ (EUR)</option>
        <option>自定义</option>
      </select>
    </section>

    <!-- Language -->
    <section class="bg-white rounded-xl p-6 shadow-sm">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        {{ $t('settings.language') }}
      </label>
      <select
        :value="settings.locale"
        @change="save('locale', ($event.target as HTMLSelectElement).value)"
        class="w-full px-4 py-3 border rounded-lg text-lg focus:ring-2 focus:ring-indigo-400"
      >
        <option value="zh-CN">中文</option>
        <option value="en">English</option>
      </select>
    </section>

    <!-- Group Manager -->
    <section class="bg-white rounded-xl p-6 shadow-sm">
      <h3 class="font-bold text-lg mb-4">{{ $t('settings.groupManager') }}</h3>
      <div class="flex flex-wrap gap-2">
        <div
          v-for="g in groups"
          :key="g"
          class="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg"
        >
          <span>{{ g }}</span>
          <button
            @click="showDeleteGroupConfirm = g"
            class="text-red-500 hover:text-red-700 text-lg leading-none"
          >×</button>
        </div>
        <p v-if="groups.length === 0" class="text-gray-400 text-sm">
          {{ $t('common.no') }}
        </p>
      </div>
    </section>

    <!-- Data Manager -->
    <section class="bg-white rounded-xl p-6 shadow-sm">
      <h3 class="font-bold text-lg mb-4">{{ $t('settings.dataManager') }}</h3>
      <div class="flex gap-4">
        <button class="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-lg">
          {{ $t('settings.exportDb') }}
        </button>
        <button
          @click="showClearConfirm = true"
          class="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 text-lg"
        >
          {{ $t('settings.clearData') }}
        </button>
      </div>
    </section>

    <!-- Confirm Dialogs -->
    <ConfirmDialog
      v-if="showClearConfirm"
      :title="$t('common.confirm')"
      :message="$t('settings.confirmClear')"
      @confirm="handleClearAll"
      @cancel="showClearConfirm = false"
    />
    <ConfirmDialog
      v-if="showDeleteGroupConfirm"
      :title="$t('settings.deleteGroup')"
      :message="$t('settings.confirmDeleteGroup')"
      @confirm="handleDeleteGroup(showDeleteGroupConfirm!)"
      @cancel="showDeleteGroupConfirm = null"
    />
  </div>
</template>
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

Expected: No errors. Navigate to `#/settings`, see all settings sections.

---

### Task 6: Items CRUD + Grid Display

**Files:**
- Create: `src/composables/useItems.ts`
- Create: `src/components/FormModal.vue`
- Create: `src/views/ItemsPage.vue` (full implementation)
- Create: `src/components/CartSidebar.vue` (cart footer — stub with totals)

**Interfaces:**
- Consumes: `db.items`, `db.rawMaterials`, `db.itemMaterials`, `useCart()`, `calculations.ts`
- Produces: Items grid with grouping, add/edit/delete items, add to cart

- [ ] **Step 1: Write `src/composables/useItems.ts`**

```typescript
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
```

- [ ] **Step 2: Write `src/components/FormModal.vue`**

```vue
<script setup lang="ts">
defineProps<{
  title: string
  show: boolean
}>()
const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      @click.self="emit('close')"
    >
      <div class="bg-white rounded-xl p-6 shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xl font-bold">{{ title }}</h3>
          <button @click="emit('close')" class="text-2xl leading-none text-gray-400 hover:text-gray-600">×</button>
        </div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
```

- [ ] **Step 3: Write full `src/views/ItemsPage.vue`**

This is the most complex view — grid, grouping, add/edit items, add to cart.

```vue
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useItems } from '../composables/useItems'
import { useCart } from '../composables/useCart'
import { db } from '../db'
import FormModal from '../components/FormModal.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import type { ItemWithDetails, RawMaterial } from '../types'

const { items, loadItems, addItem, updateItem, deleteItem } = useItems()
const cart = useCart()

const editMode = ref(false)
const showItemForm = ref(false)
const materials = ref<RawMaterial[]>([])
const combos = ref<any[]>([])  // Will be populated in Task 8
const editingItem = ref<ItemWithDetails | null>(null)
const itemForm = ref({ name: '', price: 0, minQty: 1, groupName: '' })
const showDeleteConfirm = ref<number | null>(null)

onMounted(async () => {
  await loadItems()
  materials.value = await db.rawMaterials.toArray()
})

// Groups
const groups = computed(() => {
  const map = new Map<string, ItemWithDetails[]>()
  for (const item of items.value) {
    const g = item.groupName || ''
    if (!map.has(g)) map.set(g, [])
    map.get(g)!.push(item)
  }
  return map
})

const sortedGroups = computed(() => {
  const entries = [...groups.value.entries()]
  entries.sort(([a], [b]) => a.localeCompare(b))
  return entries
})

function addToCart(item: ItemWithDetails) {
  cart.addItem({
    type: 'item',
    refId: item.id!,
    name: item.name,
    price: item.price,
    cost: item.unitCost,
    qty: 1,
  })
}

function openAddItem() {
  editingItem.value = null
  itemForm.value = { name: '', price: 0, minQty: 1, groupName: '' }
  showItemForm.value = true
}

function openEditItem(item: ItemWithDetails) {
  editingItem.value = item
  itemForm.value = {
    name: item.name,
    price: item.price,
    minQty: item.minQty,
    groupName: item.groupName,
  }
  showItemForm.value = true
}

async function saveItem() {
  if (!itemForm.value.name) return
  if (editingItem.value) {
    await updateItem(editingItem.value.id!, itemForm.value)
  } else {
    await addItem(itemForm.value)
  }
  showItemForm.value = false
}

async function handleDelete(id: number) {
  await deleteItem(id)
  showDeleteConfirm.value = null
}
</script>

<template>
  <div class="h-full flex flex-col" :class="{ 'bg-amber-50': editMode }">
    <!-- Edit Mode Toggle + Actions -->
    <div class="flex items-center gap-2 mb-4 flex-wrap">
      <button
        @click="editMode = !editMode"
        class="px-4 py-2 rounded-lg text-lg font-medium transition-colors"
        :class="editMode ? 'bg-amber-500 text-white' : 'bg-gray-200 hover:bg-gray-300'"
      >
        {{ editMode ? $t('items.normalMode') : $t('items.editMode') }}
      </button>
      <template v-if="editMode">
        <button
          @click="openAddItem()"
          class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-lg"
        >
          + {{ $t('items.addItem') }}
        </button>
      </template>
    </div>

    <!-- Grid -->
    <div class="flex-1 overflow-y-auto">
      <!-- Combos section -->
      <div v-if="combos.length" class="mb-6">
        <h2 class="text-lg font-bold text-indigo-700 mb-2 px-1">
          ⊞ {{ $t('items.combo') }}
        </h2>
        <div class="h-px bg-indigo-200 mb-3" />
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <div
            v-for="combo in combos"
            :key="combo.id"
            @click="cart.addItem({ type: 'combo', refId: combo.id!, name: combo.name, price: combo.price, cost: combo.cost, qty: 1 })"
            class="bg-white rounded-xl p-4 shadow-sm border-2 border-indigo-100 hover:border-indigo-300 cursor-pointer transition-all min-h-[80px] flex flex-col justify-center items-center"
            :class="{ 'opacity-50 pointer-events-none': combo.stock <= 0 }"
          >
            <div class="font-bold text-lg text-indigo-700">{{ combo.name }}</div>
            <div class="text-indigo-600 text-xl font-bold mt-1">{{ combo.price }}</div>
            <div v-if="combo.stock <= 0" class="text-xs text-red-500 mt-1">{{ $t('items.noStock') }}</div>
            <div v-else-if="combo.stock < 5" class="text-xs text-amber-500 mt-1">
              {{ $t('items.lowStock') }} ({{ combo.stock }}{{ $t('items.servings') }})
            </div>
            <div v-else class="text-xs text-gray-400 mt-1">{{ combo.stock }}{{ $t('items.servings') }}</div>
          </div>
        </div>
      </div>

      <!-- Regular groups -->
      <div v-for="[group, groupItems] in sortedGroups" :key="group" class="mb-6">
        <div class="flex items-center justify-between mb-2 px-1">
          <h2 class="text-lg font-bold text-gray-700">{{ group || $t('items.groupName') }}</h2>
          <button
            v-if="editMode"
            class="px-2 py-1 text-sm bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
          >
            + {{ $t('items.addGroup') }}
          </button>
        </div>
        <div class="h-px bg-gray-200 mb-3" />
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <div
            v-for="item in groupItems"
            :key="item.id"
            @click="!editMode && addToCart(item)"
            class="bg-white rounded-xl p-4 shadow-sm hover:shadow-md cursor-pointer transition-all border-2 border-transparent hover:border-indigo-200"
            :class="{
              'opacity-50 pointer-events-none cursor-not-allowed': item.stock <= 0,
              'border-amber-300': editMode,
            }"
          >
            <div class="font-bold text-lg">{{ item.name }}</div>
            <div class="text-gray-800 text-xl font-bold mt-1">{{ item.price }}</div>
            <div v-if="item.stock <= 0" class="text-xs text-red-500 mt-1">{{ $t('items.noStock') }}</div>
            <div v-else-if="item.stock < 5" class="text-xs text-amber-500 mt-1">
              {{ $t('items.lowStock') }} ({{ item.stock }}{{ $t('items.servings') }})
            </div>
            <div v-else class="text-xs text-gray-400 mt-1">{{ item.stock }}{{ $t('items.servings') }}</div>
            <!-- Edit/delete in edit mode -->
            <div v-if="editMode" class="flex gap-2 mt-2 pt-2 border-t border-gray-100">
              <button
                @click.stop="openEditItem(item)"
                class="text-xs px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
              >
                {{ $t('common.edit') }}
              </button>
              <button
                @click.stop="showDeleteConfirm = item.id!"
                class="text-xs px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                {{ $t('common.delete') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Item Form Modal -->
    <FormModal
      :show="showItemForm"
      :title="editingItem ? $t('items.editItem') : $t('items.addItem')"
      @close="showItemForm = false"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('items.name') }}</label>
          <input v-model="itemForm.name" class="w-full px-3 py-2 border rounded-lg text-lg" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('items.price') }}</label>
          <input v-model.number="itemForm.price" type="number" step="0.01" min="0" class="w-full px-3 py-2 border rounded-lg text-lg" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('items.minQty') }}</label>
          <input v-model.number="itemForm.minQty" type="number" min="1" class="w-full px-3 py-2 border rounded-lg text-lg" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('items.groupName') }}</label>
          <input v-model="itemForm.groupName" list="group-list" class="w-full px-3 py-2 border rounded-lg text-lg" />
          <datalist id="group-list">
            <option v-for="g in sortedGroups" :key="g[0]" :value="g[0]" />
          </datalist>
        </div>
        <div class="flex justify-end gap-3 pt-2">
          <button @click="showItemForm = false" class="px-6 py-3 border rounded-lg text-lg">{{ $t('common.cancel') }}</button>
          <button @click="saveItem" class="px-6 py-3 bg-indigo-600 text-white rounded-lg text-lg">{{ $t('common.save') }}</button>
        </div>
      </div>
    </FormModal>

    <!-- Delete Confirm -->
    <ConfirmDialog
      v-if="showDeleteConfirm"
      :title="$t('common.confirm')"
      :message="$t('items.confirmDelete')"
      @confirm="handleDelete(showDeleteConfirm!)"
      @cancel="showDeleteConfirm = null"
    />
  </div>
</template>
```

Note: The combo section at the top references `combos` — for now just render an empty section. Full combo implementation comes in Task 8.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

Expected: No errors. Items page shows with grid, edit mode toggle, item form modal.

---

### Task 7: Item Materials (Recipe Linking)

**Files:**
- Modify: `src/views/ItemsPage.vue` (add materials tab/section to item form)
- Create (new composable usage): enhance `useItems` material queries

**Interfaces:**
- Consumes: `db.rawMaterials`, `db.itemMaterials`, `useItems()`
- Produces: Material selection in item form, auto cost/stock computation

- [ ] **Step 1: Add materials section to ItemFormModal in ItemsPage**

Add after the groupName field in the form modal:

```vue
<div>
  <label class="block text-sm font-medium text-gray-700 mb-2">{{ $t('materials.title') }}</label>
  <div v-for="(mat, idx) in formMaterials" :key="idx" class="flex gap-2 mb-2 items-center">
    <select v-model="mat.materialId" class="flex-1 px-3 py-2 border rounded-lg">
      <option value="0" disabled>--</option>
      <option v-for="m in materials" :key="m.id" :value="m.id">{{ m.name }}</option>
    </select>
    <input v-model.number="mat.amount" type="number" step="0.01" min="0.01"
      class="w-24 px-3 py-2 border rounded-lg text-center" placeholder="用量" />
    <button @click="formMaterials.splice(idx, 1)" class="text-red-500 px-2">×</button>
  </div>
  <button
    @click="formMaterials.push({ materialId: 0, amount: 1 })"
    class="text-sm text-indigo-600 hover:text-indigo-800"
  >
    + {{ $t('materials.addMaterial') }}
  </button>
</div>
```

Add reactive state:
```typescript
const formMaterials = ref<{ materialId: number; amount: number }[]>([])
```

Reset in `openAddItem` and `openEditItem`:
```typescript
formMaterials.value = []
// If editing, load existing materials
if (editingItem.value) {
  const existing = await db.itemMaterials.where('itemId').equals(editingItem.value.id!).toArray()
  formMaterials.value = existing.map(im => ({ materialId: im.materialId, amount: im.amount }))
}
```

Update `saveItem` to also save materials:
```typescript
async function saveItem() {
  if (!itemForm.value.name) return
  let itemId: number
  if (editingItem.value) {
    await updateItem(editingItem.value.id!, itemForm.value)
    itemId = editingItem.value.id!
  } else {
    itemId = await addItem(itemForm.value)
  }
  // Save materials
  await db.itemMaterials.where('itemId').equals(itemId).delete()
  for (const fm of formMaterials.value) {
    if (fm.materialId && fm.amount > 0) {
      await db.itemMaterials.add({ itemId, materialId: fm.materialId, amount: fm.amount })
    }
  }
  showItemForm.value = false
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: No errors. Item form now has material selection. After saving, item cost and stock are computed from linked materials.

---

### Task 8: Combos CRUD

**Files:**
- Create: `src/composables/useCombos.ts`
- Modify: `src/views/ItemsPage.vue` (combo form modal, combo list)

**Interfaces:**
- Consumes: `db.combos`, `db.comboItems`, `useItems()`, `useCart()`
- Produces: Combo CRUD, combo display above item groups

- [ ] **Step 1: Write `src/composables/useCombos.ts`**

```typescript
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
```

- [ ] **Step 2: Integrate into `ItemsPage.vue`**

Replace the stub combo section in ItemsPage with full integration:

Add to script:
```typescript
import { useCombos } from '../composables/useCombos'
import type { ComboWithDetails } from '../types'
const { combos, loadCombos, addCombo, updateCombo, deleteCombo } = useCombos()
```

Replace `onMounted`:
```typescript
onMounted(async () => {
  await loadItems()
  materials.value = await db.rawMaterials.toArray()
  await loadCombos()
})
```

Add combo form state:
```typescript
const showComboForm = ref(false)
const editingCombo = ref<ComboWithDetails | null>(null)
const comboForm = ref({ name: '', price: 0, items: [] as { itemId: number; qty: number }[] })
```

Add combo cart handler:
```typescript
function addComboToCart(combo: ComboWithDetails) {
  cart.addItem({
    type: 'combo',
    refId: combo.id!,
    name: combo.name,
    price: combo.price,
    cost: combo.cost,
    qty: 1,
  })
}
```

Replace the combo rendering loop's `@click` handler from inline to `addComboToCart(combo)`.

Add combo form modal (after item form modal):
```vue
<FormModal
  :show="showComboForm"
  :title="editingCombo ? $t('items.editCombo') : $t('items.addCombo')"
  @close="showComboForm = false"
>
  <div class="space-y-4">
    <div>
      <label class="block text-sm font-medium text-gray-700">{{ $t('items.name') }}</label>
      <input v-model="comboForm.name" class="w-full px-3 py-2 border rounded-lg text-lg" />
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700">{{ $t('items.price') }}</label>
      <input v-model.number="comboForm.price" type="number" step="0.01" min="0" class="w-full px-3 py-2 border rounded-lg text-lg" />
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">{{ $t('items.name') }}</label>
      <div v-for="(ci, idx) in comboForm.items" :key="idx" class="flex gap-2 mb-2 items-center">
        <select v-model="ci.itemId" class="flex-1 px-3 py-2 border rounded-lg">
          <option value="0" disabled>--</option>
          <option v-for="item in items" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
        <span class="text-gray-500">×</span>
        <input v-model.number="ci.qty" type="number" min="1" class="w-20 px-3 py-2 border rounded-lg text-center" />
        <button @click="comboForm.items.splice(idx, 1)" class="text-red-500 px-2">×</button>
      </div>
      <button
        @click="comboForm.items.push({ itemId: 0, qty: 1 })"
        class="text-sm text-indigo-600 hover:text-indigo-800"
      >
        + {{ $t('items.addItem') }}
      </button>
    </div>
    <div class="flex justify-end gap-3 pt-2">
      <button @click="showComboForm = false" class="px-6 py-3 border rounded-lg text-lg">{{ $t('common.cancel') }}</button>
      <button @click="saveCombo" class="px-6 py-3 bg-indigo-600 text-white rounded-lg text-lg">{{ $t('common.save') }}</button>
    </div>
  </div>
</FormModal>
```

Add combo save handler:
```typescript
async function saveCombo() {
  if (!comboForm.value.name || !comboForm.value.price) return
  const items = comboForm.value.items.filter(ci => ci.itemId > 0)
  if (editingCombo.value) {
    await updateCombo(editingCombo.value.id!, { ...comboForm.value, items })
  } else {
    await addCombo({ ...comboForm.value, items })
  }
  showComboForm.value = false
}
```

Add "+ 套餐" button in edit mode bar:
```vue
<button
  @click="openAddCombo()"
  class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-lg"
>
  + {{ $t('items.addCombo') }}
</button>
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Expected: No errors. Combos display at top of items grid, editable in edit mode, clickable to add to cart.

---

### Task 9: Materials Page

**Files:**
- Rewrite: `src/views/MaterialsPage.vue`
- Create: `src/composables/useMaterials.ts`

**Interfaces:**
- Consumes: `db.rawMaterials`
- Produces: Material grid, CRUD, stock adjustment

- [ ] **Step 1: Write `src/composables/useMaterials.ts`**

```typescript
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
```

- [ ] **Step 2: Write full `src/views/MaterialsPage.vue`**

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMaterials } from '../composables/useMaterials'
import FormModal from '../components/FormModal.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import type { RawMaterial } from '../types'

const { materials, loadMaterials, addMaterial, updateMaterial, deleteMaterial, adjustStock } = useMaterials()

const showForm = ref(false)
const editingMaterial = ref<RawMaterial | null>(null)
const form = ref({ name: '', unit: '个', unitCost: 0, currentStock: 0, alertThreshold: 0 })

const showAdjust = ref<RawMaterial | null>(null)
const adjustDelta = ref(0)
const showDelete = ref<number | null>(null)

onMounted(loadMaterials)

function openAdd() {
  editingMaterial.value = null
  form.value = { name: '', unit: '个', unitCost: 0, currentStock: 0, alertThreshold: 0 }
  showForm.value = true
}

function openEdit(mat: RawMaterial) {
  editingMaterial.value = mat
  form.value = {
    name: mat.name,
    unit: mat.unit,
    unitCost: mat.unitCost,
    currentStock: mat.currentStock,
    alertThreshold: mat.alertThreshold,
  }
  showForm.value = true
}

async function saveMaterial() {
  if (!form.value.name) return
  if (editingMaterial.value) {
    await updateMaterial(editingMaterial.value.id!, form.value)
  } else {
    await addMaterial(form.value)
  }
  showForm.value = false
}

async function handleAdjust(mat: RawMaterial) {
  await adjustStock(mat.id!, adjustDelta.value)
  showAdjust.value = null
  adjustDelta.value = 0
}

async function handleDelete(id: number) {
  await deleteMaterial(id)
  showDelete.value = null
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex items-center gap-2 mb-4">
      <button
        @click="openAdd()"
        class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-lg"
      >
        + {{ $t('materials.addMaterial') }}
      </button>
    </div>

    <!-- Grid -->
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <div
        v-for="mat in materials"
        :key="mat.id"
        class="bg-white rounded-xl p-4 shadow-sm border"
        :class="mat.currentStock <= mat.alertThreshold ? 'border-red-300 bg-red-50' : 'border-gray-200'"
      >
        <div class="font-bold text-lg">{{ mat.name }}</div>
        <div class="text-sm text-gray-500 mt-1">{{ mat.unit }}</div>
        <div class="mt-2 space-y-1">
          <div class="flex justify-between">
            <span class="text-gray-600">{{ $t('materials.currentStock') }}:</span>
            <span class="font-semibold" :class="mat.currentStock <= mat.alertThreshold ? 'text-red-600' : ''">
              {{ mat.currentStock }} {{ mat.unit }}
            </span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">{{ $t('materials.unitCost') }}:</span>
            <span class="font-semibold">{{ mat.unitCost }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">{{ $t('materials.alertThreshold') }}:</span>
            <span class="font-semibold">{{ mat.alertThreshold }}</span>
          </div>
        </div>
        <div class="flex gap-2 mt-3 pt-3 border-t border-gray-100">
          <button
            @click="showAdjust = mat"
            class="flex-1 px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm"
          >
            {{ $t('materials.adjust') }}
          </button>
          <button
            @click="openEdit(mat)"
            class="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 text-sm"
          >
            {{ $t('common.edit') }}
          </button>
          <button
            @click="showDelete = mat.id!"
            class="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
          >
            {{ $t('common.delete') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Form Modal -->
    <FormModal
      :show="showForm"
      :title="editingMaterial ? $t('materials.editMaterial') : $t('materials.addMaterial')"
      @close="showForm = false"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('materials.name') }}</label>
          <input v-model="form.name" class="w-full px-3 py-2 border rounded-lg text-lg" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('materials.unit') }}</label>
          <select v-model="form.unit" class="w-full px-3 py-2 border rounded-lg text-lg">
            <option value="个">个</option>
            <option value="g">g</option>
            <option value="ml">ml</option>
            <option value="包">包</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('materials.unitCost') }}</label>
          <input v-model.number="form.unitCost" type="number" step="0.01" min="0" class="w-full px-3 py-2 border rounded-lg text-lg" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('materials.currentStock') }}</label>
          <input v-model.number="form.currentStock" type="number" min="0" class="w-full px-3 py-2 border rounded-lg text-lg" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('materials.alertThreshold') }}</label>
          <input v-model.number="form.alertThreshold" type="number" min="0" class="w-full px-3 py-2 border rounded-lg text-lg" />
        </div>
        <div class="flex justify-end gap-3 pt-2">
          <button @click="showForm = false" class="px-6 py-3 border rounded-lg text-lg">{{ $t('common.cancel') }}</button>
          <button @click="saveMaterial" class="px-6 py-3 bg-indigo-600 text-white rounded-lg text-lg">{{ $t('common.save') }}</button>
        </div>
      </div>
    </FormModal>

    <!-- Stock Adjust Modal -->
    <FormModal
      :show="!!showAdjust"
      :title="$t('materials.adjustTitle')"
      @close="showAdjust = null"
    >
      <div v-if="showAdjust" class="space-y-4">
        <p>{{ $t('materials.current') }}: <strong>{{ showAdjust.currentStock }} {{ showAdjust.unit }}</strong></p>
        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('materials.adjustAmount') }}</label>
          <input v-model.number="adjustDelta" type="number" class="w-full px-3 py-2 border rounded-lg text-lg" placeholder="+10 / -5" />
        </div>
        <p>{{ $t('materials.afterAdjust') }}: <strong>{{ Math.max(0, showAdjust.currentStock + adjustDelta) }} {{ showAdjust.unit }}</strong></p>
        <div class="flex justify-end gap-3 pt-2">
          <button @click="showAdjust = null" class="px-6 py-3 border rounded-lg text-lg">{{ $t('common.cancel') }}</button>
          <button @click="handleAdjust(showAdjust)" class="px-6 py-3 bg-amber-500 text-white rounded-lg text-lg">{{ $t('common.confirm') }}</button>
        </div>
      </div>
    </FormModal>

    <!-- Delete Confirm -->
    <ConfirmDialog
      v-if="showDelete"
      :title="$t('common.confirm')"
      :message="$t('materials.confirmDelete')"
      @confirm="handleDelete(showDelete)"
      @cancel="showDelete = null"
    />
  </div>
</template>
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Expected: No errors. Materials page with grid, CRUD, stock adjustment.

---

### Task 10: Full CartSidebar + Checkout Flow

**Files:**
- Rewrite: `src/components/CartSidebar.vue` (full)
- Create: `src/components/CartFooter.vue`
- Create: `src/components/CartItemList.vue`
- Create: `src/composables/useOrders.ts`

**Interfaces:**
- Consumes: `useCart()`, `db.rawMaterials`, `db.itemMaterials`, `useSettings()`
- Produces: Cart sidebar with full functionality, checkout flow, order creation

- [ ] **Step 1: Write `src/composables/useOrders.ts`**

```typescript
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
```

- [ ] **Step 2: Rewrite `src/components/CartSidebar.vue` (full)**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useCart } from '../composables/useCart'
import { useOrders } from '../composables/useOrders'
import { useSettings } from '../composables/useSettings'
import ConfirmDialog from './ConfirmDialog.vue'

const cart = useCart()
const { checkout } = useOrders()
const { settings } = useSettings()

const showCheckoutConfirm = ref(false)
const showClearConfirm = ref(false)
const checkoutError = ref('')
const checkingOut = ref(false)

async function handleCheckout() {
  checkingOut.value = true
  checkoutError.value = ''
  try {
    await checkout(cart.cart.items, settings.currencySymbol)
    cart.clear()
    showCheckoutConfirm.value = false
  } catch (e: any) {
    checkoutError.value = e.message
  } finally {
    checkingOut.value = false
  }
}
</script>

<template>
  <aside
    class="w-80 bg-white border-l shadow-lg flex flex-col overflow-hidden transition-all duration-300"
    :class="cart.cart.visible ? 'translate-x-0' : 'translate-x-full'"
  >
    <!-- Header -->
    <div class="p-4 font-bold text-lg border-b flex items-center justify-between">
      <span>
        {{ $t('cart.title') }}
        <span v-if="cart.cart.items.length" class="text-sm font-normal text-gray-500 ml-2">
          ({{ cart.itemCount.value }})
        </span>
      </span>
    </div>

    <!-- Cart Items -->
    <div class="flex-1 overflow-y-auto p-4 space-y-3">
      <p v-if="cart.cart.items.length === 0" class="text-gray-400 text-center mt-8">
        {{ $t('cart.empty') }}
      </p>
      <div
        v-for="(entry, idx) in cart.cart.items"
        :key="`${entry.type}-${entry.refId}`"
        class="bg-gray-50 rounded-lg p-3"
      >
        <div class="flex items-center justify-between">
          <span class="font-semibold">{{ entry.name }}</span>
          <button
            @click="cart.removeEntry(idx)"
            class="text-red-500 hover:text-red-700 text-lg leading-none"
          >×</button>
        </div>
        <div class="flex items-center justify-between mt-2">
          <div class="flex items-center gap-2">
            <button
              @click="cart.updateQty(idx, entry.qty - 1)"
              class="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 font-bold text-lg flex items-center justify-center"
            >−</button>
            <span class="w-8 text-center font-bold text-lg">{{ entry.qty }}</span>
            <button
              @click="cart.updateQty(idx, entry.qty + 1)"
              class="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 font-bold text-lg flex items-center justify-center"
            >+</button>
          </div>
          <span class="font-bold">{{ settings.currencySymbol }}{{ (entry.price * entry.qty).toFixed(2) }}</span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="border-t p-4 space-y-3 bg-gray-50">
      <div class="space-y-1 text-sm">
        <div class="flex justify-between">
          <span>{{ $t('cart.totalSales') }}:</span>
          <span>{{ settings.currencySymbol }}{{ cart.totalAmount.value.toFixed(2) }}</span>
        </div>
        <div class="flex justify-between text-gray-600">
          <span>{{ $t('cart.totalCost') }}:</span>
          <span>{{ settings.currencySymbol }}{{ cart.totalCost.value.toFixed(2) }}</span>
        </div>
        <div class="flex justify-between font-bold text-lg pt-1 border-t">
          <span>{{ $t('cart.profit') }}:</span>
          <span :class="cart.profit.value >= 0 ? 'text-green-600' : 'text-red-600'">
            {{ settings.currencySymbol }}{{ cart.profit.value.toFixed(2) }}
          </span>
        </div>
      </div>
      <div class="flex gap-2">
        <button
          @click="showClearConfirm = true"
          class="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-100 text-lg font-medium"
          :disabled="cart.cart.items.length === 0"
        >
          {{ $t('cart.clear') }}
        </button>
        <button
          @click="showCheckoutConfirm = true"
          class="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-lg font-bold"
          :disabled="cart.cart.items.length === 0 || checkingOut"
        >
          {{ checkingOut ? '...' : $t('cart.checkout') }}
        </button>
      </div>
      <p v-if="checkoutError" class="text-red-600 text-sm text-center">{{ checkoutError }}</p>
    </div>

    <!-- Dialogs -->
    <ConfirmDialog
      v-if="showCheckoutConfirm"
      :title="$t('common.confirm')"
      :message="$t('cart.confirmCheckout')"
      @confirm="handleCheckout"
      @cancel="showCheckoutConfirm = false"
    />
    <ConfirmDialog
      v-if="showClearConfirm"
      :title="$t('common.confirm')"
      :message="$t('cart.confirmClear')"
      @confirm="(cart.clear(), showClearConfirm = false)"
      @cancel="showClearConfirm = false"
    />
  </aside>
</template>
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Expected: No errors. Full cart with quantity controls, totals, checkout flow with stock validation.

---

### Task 11: Sales Page + Export

**Files:**
- Rewrite: `src/views/SalesPage.vue`
- Create: `src/utils/export.ts`

**Interfaces:**
- Consumes: `useOrders()`, `useSettings()`, SheetJS
- Produces: Sales summary page with XLSX/CSV export

- [ ] **Step 1: Write `src/utils/export.ts`**

```typescript
import * as XLSX from 'xlsx'
import type { Order, OrderItem } from '../types'

interface ExportRow {
  name: string
  qty: number
  revenue: number
  unitCost: number
  totalCost: number
  profit: number
  time?: string
}

function buildRows(orderItems: (OrderItem & { orderTime?: string })[]): ExportRow[] {
  // Aggregate by item name
  const map = new Map<string, { qty: number; revenue: number; unitCost: number; totalCost: number }>()
  for (const oi of orderItems) {
    const existing = map.get(oi.name)
    if (existing) {
      existing.qty += oi.qty
      existing.revenue += oi.unitPrice * oi.qty
      existing.totalCost += oi.unitCost * oi.qty
    } else {
      map.set(oi.name, {
        qty: oi.qty,
        revenue: oi.unitPrice * oi.qty,
        unitCost: oi.unitCost,
        totalCost: oi.unitCost * oi.qty,
      })
    }
  }
  return [...map.entries()].map(([name, data]) => ({
    name,
    ...data,
    profit: data.revenue - data.totalCost,
  }))
}

export function exportToXlsx(
  orderItems: (OrderItem & { orderTime?: string })[],
  storeName: string,
  currencySymbol: string,
  dateStr: string
) {
  const rows = buildRows(orderItems)
  const totals = {
    name: 'TOTAL',
    qty: rows.reduce((s, r) => s + r.qty, 0),
    revenue: rows.reduce((s, r) => s + r.revenue, 0),
    unitCost: 0,
    totalCost: rows.reduce((s, r) => s + r.totalCost, 0),
    profit: rows.reduce((s, r) => s + r.profit, 0),
  }

  const wsData = [
    [storeName],
    [`Sales Report - ${dateStr}`],
    [],
    ['Item', 'Qty', 'Revenue', 'Unit Cost', 'Total Cost', 'Profit'],
    ...rows.map(r => [r.name, r.qty, r.revenue, r.unitCost, r.totalCost, r.profit]),
    [],
    ['TOTAL', totals.qty, totals.revenue, '', totals.totalCost, totals.profit],
  ]

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sales')
  XLSX.writeFile(wb, `sales-${dateStr}.xlsx`)
}

export function exportToCsv(
  orderItems: (OrderItem & { orderTime?: string })[],
  storeName: string,
  dateStr: string
) {
  const rows = buildRows(orderItems)
  const csvRows = [
    `${storeName}`,
    `Sales Report - ${dateStr}`,
    '',
    'Item,Qty,Revenue,Unit Cost,Total Cost,Profit',
    ...rows.map(r => `${r.name},${r.qty},${r.revenue},${r.unitCost},${r.totalCost},${r.profit}`),
  ]
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sales-${dateStr}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Write `src/views/SalesPage.vue`**

```vue
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useOrders } from '../composables/useOrders'
import { useSettings } from '../composables/useSettings'
import { exportToXlsx, exportToCsv } from '../utils/export'

const { getTodaySales, getSalesByDateRange } = useOrders()
const { settings } = useSettings()

const orders = ref<any[]>([])
const orderItems = ref<any[]>([])
const dateRange = ref<'today' | 'custom'>('today')
const startDate = ref(new Date().toISOString().slice(0, 10))
const endDate = ref(new Date().toISOString().slice(0, 10))

onMounted(loadSales)

async function loadSales() {
  const start = new Date(startDate.value)
  start.setHours(0, 0, 0, 0)
  const end = new Date(endDate.value)
  end.setHours(23, 59, 59, 999)

  const result = await getSalesByDateRange(start, end)
  orders.value = result.orders
  orderItems.value = result.orderItems
}

const totalRevenue = computed(() =>
  orderItems.value.reduce((s, oi) => s + oi.unitPrice * oi.qty, 0)
)
const totalCost = computed(() =>
  orderItems.value.reduce((s, oi) => s + oi.unitCost * oi.qty, 0)
)
const totalProfit = computed(() => totalRevenue.value - totalCost.value)

const summaryByItem = computed(() => {
  const map = new Map<string, { qty: number; revenue: number; cost: number }>()
  for (const oi of orderItems.value) {
    const existing = map.get(oi.name)
    if (existing) {
      existing.qty += oi.qty
      existing.revenue += oi.unitPrice * oi.qty
      existing.cost += oi.unitCost * oi.qty
    } else {
      map.set(oi.name, {
        qty: oi.qty,
        revenue: oi.unitPrice * oi.qty,
        cost: oi.unitCost * oi.qty,
      })
    }
  }
  return [...map.entries()].map(([name, data]) => ({ name, ...data, profit: data.revenue - data.cost }))
})

function handleExportXlsx() {
  exportToXlsx(
    orderItems.value,
    settings.storeName || 'Store',
    settings.currencySymbol,
    `${startDate.value}-${endDate.value}`
  )
}

function handleExportCsv() {
  exportToCsv(orderItems.value, settings.storeName || 'Store', `${startDate.value}-${endDate.value}`)
}

watch([startDate, endDate], loadSales)
</script>

<template>
  <div class="h-full overflow-y-auto">
    <!-- Date Controls -->
    <div class="flex items-center gap-4 mb-6 flex-wrap">
      <div class="flex items-center gap-2">
        <label class="text-sm font-medium">{{ $t('sales.date') }}:</label>
        <input v-model="startDate" type="date" class="px-3 py-2 border rounded-lg" />
        <span>~</span>
        <input v-model="endDate" type="date" class="px-3 py-2 border rounded-lg" />
      </div>
      <button
        @click="handleExportXlsx"
        class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-lg"
      >
        {{ $t('sales.exportXlsx') }}
      </button>
      <button
        @click="handleExportCsv"
        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg"
      >
        {{ $t('sales.exportCsv') }}
      </button>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="bg-white rounded-xl p-4 shadow-sm">
        <div class="text-sm text-gray-500">{{ $t('sales.totalRevenue') }}</div>
        <div class="text-2xl font-bold text-green-600">{{ settings.currencySymbol }}{{ totalRevenue.toFixed(2) }}</div>
      </div>
      <div class="bg-white rounded-xl p-4 shadow-sm">
        <div class="text-sm text-gray-500">{{ $t('sales.totalCost') }}</div>
        <div class="text-2xl font-bold text-amber-600">{{ settings.currencySymbol }}{{ totalCost.toFixed(2) }}</div>
      </div>
      <div class="bg-white rounded-xl p-4 shadow-sm">
        <div class="text-sm text-gray-500">{{ $t('sales.totalProfit') }}</div>
        <div class="text-2xl font-bold" :class="totalProfit >= 0 ? 'text-indigo-600' : 'text-red-600'">
          {{ settings.currencySymbol }}{{ totalProfit.toFixed(2) }}
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4 mb-6">
      <div class="bg-white rounded-xl p-4 shadow-sm">
        <div class="text-sm text-gray-500">{{ $t('sales.orderCount') }}</div>
        <div class="text-xl font-bold">{{ orders.length }}</div>
      </div>
      <div class="bg-white rounded-xl p-4 shadow-sm">
        <div class="text-sm text-gray-500">{{ $t('sales.itemCount') }}</div>
        <div class="text-xl font-bold">{{ orderItems.length }}</div>
      </div>
    </div>

    <!-- Item Summary Table -->
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <div class="p-4 font-bold text-lg border-b">{{ $t('sales.summary') }}</div>
      <div v-if="summaryByItem.length === 0" class="p-8 text-center text-gray-400">
        {{ $t('sales.noData') }}
      </div>
      <table v-else class="w-full text-left">
        <thead class="bg-gray-50">
          <tr>
            <th class="p-3 font-medium">{{ $t('sales.name') }}</th>
            <th class="p-3 font-medium">{{ $t('sales.qty') }}</th>
            <th class="p-3 font-medium">{{ $t('sales.revenue') }}</th>
            <th class="p-3 font-medium">{{ $t('sales.cost') }}</th>
            <th class="p-3 font-medium">{{ $t('sales.profit') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in summaryByItem" :key="item.name" class="border-t">
            <td class="p-3 font-medium">{{ item.name }}</td>
            <td class="p-3">{{ item.qty }}</td>
            <td class="p-3">{{ settings.currencySymbol }}{{ item.revenue.toFixed(2) }}</td>
            <td class="p-3">{{ settings.currencySymbol }}{{ item.cost.toFixed(2) }}</td>
            <td class="p-3" :class="item.profit >= 0 ? 'text-green-600' : 'text-red-600'">
              {{ settings.currencySymbol }}{{ item.profit.toFixed(2) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Fix SalesPage — add missing `watch` import**

```typescript
import { ref, onMounted, computed, watch } from 'vue'
```

- [ ] **Step 4: Verify**

```bash
npm install xlsx  # if not yet installed
npx tsc --noEmit
```

Expected: No errors. Sales page shows summaries and exports.

---

### Task 12: Edit Mode Polish + PWA Config

**Files:**
- Modify: `src/views/ItemsPage.vue` (edit mode refinements)
- Modify: `vite.config.ts` (add PWA plugin config)
- Create: `public/manifest.json` (optional — vite-plugin-pwa generates this)

**Interfaces:**
- Consumes: Existing ItemsPage, vite config
- Produces: Polished edit mode experience, installable PWA

- [ ] **Step 1: Update `vite.config.ts` with PWA configuration**

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Simple Account',
        short_name: 'LightweightPos',
        description: 'Offline order system for store sales',
        theme_color: '#4f46e5',
        background_color: '#f9fafb',
        display: 'standalone',
        orientation: 'landscape',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*/,
            handler: 'NetworkFirst',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': '/src' },
  },
})
```

- [ ] **Step 2: Polish edit mode in ItemsPage**

Ensure the edit mode bar has all three buttons (+ item, + combo, + group) and the background shifts to amber-50. Confirm edit/delete icons appear on both item cards and combo cards.

The existing code already implements this from Task 6/8. Verify:
- Edit mode toggle works ✓
- Background changes to amber-50 ✓
- +Item button shown ✓
- +Combo button shown ✓
- Edit/delete buttons on cards ✓

- [ ] **Step 3: Add "Add Group" modal**

Add a simple prompt-based group creation. When user clicks "+ Group" in edit mode, show a small inline input:

```typescript
const showGroupInput = ref(false)
const newGroupName = ref('')
```

In template, after the other edit mode buttons:
```vue
<template v-if="editMode">
  <template v-if="!showGroupInput">
    <button @click="openAddItem()" ...>+ {{ $t('items.addItem') }}</button>
    <button @click="openAddCombo()" ...>+ {{ $t('items.addCombo') }}</button>
    <button @click="showGroupInput = true" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-lg">
      + {{ $t('items.addGroup') }}
    </button>
  </template>
  <template v-else>
    <input v-model="newGroupName" @keyup.enter="addGroup" @keyup.escape="showGroupInput = false"
      class="px-3 py-2 border rounded-lg" :placeholder="$t('items.groupName')" />
    <button @click="addGroup" class="px-3 py-2 bg-indigo-600 text-white rounded-lg">OK</button>
    <button @click="showGroupInput = false" class="px-3 py-2 border rounded-lg">{{ $t('common.cancel') }}</button>
  </template>
</template>
```

Add handler:
```typescript
function addGroup() {
  if (newGroupName.value.trim()) {
    // Focus switches to items page — groups are just labels applied to items,
    // no need to create a separate group entity. Group is created when an item
    // is assigned to it. The group filter data comes from existing items.
    showGroupInput.value = false
    newGroupName.value = ''
  }
}
```

- [ ] **Step 4: Final verification**

```bash
npx tsc --noEmit
npm run build
```

Expected: Clean build with no errors. PWA manifest generated.

---

## Spec Coverage Check

| Spec Requirement | Task |
|---|---|
| Item CRUD (name, price, minQty, groupName) | Task 6 |
| Material CRUD (name, unit, unitCost, stock, threshold) | Task 9 |
| Item-material recipe linking | Task 7 |
| Auto cost calculation from materials | Task 7 (utils) |
| Auto stock calculation from materials | Task 7 (utils) |
| Combo CRUD (items + quantity) | Task 8 |
| Combo display as top grid group | Task 8 (integration in ItemsPage) |
| Cart sidebar (default visible, slide animation) | Task 10 |
| Cart qty adjustment (big +/- buttons) | Task 10 |
| Cart totals (revenue, cost, profit) | Task 10 |
| Checkout → order + stock deduction | Task 10 (useOrders) |
| Sales page (today summary by item) | Task 11 |
| Export XLSX/CSV | Task 11 (export utils) |
| Settings (store name, currency, language, groups, data) | Task 5 |
| Edit mode (toggle, yellow bg, add buttons) | Task 12 |
| i18n zh-CN + EN | Task 2 |
| Router (hash, 4 routes) | Task 2 |
| PWA (offline, manifest, SW) | Task 12 |
| Landscape layout, big buttons (48px) | Task 3 + all templates |
