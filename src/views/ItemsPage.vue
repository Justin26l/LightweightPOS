<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useItems } from '../composables/useItems'
import { useCart } from '../composables/useCart'
import { useCombos } from '../composables/useCombos'
import { db } from '../db'
import FormModal from '../components/FormModal.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import type { ItemWithDetails, RawMaterial, ComboWithDetails } from '../types'

const { items, loadItems, addItem, updateItem, deleteItem } = useItems()
const cart = useCart()
const { combos, loadCombos, addCombo, updateCombo, deleteCombo } = useCombos()

const editMode = ref(false)
const showGroupInput = ref(false)
const newGroupName = ref('')
const showItemForm = ref(false)
const materials = ref<RawMaterial[]>([])
const editingItem = ref<ItemWithDetails | null>(null)
const itemForm = ref({ name: '', price: 0, minQty: 1, groupName: '' })
const showDeleteConfirm = ref<number | null>(null)
const formMaterials = ref<{ materialId: number; amount: number }[]>([])
const showComboForm = ref(false)
const editingCombo = ref<ComboWithDetails | null>(null)
const comboForm = ref({ name: '', price: 0, items: [] as { itemId: number; qty: number }[] })

onMounted(async () => {
  await loadItems()
  materials.value = await db.rawMaterials.toArray()
  await loadCombos()
})

// Real-time stock: reload when cart is cleared (checkout happened)
watch(() => cart.cart.items.length, () => {
  loadItems()
  loadCombos()
})

// Groups
const groups = computed(() => {
  const map = new Map<string, ItemWithDetails[]>()
  for (const item of items.value) {
    const g = item.groupName || ''
    if (!map.has(g)) map.set(g, [])
    map.get(g)!.push(item)
  }
  return map
})

const sortedGroups = computed(() => {
  const entries = [...groups.value.entries()]
  entries.sort(([a], [b]) => a.localeCompare(b))
  return entries
})

function addToCart(item: ItemWithDetails) {
  cart.addItem({
    type: 'item',
    refId: item.id!,
    name: item.name,
    price: item.price,
    cost: item.unitCost,
    qty: 1,
  })
}

function addComboToCart(combo: ComboWithDetails) {
  cart.addItem({
    type: 'combo',
    refId: combo.id!,
    name: combo.name,
    price: combo.price,
    cost: combo.cost,
    qty: 1,
  })
}

function openAddCombo() {
  editingCombo.value = null
  comboForm.value = { name: '', price: 0, items: [] }
  showComboForm.value = true
}

async function openEditCombo(combo: ComboWithDetails) {
  editingCombo.value = combo
  comboForm.value = {
    name: combo.name,
    price: combo.price,
    items: combo.items.map(ci => ({ itemId: ci.itemId, qty: ci.qty })),
  }
  showComboForm.value = true
}

async function saveCombo() {
  if (!comboForm.value.name || !comboForm.value.price) return
  const items = comboForm.value.items.filter(ci => ci.itemId > 0)
  if (editingCombo.value) {
    await updateCombo(editingCombo.value.id!, { ...comboForm.value, items })
  } else {
    await addCombo({ ...comboForm.value, items })
  }
  showComboForm.value = false
}

async function handleDeleteCombo(id: number) {
  await deleteCombo(id)
}

function addGroup() {
  if (newGroupName.value.trim()) {
    // Auto-open add item form with the new group pre-filled
    editingItem.value = null
    itemForm.value = { name: '', price: 0, minQty: 1, groupName: newGroupName.value.trim() }
    formMaterials.value = []
    showGroupInput.value = false
    newGroupName.value = ''
    showItemForm.value = true
  }
}

function openAddItem() {
  editingItem.value = null
  itemForm.value = { name: '', price: 0, minQty: 1, groupName: '' }
  formMaterials.value = []
  showItemForm.value = true
}

async function openEditItem(item: ItemWithDetails) {
  editingItem.value = item
  itemForm.value = {
    name: item.name,
    price: item.price,
    minQty: item.minQty,
    groupName: item.groupName,
  }
  formMaterials.value = []
  // If editing, load existing materials
  if (editingItem.value) {
    const existing = await db.itemMaterials.where('itemId').equals(editingItem.value.id!).toArray()
    formMaterials.value = existing.map(im => ({ materialId: im.materialId, amount: im.amount }))
  }
  showItemForm.value = true
}

async function saveItem() {
  if (!itemForm.value.name) return
  let itemId: number
  if (editingItem.value) {
    await updateItem(editingItem.value.id!, itemForm.value)
    itemId = editingItem.value.id!
  } else {
    itemId = await addItem(itemForm.value)
  }
  // Save materials
  await db.itemMaterials.where('itemId').equals(itemId).delete()
  for (const fm of formMaterials.value) {
    if (fm.materialId && fm.amount > 0) {
      await db.itemMaterials.add({ itemId, materialId: fm.materialId, amount: fm.amount })
    }
  }
  showItemForm.value = false
}

