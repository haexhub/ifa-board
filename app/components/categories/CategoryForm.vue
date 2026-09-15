<script setup lang="ts">
import { ref } from 'vue'
import { z } from 'zod'

const props = defineProps<{
  teamId: string
  nextSortOrder: number
  category?: {
    id: string
    name: string
    value_min: number
    value_max: number
    sort_order: number
    active: boolean
  } | null
}>()

const emit = defineEmits<{
  (e: 'saved'): void
}>()

const schema = z
  .object({
    name: z.string().trim().min(1, 'Name ist erforderlich.'),
    value_min: z.coerce.number().int('Ganzzahl erforderlich.'),
    value_max: z.coerce.number().int('Ganzzahl erforderlich.'),
    sort_order: z.coerce.number().int().min(1, 'Reihenfolge muss ≥ 1 sein.'),
    active: z.boolean(),
  })
  .refine((data) => data.value_max >= data.value_min, {
    message: 'Maximalwert muss ≥ Minimalwert sein.',
    path: ['value_max'],
  })

const { create, update } = useCategories()

const name = ref(props.category?.name ?? '')
const valueMin = ref(props.category?.value_min ?? 0)
const valueMax = ref(props.category?.value_max ?? 5)
const sortOrder = ref(props.category?.sort_order ?? props.nextSortOrder)
const active = ref(props.category?.active ?? true)
const fieldErrors = ref<{ name?: string; value_max?: string; sort_order?: string }>({})
const submitError = ref<string | null>(null)
const loading = ref(false)

const submit = async () => {
  fieldErrors.value = {}
  submitError.value = null
  const parsed = schema.safeParse({
    name: name.value,
    value_min: valueMin.value,
    value_max: valueMax.value,
    sort_order: sortOrder.value,
    active: active.value,
  })
  if (!parsed.success) {
    for (const issue_ of parsed.error.issues) {
      const key = issue_.path[0]
      if (key === 'name') fieldErrors.value.name = issue_.message
      if (key === 'value_max') fieldErrors.value.value_max = issue_.message
      if (key === 'sort_order') fieldErrors.value.sort_order = issue_.message
    }
    return
  }
  loading.value = true
  try {
    if (props.category) {
      await update(props.category.id, parsed.data)
    } else {
      await create(props.teamId, parsed.data)
    }
    emit('saved')
  } catch (err) {
    const e = err as { statusCode?: number; statusMessage?: string; message?: string }
    submitError.value = e.statusMessage ?? e.message ?? 'Kategorie konnte nicht gespeichert werden.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="space-y-3" novalidate data-testid="category-form" @submit.prevent="submit">
    <label class="block">
      <span class="text-sm font-medium text-neutral-800">Name</span>
      <input
        v-model="name"
        type="text"
        required
        class="mt-1 w-full min-h-touch px-3 rounded border border-neutral-300 focus:border-neutral-900 focus:outline-none"
      />
      <span v-if="fieldErrors.name" class="text-sm text-red-700">{{ fieldErrors.name }}</span>
    </label>
    <div class="flex gap-3">
      <label class="flex-1 block">
        <span class="text-sm font-medium text-neutral-800">Min</span>
        <input
          v-model.number="valueMin"
          type="number"
          required
          class="mt-1 w-full min-h-touch px-3 rounded border border-neutral-300 focus:border-neutral-900 focus:outline-none"
        />
      </label>
      <label class="flex-1 block">
        <span class="text-sm font-medium text-neutral-800">Max</span>
        <input
          v-model.number="valueMax"
          type="number"
          required
          class="mt-1 w-full min-h-touch px-3 rounded border border-neutral-300 focus:border-neutral-900 focus:outline-none"
        />
        <span v-if="fieldErrors.value_max" class="text-sm text-red-700">{{ fieldErrors.value_max }}</span>
      </label>
    </div>
    <label class="block">
      <span class="text-sm font-medium text-neutral-800">Reihenfolge</span>
      <input
        v-model.number="sortOrder"
        type="number"
        min="1"
        required
        class="mt-1 w-full min-h-touch px-3 rounded border border-neutral-300 focus:border-neutral-900 focus:outline-none"
      />
      <span v-if="fieldErrors.sort_order" class="text-sm text-red-700">{{ fieldErrors.sort_order }}</span>
    </label>
    <label class="flex items-center gap-2">
      <input v-model="active" type="checkbox" class="h-5 w-5" />
      <span class="text-sm font-medium text-neutral-800">Aktiv</span>
    </label>
    <button
      type="submit"
      :disabled="loading"
      data-testid="category-form-submit"
      class="min-h-touch px-4 rounded bg-neutral-900 text-white font-medium hover:bg-neutral-800 disabled:opacity-60"
    >
      {{ loading ? 'Speichere…' : 'Speichern' }}
    </button>
    <p v-if="submitError" class="text-sm text-red-700" role="alert">{{ submitError }}</p>
  </form>
</template>
