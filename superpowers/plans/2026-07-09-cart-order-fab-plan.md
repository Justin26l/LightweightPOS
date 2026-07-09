# 购物车增强 + 订单簿 + FAB 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 LightweightPOS 增加订单支付方式记录、每日订单号、已付/未付状态、改单功能，并将购物车开关改为双 FAB 按钮

**Architecture:** 基于现有 Vue 3 + TypeScript + Dexie.js 架构；新增 OrderBookSidebar 组件处理订单簿；修改 useCart composable 管理面板互斥状态；利用 Dexie 的 upgrade 机制为既有订单补充默认字段；支付方式列表存储在 settings 表中

**Tech Stack:** Vue 3 + TypeScript, Tailwind CSS, Dexie.js, vue-i18n

---

## 文件结构变更

### 新增文件
- `src/components/OrderBookSidebar.vue` — 订单簿侧边面板

### 修改文件
| 文件 | 变更说明 |
|------|---------|
| `src/types/index.ts` | Order 接口增加 orderNumber, paymentMethod, paid, paidAt |
| `src/db/index.ts` | DB 版本升至 2，增加 upgrade 函数为旧数据补充默认值 |
| `src/composables/useOrders.ts` | 新增 orderNumber 生成、checkout 写入 paymentMethod/paid |
| `src/composables/useCart.ts` | 新增 orderBookVisible、toggleCart/toggleOrderBook 互斥逻辑 |
| `src/composables/useSettings.ts` | 新增 paymentMethods 增删改方法 |
| `src/App.vue` | 添加 FAB 按钮和 OrderBookSidebar，面板互斥渲染 |
| `src/components/NavBar.vue` | 移除购物车显隐按钮 |
| `src/components/CartSidebar.vue` | 结账流程增加支付方式选择和已付/未付切换 |
| `src/views/SettingsPage.vue` | 新增支付方式管理区块 |
| `src/locales/zh-CN.ts` | 新增 i18n 文案 |
| `src/locales/en.ts` | 新增 i18n 文案 |

---

## 全局约束

- 所有数据本地 IndexedDB，无后端
- 横屏优先，最小 touch target 48px
- i18n：所有 UI 文本覆盖中英双语
- 订单号每天从 0 开始递增
- 已付订单不可修改，未付订单可改数量+增删品项
- 已付订单仍在订单簿显示（折叠/展开），有 ✅ 标签

---

### Task 1: 数据模型 + DB 升级 + Composables 变更

**文件:**
- Modify: `src/types/index.ts`
- Modify: `src/db/index.ts`
- Modify: `src/composables/useOrders.ts`
- Modify: `src/composables/useCart.ts`

**接口:**
- Consumes: 现有 `AppDatabase`, `db`, `CartEntry`
- Produces: 更新后的 `Order` 类型，升级后的 DB 实例，`getNextOrderNumber()`、`useCart()` 新增面板互斥方法

- [ ] **Step 1: 更新 Order 接口**

`src/types/index.ts` — 在 `Order` 接口中增加字段：

```typescript
export interface Order {
  id?: number
  orderNumber: number       // 当日序号（每天从0开始递增）
  paymentMethod: string     // 支付方式（从settings列表选取的快照）
  paid: boolean             // 是否已付款
  paidAt: Date | null       // 付款时间
  createdAt: Date
  totalAmount: number
  totalCost: number
  itemCount: number
}
```

- [ ] **Step 2: 升级 DB schema 至 v2**

`src/db/index.ts` — 在 constructor 中的 `super('LightweightPosDB')` 后，`this.version(1)` 之前或之后增加 v2：

```typescript
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
    this.version(2).stores({
      items: '++id, groupName',
      combos: '++id',
      comboItems: '++id, comboId, itemId',
      rawMaterials: '++id',
      itemMaterials: '++id, itemId, materialId',
      orders: '++id, createdAt',
      orderItems: '++id, orderId',
      settings: 'key',
    }).upgrade(async tx => {
      await tx.table('orders').toCollection().modify(order => {
        order.orderNumber = order.orderNumber ?? 0
        order.paymentMethod = order.paymentMethod ?? ''
        order.paid = order.paid ?? true  // 既有订单默认为已付
        order.paidAt = order.paidAt ?? order.createdAt ?? new Date()
      })
    })
  }
```

- [ ] **Step 3: 更新 useOrders — 添加 orderNumber 生成和 checkout 新字段**

`src/composables/useOrders.ts` — 添加 `getNextOrderNumber()` 方法，修改 `checkout()` 参数和写入逻辑：