async function handleDelete(id: number) {
  await deleteItem(id)
  showDeleteConfirm.value = null
}
</script>

<template>
  <div class="h-full flex flex-col" :class="{ 'bg-amber-50': editMode }">
    <!-- Edit Mode Toggle + Actions -->
    <div class="flex items-center gap-2 mb-4 flex-wrap">
      <button
        @click="editMode = !editMode"
        class="px-4 py-2 rounded-lg text-lg font-medium transition-colors"
        :class="editMode ? 'bg-amber-500 text-white' : 'bg-gray-200 hover:bg-gray-300'"
      >
        {{ editMode ? $t('items.normalMode') : $t('items.editMode') }}
      </button>
      <template v-if="editMode">
        <template v-if="!showGroupInput">
          <button @click="openAddItem()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-lg">
            + {{ $t('items.addItem') }}
          </button>
          <button @click="openAddCombo()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-lg">
            + {{ $t('items.addCombo') }}
          </button>
          <button @click="showGroupInput = true" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-lg">
            + {{ $t('items.addGroup') }}
          </button>
        </template>
        <template v-else>
          <input v-model="newGroupName" @keyup.enter="addGroup" @keyup.escape="showGroupInput = false"
            class="px-3 py-2 border rounded-lg" :placeholder="$t('items.groupName')" />
          <button @click="addGroup" class="px-3 py-2 bg-indigo-600 text-white rounded-lg">OK</button>
          <button @click="showGroupInput = false" class="px-3 py-2 border rounded-lg">{{ $t('common.cancel') }}</button>
        </template>
      </template>
    </div>

    <!-- Grid -->
    <div class="flex-1 overflow-y-auto">
      <!-- Combos section -->
      <div v-if="combos.length" class="mb-6">
        <h2 class="text-lg font-bold text-indigo-700 mb-2 px-1">
          ⊞ {{ $t('items.combo') }}
        </h2>
        <div class="h-px bg-indigo-200 mb-3" />
        <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <div
            v-for="combo in combos"
            :key="combo.id"
            @click="!editMode && addComboToCart(combo)"
            class="bg-white rounded-xl p-4 shadow-sm border-2 border-indigo-100 hover:border-indigo-300 cursor-pointer transition-all min-h-[80px] flex flex-col justify-center items-center"
            :class="{ 'opacity-50 pointer-events-none': combo.stock <= 0 }"
          >
            <div class="font-bold text-lg text-indigo-700">{{ combo.name }}</div>
            <div class="text-indigo-600 text-xl font-bold mt-1">{{ combo.price }}</div>
            <div v-if="combo.stock <= 0" class="text-xs text-red-500 mt-1">{{ $t('items.noStock') }}</div>
            <div v-else-if="combo.stock < 5" class="text-xs text-amber-500 mt-1">
              {{ $t('items.lowStock') }} ({{ combo.stock }}{{ $t('items.servings') }})
            </div>
            <div v-else class="text-xs text-gray-400 mt-1">{{ combo.stock }}{{ $t('items.servings') }}</div>
            <!-- Edit/delete in edit mode -->
            <div v-if="editMode" class="flex gap-2 mt-2 pt-2 border-t border-indigo-100">
              <button
                @click.stop="openEditCombo(combo)"
                class="text-xs px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
              >
                {{ $t('common.edit') }}
              </button>
              <button
                @click.stop="handleDeleteCombo(combo.id!)"
                class="text-xs px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                {{ $t('common.delete') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Regular groups -->
      <div v-for="[group, groupItems] in sortedGroups" :key="group" class="mb-6">
        <div class="flex items-center justify-between mb-2 px-1">
          <h2 class="text-lg font-bold text-gray-700">{{ group || $t('items.groupName') }}</h2>
          <button
            v-if="editMode"
            class="px-2 py-1 text-sm bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
          >
            + {{ $t('items.addGroup') }}
          </button>
        </div>
        <div class="h-px bg-gray-200 mb-3" />
        <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <div
            v-for="item in groupItems"
            :key="item.id"
            @click="!editMode && addToCart(item)"
            class="bg-white rounded-xl p-4 shadow-sm hover:shadow-md cursor-pointer transition-all border-2 border-transparent hover:border-indigo-200"
            :class="{
              'opacity-50 pointer-events-none cursor-not-allowed': item.stock <= 0,
              'border-amber-300': editMode,
            }"
          >
            <div class="font-bold text-lg">{{ item.name }}</div>
            <div class="text-gray-800 text-xl font-bold mt-1">{{ item.price }}</div>
            <div v-if="item.stock <= 0" class="text-xs text-red-500 mt-1">{{ $t('items.noStock') }}</div>
            <div v-else-if="item.stock < 5" class="text-xs text-amber-500 mt-1">
              {{ $t('items.lowStock') }} ({{ item.stock }}{{ $t('items.servings') }})
            </div>
            <div v-else class="text-xs text-gray-400 mt-1">{{ item.stock }}{{ $t('items.servings') }}</div>
            <!-- Edit/delete in edit mode -->
            <div v-if="editMode" class="flex gap-2 mt-2 pt-2 border-t border-gray-100">
              <button
                @click.stop="openEditItem(item)"
                class="text-xs px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
              >
                {{ $t('common.edit') }}
              </button>
              <button
                @click.stop="showDeleteConfirm = item.id!"
                class="text-xs px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                {{ $t('common.delete') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Item Form Modal -->
    <FormModal
      :show="showItemForm"
      :title="editingItem ? $t('items.editItem') : $t('items.addItem')"
      @close="showItemForm = false"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('items.name') }}</label>
          <input v-model="itemForm.name" class="w-full px-3 py-2 border rounded-lg text-lg" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('items.price') }}</label>
          <input v-model.number="itemForm.price" type="number" step="0.01" min="0" class="w-full px-3 py-2 border rounded-lg text-lg" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('items.minQty') }}</label>
          <input v-model.number="itemForm.minQty" type="number" min="1" class="w-full px-3 py-2 border rounded-lg text-lg" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('items.groupName') }}</label>
          <input v-model="itemForm.groupName" list="group-list" class="w-full px-3 py-2 border rounded-lg text-lg" />
          <datalist id="group-list">
            <option v-for="g in sortedGroups" :key="g[0]" :value="g[0]" />
          </datalist>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">{{ $t('materials.title') }}</label>
          <div v-for="(mat, idx) in formMaterials" :key="idx" class="flex gap-2 mb-2 items-center">
            <select v-model="mat.materialId" class="flex-1 px-3 py-2 border rounded-lg">
              <option value="0" disabled>--</option>
              <option v-for="m in materials" :key="m.id" :value="m.id">{{ m.name }}</option>
            </select>
            <input v-model.number="mat.amount" type="number" step="0.01" min="0.01"
              class="w-24 px-3 py-2 border rounded-lg text-center" placeholder="用量" />
            <button @click="formMaterials.splice(idx, 1)" class="text-red-500 px-2">×</button>
          </div>
          <button
            @click="formMaterials.push({ materialId: 0, amount: 1 })"
            class="text-sm text-indigo-600 hover:text-indigo-800"
          >
            + {{ $t('materials.addMaterial') }}
          </button>
        </div>
        <div class="flex justify-end gap-3 pt-2">
          <button @click="showItemForm = false" class="px-6 py-3 border rounded-lg text-lg">{{ $t('common.cancel') }}</button>
          <button @click="saveItem" class="px-6 py-3 bg-indigo-600 text-white rounded-lg text-lg">{{ $t('common.save') }}</button>
        </div>
      </div>
    </FormModal>

    <!-- Combo Form Modal -->
    <FormModal
      :show="showComboForm"
      :title="editingCombo ? $t('items.editCombo') : $t('items.addCombo')"
      @close="showComboForm = false"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('items.name') }}</label>
          <input v-model="comboForm.name" class="w-full px-3 py-2 border rounded-lg text-lg" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('items.price') }}</label>
          <input v-model.number="comboForm.price" type="number" step="0.01" min="0" class="w-full px-3 py-2 border rounded-lg text-lg" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">{{ $t('items.name') }}</label>
          <div v-for="(ci, idx) in comboForm.items" :key="idx" class="flex gap-2 mb-2 items-center">
            <select v-model="ci.itemId" class="flex-1 px-3 py-2 border rounded-lg">
              <option value="0" disabled>--</option>
              <option v-for="item in items" :key="item.id" :value="item.id">{{ item.name }}</option>
            </select>
            <span class="text-gray-500">×</span>
            <input v-model.number="ci.qty" type="number" min="1" class="w-20 px-3 py-2 border rounded-lg text-center" />
            <button @click="comboForm.items.splice(idx, 1)" class="text-red-500 px-2">×</button>
          </div>
          <button
            @click="comboForm.items.push({ itemId: 0, qty: 1 })"
            class="text-sm text-indigo-600 hover:text-indigo-800"
          >
            + {{ $t('items.addItem') }}
          </button>
        </div>
        <div class="flex justify-end gap-3 pt-2">
          <button @click="showComboForm = false" class="px-6 py-3 border rounded-lg text-lg">{{ $t('common.cancel') }}</button>
          <button @click="saveCombo" class="px-6 py-3 bg-indigo-600 text-white rounded-lg text-lg">{{ $t('common.save') }}</button>
        </div>
      </div>
    </FormModal>

    <!-- Delete Confirm -->
    <ConfirmDialog
      v-if="showDeleteConfirm"
      :title="$t('common.confirm')"
      :message="$t('items.confirmDelete')"
      @confirm="handleDelete(showDeleteConfirm!)"
      @cancel="showDeleteConfirm = null"
    />
  </div>
</template>
