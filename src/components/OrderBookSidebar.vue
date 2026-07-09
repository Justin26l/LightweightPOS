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
