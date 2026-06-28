<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMaterials } from '../composables/useMaterials'
import FormModal from '../components/FormModal.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import type { RawMaterial } from '../types'

const { materials, loadMaterials, addMaterial, updateMaterial, deleteMaterial, adjustStock } = useMaterials()

const showForm = ref(false)
const editingMaterial = ref<RawMaterial | null>(null)
const form = ref({ name: '', unit: '个', unitCost: 0, currentStock: 0, alertThreshold: 0 })

const showAdjust = ref<RawMaterial | null>(null)
const adjustDelta = ref(0)
const showDelete = ref<number | null>(null)

onMounted(loadMaterials)

function openAdd() {
  editingMaterial.value = null
  form.value = { name: '', unit: '个', unitCost: 0, currentStock: 0, alertThreshold: 0 }
  showForm.value = true
}

function openEdit(mat: RawMaterial) {
  editingMaterial.value = mat
  form.value = {
    name: mat.name,
    unit: mat.unit,
    unitCost: mat.unitCost,
    currentStock: mat.currentStock,
    alertThreshold: mat.alertThreshold,
  }
  showForm.value = true
}

async function saveMaterial() {
  if (!form.value.name) return
  if (editingMaterial.value) {
    await updateMaterial(editingMaterial.value.id!, form.value)
  } else {
    await addMaterial(form.value)
  }
  showForm.value = false
}

async function handleAdjust(mat: RawMaterial) {
  await adjustStock(mat.id!, adjustDelta.value)
  showAdjust.value = null
  adjustDelta.value = 0
}

async function handleDelete(id: number) {
  await deleteMaterial(id)
  showDelete.value = null
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex items-center gap-2 mb-4">
      <button
        @click="openAdd()"
        class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-lg"
      >
        + {{ $t('materials.addMaterial') }}
      </button>
    </div>

    <!-- Grid -->
    <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div
        v-for="mat in materials"
        :key="mat.id"
        class="bg-white rounded-xl p-4 shadow-sm border"
        :class="mat.currentStock <= mat.alertThreshold ? 'border-red-300 bg-red-50' : 'border-gray-200'"
      >
        <div class="font-bold text-lg">{{ mat.name }}</div>
        <div class="text-sm text-gray-500 mt-1">{{ mat.unit }}</div>
        <div class="mt-2 space-y-1">
          <div class="flex justify-between">
            <span class="text-gray-600">{{ $t('materials.currentStock') }}:</span>
            <span class="font-semibold" :class="mat.currentStock <= mat.alertThreshold ? 'text-red-600' : ''">
              {{ mat.currentStock }} {{ mat.unit }}
            </span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">{{ $t('materials.unitCost') }}:</span>
            <span class="font-semibold">{{ mat.unitCost }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">{{ $t('materials.alertThreshold') }}:</span>
            <span class="font-semibold">{{ mat.alertThreshold }}</span>
          </div>
        </div>
        <div class="flex gap-2 mt-3 pt-3 border-t border-gray-100">
          <button
            @click="showAdjust = mat"
            class="flex-1 px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm"
          >
            {{ $t('materials.adjust') }}
          </button>
          <button
            @click="openEdit(mat)"
            class="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 text-sm"
          >
            {{ $t('common.edit') }}
          </button>
          <button
            @click="showDelete = mat.id!"
            class="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
          >
            {{ $t('common.delete') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Form Modal -->
    <FormModal
      :show="showForm"
      :title="editingMaterial ? $t('materials.editMaterial') : $t('materials.addMaterial')"
      @close="showForm = false"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('materials.name') }}</label>
          <input v-model="form.name" class="w-full px-3 py-2 border rounded-lg text-lg" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('materials.unit') }}</label>
          <select v-model="form.unit" class="w-full px-3 py-2 border rounded-lg text-lg">
            <option value="个">个</option>
            <option value="g">g</option>
            <option value="ml">ml</option>
            <option value="包">包</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('materials.unitCost') }}</label>
          <input v-model.number="form.unitCost" type="number" step="0.01" min="0" class="w-full px-3 py-2 border rounded-lg text-lg" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('materials.currentStock') }}</label>
          <input v-model.number="form.currentStock" type="number" min="0" class="w-full px-3 py-2 border rounded-lg text-lg" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('materials.alertThreshold') }}</label>
          <input v-model.number="form.alertThreshold" type="number" min="0" class="w-full px-3 py-2 border rounded-lg text-lg" />
        </div>
        <div class="flex justify-end gap-3 pt-2">
          <button @click="showForm = false" class="px-6 py-3 border rounded-lg text-lg">{{ $t('common.cancel') }}</button>
          <button @click="saveMaterial" class="px-6 py-3 bg-indigo-600 text-white rounded-lg text-lg">{{ $t('common.save') }}</button>
        </div>
      </div>
    </FormModal>

    <!-- Stock Adjust Modal -->
    <FormModal
      :show="!!showAdjust"
      :title="$t('materials.adjustTitle')"
      @close="showAdjust = null"
    >
      <div v-if="showAdjust" class="space-y-4">
        <p>{{ $t('materials.current') }}: <strong>{{ showAdjust.currentStock }} {{ showAdjust.unit }}</strong></p>
        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('materials.adjustAmount') }}</label>
          <input v-model.number="adjustDelta" type="number" class="w-full px-3 py-2 border rounded-lg text-lg" placeholder="+10 / -5" />
        </div>
        <p>{{ $t('materials.afterAdjust') }}: <strong>{{ Math.max(0, showAdjust.currentStock + adjustDelta) }} {{ showAdjust.unit }}</strong></p>
        <div class="flex justify-end gap-3 pt-2">
          <button @click="showAdjust = null" class="px-6 py-3 border rounded-lg text-lg">{{ $t('common.cancel') }}</button>
          <button @click="handleAdjust(showAdjust)" class="px-6 py-3 bg-amber-500 text-white rounded-lg text-lg">{{ $t('common.confirm') }}</button>
        </div>
      </div>
    </FormModal>

    <!-- Delete Confirm -->
    <ConfirmDialog
      v-if="showDelete"
      :title="$t('common.confirm')"
      :message="$t('materials.confirmDelete')"
      @confirm="handleDelete(showDelete)"
      @cancel="showDelete = null"
    />
  </div>
</template>
