<script setup lang="ts">
import { watch, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from './components/NavBar.vue'
import CartSidebar from './components/CartSidebar.vue'
import OrderBookSidebar from './components/OrderBookSidebar.vue'
import { useCart } from './composables/useCart'
import { useOrders } from './composables/useOrders'
import { useSettings } from './composables/useSettings'

const route = useRoute()
const { uiState, toggleCart, toggleOrderBook, closePanels, itemCount } = useCart()
const { getOrders } = useOrders()
const { settings, loadSettings } = useSettings()
const unpaidCount = ref(0)

const showPanels = () => route.name === 'pos'

async function updateUnpaidCount() {
  const orders = await getOrders()
  unpaidCount.value = orders.filter(o => !o.paid).length
}

onMounted(updateUnpaidCount)

watch(() => uiState.orderBookVisible, (visible) => {
  if (visible) updateUnpaidCount()
})

watch(() => settings.storeName, (name) => {
  document.title = name || 'LightweightPOS'
}, { immediate: true })
</script>

<template>
  <div class="h-screen w-screen flex flex-col overflow-hidden bg-gray-50">
    <NavBar />
    <div class="flex-1 flex overflow-hidden">
      <!-- 主内容区 -->
      <div class="flex-1 relative overflow-hidden">
        <main class="h-full overflow-y-auto bg-gray-100">
          <router-view />
        </main>

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
              v-if="itemCount > 0"
              class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1"
            >
              {{ itemCount > 99 ? '99+' : itemCount }}
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
            <span
              v-if="unpaidCount > 0"
              class="absolute -top-1 -right-1 bg-amber-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1"
            >
              {{ unpaidCount > 99 ? '99+' : unpaidCount }}
            </span>
          </button>
        </div>
      </div>

      <!-- 桌面端 (lg+): sidepanel 推挤主内容 -->
      <div v-if="showPanels()" class="hidden lg:flex">
        <div
          class="overflow-hidden transition-all duration-300 ease-in-out"
          :class="uiState.cartVisible ? 'max-w-[30vw]' : 'max-w-0'"
        >
          <CartSidebar v-if="uiState.cartVisible" class="w-[30vw] min-w-[30vw]" @close="closePanels" />
        </div>
        <div
          class="overflow-hidden transition-all duration-300 ease-in-out"
          :class="uiState.orderBookVisible ? 'max-w-[30vw]' : 'max-w-0'"
        >
          <OrderBookSidebar v-if="uiState.orderBookVisible" class="w-[30vw] min-w-[30vw]" @close="closePanels" />
        </div>
      </div>
    </div>

    <!-- 手机端 (<lg): sidepanel 固定定位覆盖 -->
    <div v-if="showPanels()" class="lg:hidden">
      <div
        v-if="uiState.cartVisible || uiState.orderBookVisible"
        class="fixed inset-0 z-20 bg-black/20"
        @click="closePanels"
      />
      <CartSidebar
        v-if="uiState.cartVisible"
        class="!fixed !right-0 !top-0 !h-full w-[30vw] z-30 shadow-xl"
        @close="closePanels"
      />
      <OrderBookSidebar
        v-if="uiState.orderBookVisible"
        class="!fixed !right-0 !top-0 !h-full w-[30vw] z-30 shadow-xl"
        @close="closePanels"
      />
    </div>
  </div>
</template>