```typescript
import { db } from '../db'
import type { CartEntry } from '../types'

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

  async function checkout(
    cartItems: CartEntry[],
    currencySymbol: string,
    paymentMethod: string,
    paid: boolean
  ) {
    // ... 现有库存验证逻辑不变 ...

    const orderNumber = await getNextOrderNumber()

    // Create order — 新增字段
    const orderId = await db.orders.add({
      createdAt: new Date(),
      totalAmount,
      totalCost,
      itemCount,
      orderNumber,
      paymentMethod,
      paid,
      paidAt: paid ? new Date() : null,
    })

    // ... 后续 orderItems 创建 + 库存扣减不变 ...

    return orderId
  }

  async function getOrders(): Promise<any[]> {
    return db.orders.orderBy('createdAt').reverse().toArray()
  }

  async function getOrderItems(orderId: number): Promise<any[]> {
    return db.orderItems.where('orderId').equals(orderId).toArray()
  }

  async function markOrderPaid(orderId: number) {
    await db.orders.update(orderId, { paid: true, paidAt: new Date() })
  }

  async function updateOrderItems(orderId: number, items: { type: 'item' | 'combo'; refId: number; name: string; qty: number; unitPrice: number; unitCost: number }[]) {
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
  }

  async function getTodaySales() { /* 不变 */ }
  async function getSalesByDateRange(start: Date, end: Date) { /* 不变 */ }

  return {
    getNextOrderNumber,
    checkout,
    getOrders,
    getOrderItems,
    markOrderPaid,
    updateOrderItems,
    getTodaySales,
    getSalesByDateRange,
  }
}
```

注意：完整的 `checkout()` 函数需要保留原有的库存验证和扣减逻辑。仅在 `db.orders.add()` 调用中增加 `orderNumber`, `paymentMethod`, `paid`, `paidAt` 四个字段，以及新增上述几个方法。

- [ ] **Step 4: 更新 useCart — 添加面板互斥状态**

`src/composables/useCart.ts` — 添加 `orderBookVisible` 和互斥方法：

```typescript
import { reactive, computed } from 'vue'
import type { CartEntry } from '../types'

const state = reactive({
  items: [] as CartEntry[],
})

const uiState = reactive({
  cartVisible: false,
  orderBookVisible: false,
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
    uiState.cartVisible = true  // 改为 new uiState
  }
  function updateQty(index: number, qty: number) { /* 不变 */ }
  function removeEntry(index: number) { /* 不变 */ }
  function clear() { /* 不变 */ }
  function show() { uiState.cartVisible = true }

  // 互斥切换
  function toggleCart() {
    uiState.cartVisible = !uiState.cartVisible
    if (uiState.cartVisible) uiState.orderBookVisible = false
  }

  function toggleOrderBook() {
    uiState.orderBookVisible = !uiState.orderBookVisible
    if (uiState.orderBookVisible) uiState.cartVisible = false
  }

  function closePanels() {
    uiState.cartVisible = false
    uiState.orderBookVisible = false
  }

  const totalAmount = computed(() => /* 不变 */)
  const totalCost = computed(() => /* 不变 */)
  const profit = computed(() => /* 不变 */)
  const itemCount = computed(() => /* 不变 */)

  return {
    cart: state,
    uiState,  // 新增
    addItem,
    updateQty,
    removeEntry,
    clear,
    show,
    toggleCart,     // 新增
    toggleOrderBook, // 新增
    closePanels,    // 新增
    totalAmount,
    totalCost,
    profit,
    itemCount,
  }
}
```

- [ ] **Step 5: 提交 Task 1**

```bash
git add src/types/index.ts src/db/index.ts src/composables/useOrders.ts src/composables/useCart.ts
git commit -m "feat: add orderNumber/paymentMethod/paid fields + DB v2 upgrade + panel mutual exclusion

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: i18n + useSettings 支付方式管理

**文件:**
- Modify: `src/locales/zh-CN.ts`
- Modify: `src/locales/en.ts`
- Modify: `src/composables/useSettings.ts`

**接口:**
- Consumes: `db.settings`
- Produces: `paymentMethods` 的读写方法、中英文 i18n key

- [ ] **Step 1: 新增中文 i18n 文案**

`src/locales/zh-CN.ts` — 在对应区块中新增：

在 `cart:` 区块追加：
```typescript
cart: {
  // ... 现有 keys ...
  paymentMethod: '支付方式',
  payStatus: '付款状态',
  paid: '已付',
  unpaid: '未付',
  checkoutConfirm: '确认结账',
  backToCart: '返回',
},
```

在 `cart:` 之后新增 `orderBook:` 区块：
```typescript
orderBook: {
  title: '订单簿',
  empty: '暂无订单',
  modify: '改单',
  markPaid: '标记已付',
  addItem: '添加品项',
  saveChanges: '保存修改',
  cancelEdit: '取消修改',
  orderNumber: '订单号',
  items: '品项',
  total: '总计',
},
```

在 `settings:` 区块追加：
```typescript
settings: {
  // ... 现有 keys ...
  paymentMethods: '支付方式管理',
  addPaymentMethod: '添加支付方式',
  deletePaymentMethod: '删除此支付方式？',
},
```

在 `common:` 区块（若需要）保持不新增。

新增 `fab:` 区块：
```typescript
fab: {
  cart: '购物车',
  orders: '订单簿',
},
```

- [ ] **Step 2: 新增英文 i18n 文案**

`src/locales/en.ts` — 对应位置新增：

```typescript
cart: {
  // ... existing keys ...
  paymentMethod: 'Payment Method',
  payStatus: 'Payment Status',
  paid: 'Paid',
  unpaid: 'Unpaid',
  checkoutConfirm: 'Confirm Checkout',
  backToCart: 'Back',
},

