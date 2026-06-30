<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useOrders } from '../composables/useOrders'
import { useSettings } from '../composables/useSettings'
import { exportToXlsx, exportToCsv } from '../utils/export'

const { getTodaySales, getSalesByDateRange } = useOrders()
const { settings } = useSettings()

const orders = ref<any[]>([])
const orderItems = ref<any[]>([])
const dateRange = ref<'today' | 'custom'>('today')
const startDate = ref(new Date().toISOString().slice(0, 10))
const endDate = ref(new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().slice(0, 10))

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
  <div class="h-full overflow-y-auto p-3">
    <!-- Date Controls -->
    <div class="flex items-center gap-4 mb-6 flex-wrap">
      <div class="flex items-center gap-2">
        <label class="text-sm font-medium">{{ $t('sales.date') }}:</label>
        <input v-model="startDate" type="date" class="input" />
        <span>~</span>
        <input v-model="endDate" type="date" class="input" />
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
