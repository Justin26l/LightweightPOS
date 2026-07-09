<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSettings } from '../composables/useSettings'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { version } from '../../package.json'

const { settings, saveSetting, getAllGroups, deleteGroup, clearAllData, getPaymentMethods, addPaymentMethod, deletePaymentMethod } = useSettings()
const groups = ref<string[]>([])
const showClearConfirm = ref(false)
const showDeleteGroupConfirm = ref<string | null>(null)
const saved = ref(false)

const paymentMethods = ref<string[]>([])
const newPaymentMethod = ref('')
const showDeletePaymentConfirm = ref<string | null>(null)

onMounted(async () => {
  groups.value = await getAllGroups()
  paymentMethods.value = await getPaymentMethods()
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

async function handleAddPaymentMethod() {
  const name = newPaymentMethod.value.trim()
  if (!name) return
  await addPaymentMethod(name)
  paymentMethods.value = await getPaymentMethods()
  newPaymentMethod.value = ''
}

async function handleDeletePaymentMethod(name: string) {
  await deletePaymentMethod(name)
  paymentMethods.value = await getPaymentMethods()
  showDeletePaymentConfirm.value = null
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
      
      <br/>
      <br/>
      
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

    <!-- Payment Methods -->
    <section class="bg-white rounded-xl p-6 shadow-sm">
      <h3 class="font-bold text-lg mb-4">{{ $t('settings.paymentMethods') }}</h3>
      <div class="flex flex-wrap gap-2 mb-3">
        <div v-for="m in paymentMethods" :key="m"
          class="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg">
          <span>{{ m }}</span>
          <button @click="showDeletePaymentConfirm = m"
            class="text-red-500 hover:text-red-700 text-lg leading-none">×</button>
        </div>
        <p v-if="paymentMethods.length === 0" class="text-gray-400 text-sm">{{ $t('common.no') }}</p>
      </div>
      <div class="flex gap-2">
        <input v-model="newPaymentMethod" @keyup.enter="handleAddPaymentMethod"
          class="flex-1 px-4 py-2 border rounded-lg text-lg"
          :placeholder="$t('settings.addPaymentMethod')" />
        <button @click="handleAddPaymentMethod"
          class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-lg">
          + {{ $t('common.add') }}
        </button>
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

    <!-- Version -->
    <p class="text-center text-gray-400 text-sm pb-4">{{ $t('settings.version') }} {{ version }}</p>

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
    <ConfirmDialog
      v-if="showDeletePaymentConfirm"
      :title="$t('common.confirm')"
      :message="$t('settings.deletePaymentMethod')"
      @confirm="handleDeletePaymentMethod(showDeletePaymentConfirm!)"
      @cancel="showDeletePaymentConfirm = null"
    />
  </div>
</template>