orderBook: {
  title: 'Orders',
  empty: 'No orders yet',
  modify: 'Modify',
  markPaid: 'Mark Paid',
  addItem: 'Add Item',
  saveChanges: 'Save Changes',
  cancelEdit: 'Cancel Edit',
  orderNumber: 'Order',
  items: 'Items',
  total: 'Total',
},

settings: {
  // ... existing keys ...
  paymentMethods: 'Payment Methods',
  addPaymentMethod: 'Add Method',
  deletePaymentMethod: 'Delete this method?',
},

fab: {
  cart: 'Cart',
  orders: 'Orders',
},
```

- [ ] **Step 3: 更新 useSettings — 支付方式 CRUD**

`src/composables/useSettings.ts` — 在 `return` 中新增方法：

```typescript
const DEFAULT_PAYMENT_METHODS = ['现金', '微信扫码', '支付宝', '银行卡']

export function useSettings() {
  // ... 现有方法 ...

  async function getPaymentMethods(): Promise<string[]> {
    const val = await db.settings.get('paymentMethods')
    return val?.value ?? DEFAULT_PAYMENT_METHODS
  }

  async function addPaymentMethod(name: string) {
    const methods = await getPaymentMethods()
    if (!methods.includes(name)) {
      methods.push(name)
      await db.settings.put({ key: 'paymentMethods', value: methods })
    }
  }

  async function deletePaymentMethod(name: string) {
    const methods = await getPaymentMethods()
    const idx = methods.indexOf(name)
    if (idx !== -1) {
      methods.splice(idx, 1)
      await db.settings.put({ key: 'paymentMethods', value: methods })
    }
  }

  return {
    settings: state,
    loadSettings,
    saveSetting,
    getAllGroups,
    deleteGroup,
    clearAllData,
    getPaymentMethods,    // 新增
    addPaymentMethod,     // 新增
    deletePaymentMethod,  // 新增
  }
}
```

- [ ] **Step 4: 提交 Task 2**

```bash
git add src/locales/zh-CN.ts src/locales/en.ts src/composables/useSettings.ts
git commit -m "feat: add i18n keys for order/fab + paymentMethods settings CRUD

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: App.vue 布局重构 + FAB 按钮 + NavBar 清理

**文件:**
- Rewrite: `src/App.vue`
- Modify: `src/components/NavBar.vue`

**接口:**
- Consumes: `useCart()` 的 `uiState` / `toggleCart` / `toggleOrderBook` / `itemCount`
- Produces: FAB 按钮、面板互斥渲染、关闭按钮

- [ ] **Step 1: 重写 App.vue**

`src/App.vue` — 整体替换：

