<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSettings } from '../composables/useSettings'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const { settings, saveSetting, getAllGroups, deleteGroup, clearAllData } = useSettings()
const groups = ref<string[]>([])
const showClearConfirm = ref(false)
const showDeleteGroupConfirm = ref<string | null>(null)
const saved = ref(false)

onMounted(async () => {
  groups.value = await getAllGroups()
})

async function save(key: string, value: any) {
  await saveSetting(key, value)
  saved.value = true
  setTimeout(() => { saved.value = false }, 2000)
}

async function handleDeleteGroup(name: string) {
  await deleteGroup(name)
  groups.value = await getAllGroups()
  showDeleteGroupConfirm.value = null
}

async function handleClearAll() {
  await clearAllData()
  groups.value = []
  showClearConfirm.value = false
}
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-8 p-4">
    <!-- Saved indicator -->
    <div
      v-if="saved"
      class="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50"
    >
      {{ $t('settings.saved') }}
    </div>

    <!-- Store Name -->
    <section class="bg-white rounded-xl p-6 shadow-sm">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        {{ $t('settings.storeName') }}
      </label>
      <input
        :value="settings.storeName"
        @change="save('storeName', ($event.target as HTMLInputElement).value)"
        class="input"
        placeholder="My Store"
      />
    </section>

    <!-- Currency -->
    <section class="bg-white rounded-xl p-6 shadow-sm">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        {{ $t('settings.currencySymbol') }}
      </label>
      <select
        :value="settings.currencySymbol"
        @change="save('currencySymbol', ($event.target as HTMLSelectElement).value)"
        class="input"
      >
        <option value="RM">RM (MYR)</option>
        <option value="$">$ (SGD)</option>
        <option value="¥">¥ (CNY)</option>
        <option value="$">$ (USD)</option>
        <option value="NT$">NT$ (TWD)</option>
        <option value="€">€ (EUR)</option>
        <option value="">None</option>
      </select>
    </section>

    <!-- Language -->
    <section class="bg-white rounded-xl p-6 shadow-sm">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        {{ $t('settings.language') }}
      </label>
      <select
        :value="settings.locale"
        @change="save('locale', ($event.target as HTMLSelectElement).value)"
        class="input"
      >
        <option value="zh-CN">中文</option>
        <option value="en">English</option>
      </select>
    </section>

    <!-- Group Manager -->
    <section class="bg-white rounded-xl p-6 shadow-sm">
      <h3 class="font-bold text-lg mb-4">{{ $t('settings.groupManager') }}</h3>
      <div class="flex flex-wrap gap-2">
        <div
          v-for="g in groups"
          :key="g"
          class="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg"
        >
          <span>{{ g }}</span>
          <button
            @click="showDeleteGroupConfirm = g"
            class="text-red-500 hover:text-red-700 text-lg leading-none"
          >×</button>
        </div>
        <p v-if="groups.length === 0" class="text-gray-400 text-sm">
          {{ $t('common.no') }}
        </p>
      </div>
    </section>

    <!-- Data Manager -->
    <section class="bg-white rounded-xl p-6 shadow-sm">
      <h3 class="font-bold text-lg mb-4">{{ $t('settings.dataManager') }}</h3>
      <div class="flex gap-4">
        <button class="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-lg">
          {{ $t('settings.exportDb') }}
        </button>
        <button
          @click="showClearConfirm = true"
          class="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 text-lg"
        >
          {{ $t('settings.clearData') }}
        </button>
      </div>
    </section>

    <!-- Confirm Dialogs -->
    <ConfirmDialog
      v-if="showClearConfirm"
      :title="$t('common.confirm')"
      :message="$t('settings.confirmClear')"
      @confirm="handleClearAll"
      @cancel="showClearConfirm = false"
    />
    <ConfirmDialog
      v-if="showDeleteGroupConfirm"
      :title="$t('settings.deleteGroup')"
      :message="$t('settings.confirmDeleteGroup')"
      @confirm="handleDeleteGroup(showDeleteGroupConfirm!)"
      @cancel="showDeleteGroupConfirm = null"
    />
  </div>
</template>
