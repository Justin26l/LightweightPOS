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
const showClearConfirm = ref(false)
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
      <button @click="emit('close')" class="text-2xl leading-none text-gray-400 hover:text-gray-600">&times;</button>
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
              class="text-red-500 hover:text-red-700 text-lg leading-none">&times;</button>
          </div>
          <div class="flex items-center justify-between mt-2">
            <div class="flex items-center gap-2">
              <button @click="updateQty(idx, entry.qty - 1)"
                class="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 font-bold text-lg flex items-center justify-center">&minus;</button>
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
          <button @click="showClearConfirm = true"
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

    <!-- Clear Confirm Dialog -->
    <ConfirmDialog v-if="showClearConfirm" :title="$t('common.confirm')" :message="$t('cart.confirmClear')"
      @confirm="(clear(), showClearConfirm = false)" @cancel="showClearConfirm = false" />
  </aside>
</template>