```vue
<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from './components/NavBar.vue'
import CartSidebar from './components/CartSidebar.vue'
import OrderBookSidebar from './components/OrderBookSidebar.vue'
import { useCart } from './composables/useCart'
import { useSettings } from './composables/useSettings'

const route = useRoute()
const { uiState, toggleCart, toggleOrderBook, closePanels, itemCount } = useCart()
const { settings, loadSettings } = useSettings()
loadSettings()

watch(() => settings.storeName, (name) => {
  document.title = name || 'LightweightPOS'
}, { immediate: true })
</script>

<template>
  <div class="h-screen w-screen flex flex-col overflow-hidden bg-gray-50">
    <NavBar />
    <div class="flex-1 flex overflow-hidden relative">
      <main class="flex-1 overflow-y-auto bg-gray-100">
        <router-view />
      </main>

      <!-- 侧边面板层 - 渲染在 main 之上 -->
      <Transition name="panel-slide">
        <CartSidebar v-if="uiState.cartVisible" @close="closePanels" />
      </Transition>
      <Transition name="panel-slide">
        <OrderBookSidebar v-if="uiState.orderBookVisible" @close="closePanels" />
      </Transition>

      <!-- 面板背景遮罩 -->
      <Transition name="fade">
        <div
          v-if="uiState.cartVisible || uiState.orderBookVisible"
          class="absolute inset-0 bg-black/10 z-10"
          @click="closePanels"
        />
      </Transition>

      <!-- FAB 按钮 -->
      <div class="absolute bottom-6 right-6 z-20 flex flex-col gap-3 items-center">
        <button
          @click="toggleCart()"
          class="w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center text-2xl relative"
          :title="$t('fab.cart')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-7 h-7">
            <path d="M2.25 2.25a.75.75 0 000 1.5h1.386c.17 0 .318.114.362.278l2.558 9.592a3.752 3.752 0 00-2.806 3.63c0 .414.336.75.75.75h15.75a.75.75 0 000-1.5H5.378A2.25 2.25 0 017.5 15h11.218a.75.75 0 00.674-.421 60.358 60.358 0 002.96-7.228.75.75 0 00-.525-.965A60.864 60.864 0 005.68 4.509l-.232-.867A1.875 1.875 0 003.636 2.25H2.25zM3.75 20.25a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM16.5 20.25a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" />
          </svg>
          <span
            v-if="itemCount.value > 0"
            class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1"
          >
            {{ itemCount.value > 99 ? '99+' : itemCount.value }}
          </span>
        </button>
        <button
          @click="toggleOrderBook()"
          class="w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center text-2xl relative"
          :title="$t('fab.orders')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-7 h-7">
            <path d="M5.625 3.75a2.625 2.625 0 100 5.25h12.75a2.625 2.625 0 000-5.25H5.625zM3.75 11.25a.75.75 0 000 1.5h16.5a.75.75 0 000-1.5H3.75zM3.75 15.75a.75.75 0 000 1.5h16.5a.75.75 0 000-1.5H3.75zM3.75 20.25a.75.75 0 000 1.5h16.5a.75.75 0 000-1.5H3.75z" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: transform 0.3s ease;
}
.panel-slide-enter-from {
  transform: translateX(100%);
}
.panel-slide-leave-to {
  transform: translateX(100%);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

- [ ] **Step 2: 更新 NavBar — 移除购物车显隐按钮**

`src/components/NavBar.vue` — 移除代码中的购物车 toggle 部分：

移除 `<script>` 中的 `toggle` 导入：
```typescript
// 移除:
import { useCart } from '../composables/useCart'
// 以及:
const { cart: cartState, toggle } = useCart()
```

移除 `<template>` 中的购物车按钮区块：
```html
<!-- 移除整个: -->
<button
  @click="toggle()"
  class="ml-2 px-3 py-1 rounded hover:bg-white/20 transition-colors text-xl"
  :title="$t(cartState.visible ? 'cart.hide' : 'cart.show')"
>
  {{ cartState.visible ? '◀' : '▶' }}
</button>
```

最终 NavBar.vue 的 `<script>` 部分变为：
```typescript
import { useRoute, useRouter } from 'vue-router'
import { useSettings } from '../composables/useSettings'

const route = useRoute()
const router = useRouter()
const { settings } = useSettings()
// ... tabs 和 navigate 不变
```

- [ ] **Step 3: 提交 Task 3**

```bash
git add src/App.vue src/components/NavBar.vue
git commit -m "feat: add FAB buttons + OrderBookSidebar + panel mutual exclusion

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: CartSidebar 增强 — 结账确认面板

**文件:**
- Rewrite: `src/components/CartSidebar.vue`

**接口:**
- Consumes: `useCart()`, `useOrders()`, `useSettings()`, `emit('close')`
- Produces: 购物车面板含结账确认步骤

- [ ] **Step 1: 重写 CartSidebar.vue**

`src/components/CartSidebar.vue` — 完整实现：

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useCart } from '../composables/useCart'
import { useOrders } from '../composables/useOrders'
import { useSettings } from '../composables/useSettings'
import ConfirmDialog from './ConfirmDialog.vue'

const emit = defineEmits<{ close: [] }>()
const { cart: cartState, addItem, updateQty, removeEntry, clear, totalAmount, totalCost, profit, itemCount } = useCart()
const { checkout } = useOrders()
const { settings, getPaymentMethods } = useSettings()

// 结账确认步骤
const showCheckoutForm = ref(false)
const checkoutPaymentMethod = ref('')
const checkoutPaid = ref(false)
const paymentMethods = ref<string[]>([])
const checkoutError = ref('')
const checkingOut = ref(false)

onMounted(async () => {
  paymentMethods.value = await getPaymentMethods()
})

function openCheckout() {
  checkoutPaymentMethod.value = paymentMethods.value[0] || ''
  checkoutPaid.value = false
  checkoutError.value = ''
  showCheckoutForm.value = true
}

async function handleCheckout() {
  checkingOut.value = true
  checkoutError.value = ''
  try {
    await checkout(cartState.items, settings.currencySymbol, checkoutPaymentMethod.value, checkoutPaid.value)
    clear()
    showCheckoutForm.value = false
    emit('close')
  } catch (e: any) {
    checkoutError.value = e.message
  } finally {
    checkingOut.value = false
  }
}
</script>

