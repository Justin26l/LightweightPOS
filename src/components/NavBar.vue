<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useCart } from '../composables/useCart'
import { useSettings } from '../composables/useSettings'

const route = useRoute()
const router = useRouter()
const { cart: cartState, toggle } = useCart()
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
      v-for="tab in tabs" :key="tab.path"
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
      @click="toggle()"
      class="ml-2 px-3 py-1 rounded hover:bg-white/20 transition-colors text-xl"
      :title="$t(cartState.visible ? 'cart.hide' : 'cart.show')"
    >
      {{ cartState.visible ? '◀' : '▶' }}
    </button>
  </header>
</template>
