<script setup lang="ts">
defineProps<{
  title: string
  message: string
}>()
const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div class="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
      <h3 class="text-lg font-bold mb-2">{{ title }}</h3>
      <p class="text-gray-600 mb-6">{{ message }}</p>
      <div class="flex justify-end gap-3">
        <button
          @click="emit('cancel')"
          class="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          @click="emit('confirm')"
          class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
        >
          {{ $t('common.confirm') }}
        </button>
      </div>
    </div>
  </div>
</template>