<template>
  <aside class="absolute right-0 top-0 h-full w-[30vw] bg-white border-l border-gray-400 flex flex-col overflow-hidden z-20 shadow-xl">
    <!-- Header -->
    <div class="px-4 py-2 font-bold text-lg border-b border-gray-400 flex items-center justify-between shrink-0">
      <span>
        {{ $t('cart.title') }}
        <span v-if="cartState.items.length" class="text-sm font-normal text-gray-500">
          ({{ itemCount.value }})
        </span>
      </span>
      <button @click="emit('close')" class="text-2xl leading-none text-gray-400 hover:text-gray-600">×</button>
    </div>

    <!-- 购物车列表（非结账状态） -->
    <template v-if="!showCheckoutForm">
      <div class="flex-1 overflow-y-auto px-4">
        <p v-if="cartState.items.length === 0" class="text-gray-400 text-center mt-8">
          {{ $t('cart.empty') }}
        </p>
        <div v-for="(entry, idx) in cartState.items" :key="`${entry.type}-${entry.refId}`"
          class="py-2.5 border-b border-gray-300">
          <div class="flex items-center justify-between">
            <span class="font-semibold">{{ entry.name }}</span>
            <button @click="removeEntry(idx)"
              class="text-red-500 hover:text-red-700 text-lg leading-none">×</button>
          </div>
          <div class="flex items-center justify-between mt-2">
            <div class="flex items-center gap-2">
              <button @click="updateQty(idx, entry.qty - 1)"
                class="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 font-bold text-lg flex items-center justify-center">−</button>
              <span class="w-8 text-center font-bold text-lg">{{ entry.qty }}</span>
              <button @click="updateQty(idx, entry.qty + 1)"
                class="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 font-bold text-lg flex items-center justify-center">+</button>
            </div>
            <span class="font-bold">{{ settings.currencySymbol }}{{ (entry.price * entry.qty).toFixed(2) }}</span>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="border-t border-gray-400 p-4 space-y-3">
        <div class="space-y-1 text-sm">
          <div class="flex justify-between">
            <span>{{ $t('cart.profit') }}:</span>
            <span :class="profit.value >= 0 ? 'text-green-600' : 'text-red-600'">
              {{ settings.currencySymbol }}{{ profit.value.toFixed(2) }}
            </span>
          </div>
          <div class="flex justify-between font-bold text-lg pt-1 border-t border-gray-400">
            <span>{{ $t('cart.total') }}:</span>
            <span>{{ settings.currencySymbol }}{{ totalAmount.value.toFixed(2) }}</span>
          </div>
        </div>
        <div class="flex gap-2">
          <button @click="clear()"
            class="flex-1 px-4 py-3 bg-red-800 text-white rounded-lg hover:bg-red-700 text-lg font-medium"
            :disabled="cartState.items.length === 0">
            {{ $t('cart.clear') }}
          </button>
          <button @click="openCheckout()"
            class="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-lg font-bold"
            :disabled="cartState.items.length === 0">
            {{ $t('cart.checkout') }}
          </button>
        </div>
      </div>
    </template>

    <!-- 结账确认表单 -->
    <template v-else>
      <div class="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">{{ $t('cart.paymentMethod') }}</label>
          <select v-model="checkoutPaymentMethod" class="w-full px-4 py-3 border rounded-lg text-lg bg-white">
            <option v-for="m in paymentMethods" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">{{ $t('cart.payStatus') }}</label>
          <div class="flex gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="checkoutPaid" :value="false" class="w-5 h-5" />
              <span class="text-lg">{{ $t('cart.unpaid') }}</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="checkoutPaid" :value="true" class="w-5 h-5" />
              <span class="text-lg">{{ $t('cart.paid') }}</span>
            </label>
          </div>
        </div>

        <div class="border-t pt-4">
          <div class="flex justify-between font-bold text-lg">
            <span>{{ $t('cart.total') }}:</span>
            <span>{{ settings.currencySymbol }}{{ totalAmount.value.toFixed(2) }}</span>
          </div>
        </div>

        <p v-if="checkoutError" class="text-red-600 text-sm text-center">{{ checkoutError }}</p>
      </div>

      <!-- Footer -->
      <div class="border-t p-4 space-y-2">
        <div class="flex gap-2">
          <button @click="showCheckoutForm = false"
            class="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-100 text-lg">
            {{ $t('cart.backToCart') }}
          </button>
          <button @click="handleCheckout"
            class="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-lg font-bold"
            :disabled="checkingOut">
            {{ checkingOut ? '...' : $t('cart.checkoutConfirm') }}
          </button>
        </div>
        <p v-if="checkoutError" class="text-red-600 text-sm text-center">{{ checkoutError }}</p>
      </div>
    </template>
  </aside>
