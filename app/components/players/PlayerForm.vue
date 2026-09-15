<script setup lang="ts">
import { ref } from 'vue'
import { z } from 'zod'

const props = defineProps<{
  teamId: string
  player?: {
    id: string
    name: string
    jersey_number: number | null
    position: string | null
    photo_consent: boolean
    active: boolean
  } | null
}>()

const emit = defineEmits<{
  (e: 'saved'): void
}>()

const schema = z.object({
  name: z.string().trim().min(1, 'Name ist erforderlich.'),
  jersey_number: z
    .number()
    .int('Ganzzahl erforderlich.')
    .min(0, 'Trikotnummer darf nicht negativ sein.')
    .nullable(),
  position: z.string().trim().min(1).nullable(),
  photo_consent: z.boolean(),
  active: z.boolean(),
})

const { create, update } = usePlayers()

const name = ref(props.player?.name ?? '')
const jerseyNumber = ref<number | null>(props.player?.jersey_number ?? null)
const position = ref(props.player?.position ?? '')
const consent = ref(props.player?.photo_consent ?? false)
const active = ref(props.player?.active ?? true)
const fieldErrors = ref<{ name?: string; jersey_number?: string }>({})
const submitError = ref<string | null>(null)
const loading = ref(false)

const onJerseyInput = (evt: Event) => {
  const v = (evt.target as HTMLInputElement).value
  jerseyNumber.value = v === '' ? null : Number(v)
}

const submit = async () => {
  fieldErrors.value = {}
  submitError.value = null
  const parsed = schema.safeParse({
    name: name.value,
    jersey_number: jerseyNumber.value,
    position: position.value.trim() === '' ? null : position.value.trim(),
    photo_consent: consent.value,
    active: active.value,
  })
  if (!parsed.success) {
    for (const issue_ of parsed.error.issues) {
      const key = issue_.path[0]
      if (key === 'name') fieldErrors.value.name = issue_.message
      if (key === 'jersey_number') fieldErrors.value.jersey_number = issue_.message
    }
    return
  }
  loading.value = true
  try {
    if (props.player) {
      await update(props.player.id, parsed.data)
    } else {
      await create(props.teamId, parsed.data)
    }
    emit('saved')
  } catch (err) {
    const e = err as { code?: string; statusCode?: number; statusMessage?: string; message?: string }
    if (e.code === '23505') {
      submitError.value =
        'Trikotnummer ist im aktiven Kader bereits vergeben. Zuerst den bisherigen Spieler deaktivieren.'
    } else {
      submitError.value = e.statusMessage ?? e.message ?? 'Spieler konnte nicht gespeichert werden.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="space-y-3" novalidate data-testid="player-form" @submit.prevent="submit">
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
        <span class="text-sm font-medium text-neutral-800">Trikotnummer (optional)</span>
        <input
          :value="jerseyNumber ?? ''"
          type="number"
          min="0"
          class="mt-1 w-full min-h-touch px-3 rounded border border-neutral-300 focus:border-neutral-900 focus:outline-none"
          @input="onJerseyInput"
        />
        <span v-if="fieldErrors.jersey_number" class="text-sm text-red-700">{{ fieldErrors.jersey_number }}</span>
      </label>
      <label class="flex-1 block">
        <span class="text-sm font-medium text-neutral-800">Position (optional)</span>
        <input
          v-model="position"
          type="text"
          class="mt-1 w-full min-h-touch px-3 rounded border border-neutral-300 focus:border-neutral-900 focus:outline-none"
        />
      </label>
    </div>
    <label class="flex items-center gap-2">
      <input v-model="consent" type="checkbox" class="h-5 w-5" />
      <span class="text-sm font-medium text-neutral-800">Foto-Einwilligung</span>
    </label>
    <label class="flex items-center gap-2">
      <input v-model="active" type="checkbox" class="h-5 w-5" />
      <span class="text-sm font-medium text-neutral-800">Aktiv im Kader</span>
    </label>
    <button
      type="submit"
      :disabled="loading"
      data-testid="player-form-submit"
      class="min-h-touch px-4 rounded bg-neutral-900 text-white font-medium hover:bg-neutral-800 disabled:opacity-60"
    >
      {{ loading ? 'Speichere…' : 'Speichern' }}
    </button>
    <p v-if="submitError" class="text-sm text-red-700" role="alert">{{ submitError }}</p>
  </form>
</template>
