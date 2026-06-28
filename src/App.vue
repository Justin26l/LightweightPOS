<script setup lang="ts">
import NavBar from './components/NavBar.vue'
import CartSidebar from './components/CartSidebar.vue'
import { useCart } from './composables/useCart'
import { useSettings } from './composables/useSettings'

const { cart: cartState } = useCart()
const { loadSettings } = useSettings()
loadSettings()
</script>

<template>
  <div class="h-screen w-screen flex flex-col overflow-hidden bg-gray-50">
    <NavBar />
    <div class="flex-1 flex overflow-hidden">
      <main class="flex-1 overflow-y-auto p-4">
        <router-view />
      </main>
      <CartSidebar v-if="cartState.visible" />
    </div>
  </div>
</template>