</template>
```

- [ ] **Step 2: 提交 Task 4**

```bash
git add src/components/CartSidebar.vue
git commit -m "feat: add checkout confirmation panel with payment method + paid toggle

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: OrderBookSidebar 订单簿

**文件:**
- Create: `src/components/OrderBookSidebar.vue`

**接口:**
- Consumes: `useOrders()`, `useSettings()`, `useCart()`, `db.items`, `db.combos`
- Produces: 订单簿面板（折叠展开、改单、标记已付）

- [ ] **Step 1: 创建 OrderBookSidebar.vue**

`src/components/OrderBookSidebar.vue`：

```vue
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useOrders } from '../composables/useOrders'
import { useSettings } from '../composables/useSettings'
import { useCart } from '../composables/useCart'
import { db } from '../db'
import ConfirmDialog from './ConfirmDialog.vue'

const emit = defineEmits<{ close: [] }>()
const { getOrders, getOrderItems, markOrderPaid, updateOrderItems } = useOrders()
const { settings } = useSettings()
const { addItem } = useCart()

const orders = ref<any[]>([])
const orderItemsMap = ref<Record<number, any[]>>({})
const expandedOrders = ref<Record<number, boolean>>({})
const editingOrderId = ref<number | null>(null)
const editItems = ref<any[]>([])  // 编辑中的订单品项
const availableItems = ref<any[]>([])
const availableCombos = ref<any[]>([])
const showMarkPaidConfirm = ref<number | null>(null)

onMounted(loadData)

async function loadData() {
  orders.value = await getOrders()
  // 加载所有订单的品项
  for (const order of orders.value) {
    if (!orderItemsMap.value[order.id!]) {
      orderItemsMap.value[order.id!] = await getOrderItems(order.id!)
    }
  }
  // 加载所有品项和套餐供改单时添加
  availableItems.value = await db.items.toArray()
  availableCombos.value = await db.combos.toArray()
}

function toggleExpand(orderId: number) {
  expandedOrders.value[orderId] = !expandedOrders.value[orderId]
}

function startEdit(order: any) {
  editingOrderId.value = order.id!
  editItems.value = orderItemsMap.value[order.id!].map((oi: any) => ({
    ...oi,
    _key: `${oi.type}-${oi.refId}-${Date.now()}-${Math.random()}`
  }))
}

function cancelEdit() {
  editingOrderId.value = null
  editItems.value = []
}

function editQty(idx: number, delta: number) {
  const newQty = editItems.value[idx].qty + delta
  if (newQty <= 0) {
    editItems.value.splice(idx, 1)
  } else {
    editItems.value[idx].qty = newQty
  }
}

function removeEditItem(idx: number) {
  editItems.value.splice(idx, 1)
}

function addEditItem(type: 'item' | 'combo', refId: number) {
  // 检查是否已存在
  const existing = editItems.value.find(
    (e: any) => e.type === type && e.refId === refId
  )
  if (existing) {
    existing.qty += 1
    return
  }

  if (type === 'item') {
    const item = availableItems.value.find(i => i.id === refId)
    if (item) {
      editItems.value.push({
        orderId: editingOrderId.value,
        type: 'item',
        refId: item.id,
        name: item.name,
        qty: 1,
        unitPrice: item.price,
        unitCost: 0,  // 简化处理
        _key: `item-${item.id}-${Date.now()}`
      })
    }
  } else if (type === 'combo') {
    const combo = availableCombos.value.find(c => c.id === refId)
    if (combo) {
      editItems.value.push({
        orderId: editingOrderId.value,
        type: 'combo',
        refId: combo.id,
        name: combo.name,
        qty: 1,
        unitPrice: combo.price,
        unitCost: 0,
        _key: `combo-${combo.id}-${Date.now()}`
      })
    }
  }
}

const editTotal = computed(() =>
  editItems.value.reduce((sum: number, e: any) => sum + e.unitPrice * e.qty, 0)
)

async function saveEdit() {
  const orderId = editingOrderId.value!
  const items = editItems.value.map((e: any) => ({
    type: e.type,
    refId: e.refId,
    name: e.name,
    qty: e.qty,
    unitPrice: e.unitPrice,
    unitCost: e.unitCost,
  }))
  await updateOrderItems(orderId, items)
  // 重新加载数据
  editingOrderId.value = null
  editItems.value = []
  orderItemsMap.value[orderId] = await getOrderItems(orderId)
  orders.value = await getOrders()
}

async function handleMarkPaid(orderId: number) {
  await markOrderPaid(orderId)
  showMarkPaidConfirm.value = null
  orders.value = await getOrders()
  // 更新该订单在展开映射中的状态
}

function getAddableItems() {
  const result: { label: string; value: string }[] = []
  for (const item of availableItems.value) {
    result.push({ label: `${item.name} (品项)`, value: `item-${item.id}` })
  }
  for (const combo of availableCombos.value) {
    result.push({ label: `${combo.name} (套餐)`, value: `combo-${combo.id}` })
  }
  return result
}

function handleAddSelect(event: Event) {
  const val = (event.target as HTMLSelectElement).value
  if (!val) return
  const [type, idStr] = val.split('-')
  addEditItem(type as 'item' | 'combo', Number(idStr))
  ;(event.target as HTMLSelectElement).value = ''
}
</script>

<template>
  <aside class="absolute right-0 top-0 h-full w-[30vw] bg-white border-l border-gray-400 flex flex-col overflow-hidden z-20 shadow-xl">
    <!-- Header -->
    <div class="px-4 py-2 font-bold text-lg border-b border-gray-400 flex items-center justify-between shrink-0">
      <span>{{ $t('orderBook.title') }} ({{ orders.length }})</span>
      <button @click="emit('close')" class="text-2xl leading-none text-gray-400 hover:text-gray-600">×</button>
    </div>

    <!-- 订单列表 -->
    <div class="flex-1 overflow-y-auto">
      <p v-if="orders.length === 0" class="text-gray-400 text-center mt-8">
        {{ $t('orderBook.empty') }}
      </p>

      <div v-for="order in orders" :key="order.id" class="border-b border-gray-200">
        <!-- 订单头部（可折叠） -->
        <div
          @click="toggleExpand(order.id!)"
          class="px-4 py-3 flex items-center gap-2 cursor-pointer hover:bg-gray-50"
        >
          <span class="text-sm text-gray-400 w-4">
            {{ expandedOrders[order.id!] ? '▼' : '▶' }}
          </span>
          <span class="font-bold">#{{ order.orderNumber }}</span>
          <span
            class="text-xs px-2 py-0.5 rounded-full font-medium"
            :class="order.paid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'"
          >
            {{ order.paid ? $t('orderBook.paidAt') : $t('orderBook.unpaid') }}
          </span>
          <span v-if="order.paymentMethod" class="text-sm text-gray-500">{{ order.paymentMethod }}</span>
          <span class="ml-auto font-bold">{{ settings.currencySymbol }}{{ order.totalAmount.toFixed(2) }}</span>
        </div>

        <!-- 订单展开详情 -->
        <div v-if="expandedOrders[order.id!]" class="px-4 pb-3">
          <template v-if="editingOrderId !== order.id">
            <!-- 只读模式 -->
            <div
              v-for="oi in (orderItemsMap[order.id!] || [])"
              :key="oi.id"
              class="flex justify-between py-1 text-sm"
            >
              <span>{{ oi.name }} × {{ oi.qty }}</span>
              <span class="font-medium">{{ settings.currencySymbol }}{{ (oi.unitPrice * oi.qty).toFixed(2) }}</span>
            </div>
            <!-- 操作按钮（仅未付订单） -->
            <div v-if="!order.paid" class="flex gap-2 mt-3 pt-3 border-t">
              <button
                @click.stop="startEdit(order)"
                class="flex-1 px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 text-sm font-medium"
              >
                {{ $t('orderBook.modify') }}
              </button>
              <button
                @click.stop="showMarkPaidConfirm = order.id!"
                class="flex-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm font-medium"
              >
                {{ $t('orderBook.markPaid') }}
              </button>
            </div>
          </template>

          <!-- 编辑模式 -->
          <template v-else>
            <div
              v-for="(ei, idx) in editItems"
              :key="ei._key"
              class="flex items-center gap-2 py-1.5"
            >
              <span class="flex-1 text-sm">{{ ei.name }}</span>
              <div class="flex items-center gap-1">
                <button @click="editQty(idx, -1)"
                  class="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 font-bold text-sm flex items-center justify-center">−</button>
                <span class="w-6 text-center font-bold text-sm">{{ ei.qty }}</span>
                <button @click="editQty(idx, 1)"
                  class="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 font-bold text-sm flex items-center justify-center">+</button>
              </div>
              <span class="text-sm font-medium w-16 text-right">{{ settings.currencySymbol }}{{ (ei.unitPrice * ei.qty).toFixed(2) }}</span>
              <button @click="removeEditItem(idx)"
                class="text-red-500 hover:text-red-700 text-sm leading-none ml-1">×</button>
            </div>

            <!-- 添加品项 -->
            <div class="mt-2">
              <select @change="handleAddSelect" class="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                <option value="">{{ $t('orderBook.addItem') }}...</option>
                <option v-for="opt in getAddableItems()" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <!-- 编辑总计 -->
            <div class="flex justify-between font-bold mt-3 pt-3 border-t">
              <span>{{ $t('orderBook.total') }}:</span>
              <span>{{ settings.currencySymbol }}{{ editTotal.toFixed(2) }}</span>
            </div>

            <!-- 编辑操作按钮 -->
            <div class="flex gap-2 mt-3">
              <button @click="cancelEdit"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-sm">
                {{ $t('orderBook.cancelEdit') }}
              </button>
              <button @click="saveEdit"
                class="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-bold">
                {{ $t('orderBook.saveChanges') }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 标记已付确认 -->
    <ConfirmDialog
      v-if="showMarkPaidConfirm"
      :title="$t('common.confirm')"
      :message="$t('orderBook.markPaid')"
      @confirm="handleMarkPaid(showMarkPaidConfirm!)"
      @cancel="showMarkPaidConfirm = null"
    />
  </aside>
</template>
```

