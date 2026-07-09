<script setup lang="ts">
defineEmits<{ close: [] }>()
</script>
<template>
  <aside class="absolute right-0 top-0 h-full w-[30vw] bg-white border-l border-gray-400 flex flex-col overflow-hidden z-20 shadow-xl">
    <div class="px-4 py-2 font-bold text-lg border-b border-gray-400 flex items-center justify-between shrink-0">
      <span>{{ $t('orderBook.title') }}</span>
      <button @click="$emit('close')" class="text-2xl leading-none text-gray-400 hover:text-gray-600">×</button>
    </div>
  </aside>
</template>
