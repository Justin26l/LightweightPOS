import { reactive, computed } from 'vue'
import type { CartEntry } from '../types'

interface CartState {
  items: CartEntry[]
}

const state = reactive<CartState>({
  items: [],
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
    uiState.cartVisible = true
    uiState.orderBookVisible = false
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

  function show() {
    uiState.cartVisible = true
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
    uiState,
    addItem,
    updateQty,
    removeEntry,
    clear,
    toggleCart,
    toggleOrderBook,
    closePanels,
    show,
    totalAmount,
    totalCost,
    profit,
    itemCount,
  }
}