- [ ] **Step 2: 提交 Task 5**

```bash
git add src/components/OrderBookSidebar.vue
git commit -m "feat: add OrderBookSidebar with foldable orders, modify, mark paid

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: 设置页 — 支付方式管理

**文件:**
- Modify: `src/views/SettingsPage.vue`

**接口:**
- Consumes: `useSettings()` 的 `getPaymentMethods`, `addPaymentMethod`, `deletePaymentMethod`
- Produces: 支付方式管理 UI

- [ ] **Step 1: 更新 SettingsPage.vue**

`src/views/SettingsPage.vue` — 在 `<script>` 中新增导入和方法：

在 `const showDeleteGroupConfirm` 定义之后新增：
```typescript
const paymentMethods = ref<string[]>([])
const newPaymentMethod = ref('')
const showDeletePaymentConfirm = ref<string | null>(null)
```

在 `onMounted` 或已有 `onMounted` 的 `loadSales` 之后（或在 Vue 的 `onMounted` 中）加载支付方式：
```typescript
onMounted(async () => {
  groups.value = await getAllGroups()
  paymentMethods.value = await getPaymentMethods()
})
```

新增方法：
```typescript
async function handleAddPaymentMethod() {
  const name = newPaymentMethod.value.trim()
  if (!name) return
  await addPaymentMethod(name)
  paymentMethods.value = await getPaymentMethods()
  newPaymentMethod.value = ''
}

