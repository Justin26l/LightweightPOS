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
