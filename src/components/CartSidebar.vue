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