async function handleDeletePaymentMethod(name: string) {
  await deletePaymentMethod(name)
  paymentMethods.value = await getPaymentMethods()
  showDeletePaymentConfirm.value = null
}
```

在 `<template>` 中新增支付方式管理区块（放在 Group Manager 之后、Data Manager 之前）：

```vue
<!-- Payment Methods -->
<section class="bg-white rounded-xl p-6 shadow-sm">
  <h3 class="font-bold text-lg mb-4">{{ $t('settings.paymentMethods') }}</h3>
  <div class="flex flex-wrap gap-2 mb-3">
    <div
      v-for="m in paymentMethods"
      :key="m"
      class="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg"
    >
      <span>{{ m }}</span>
      <button
        @click="showDeletePaymentConfirm = m"
        class="text-red-500 hover:text-red-700 text-lg leading-none"
      >×</button>
    </div>
    <p v-if="paymentMethods.length === 0" class="text-gray-400 text-sm">
      {{ $t('common.no') }}
    </p>
  </div>
  <div class="flex gap-2">
    <input
      v-model="newPaymentMethod"
      @keyup.enter="handleAddPaymentMethod"
      class="flex-1 px-4 py-2 border rounded-lg text-lg"
      :placeholder="$t('settings.addPaymentMethod')"
    />
    <button
      @click="handleAddPaymentMethod"
      class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-lg"
    >
      + {{ $t('common.add') }}
    </button>
  </div>
</section>
```

新增确认弹窗（在文件末尾的 ConfirmDialog 区块中追加）：
```vue
<ConfirmDialog
  v-if="showDeletePaymentConfirm"
  :title="$t('common.confirm')"
  :message="$t('settings.deletePaymentMethod')"
  @confirm="handleDeletePaymentMethod(showDeletePaymentConfirm!)"
  @cancel="showDeletePaymentConfirm = null"
/>
```

- [ ] **Step 2: 提交 Task 6**

```bash
git add src/views/SettingsPage.vue
git commit -m "feat: add payment methods management in settings page

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 验证检查

实现完成后，运行以下命令验证：

```bash
npx tsc --noEmit
npm run dev
```

手动测试清单：
- [ ] FAB 按钮显示在右下角，点击 Cart FAB 打开购物车侧边面板
- [ ] 点击 Orders FAB 打开订单簿面板（关闭购物车）
- [ ] 点击遮罩或关闭按钮关闭面板
- [ ] 结账时显示支付方式下拉（从设置读取）和已付/未付切换
- [ ] 结账后订单出现在订单簿中
- [ ] 未付订单可改单（修改数量、增删品项）
- [ ] 改单保存后总计重新计算
- [ ] 标记已付后订单显示 ✅ 已付标签，操作按钮消失
- [ ] 设置页可增删支付方式
- [ ] 导航栏不再显示旧的购物车切换按钮
- [ ] 当日第一单订单号为 0，第二单为 1...
