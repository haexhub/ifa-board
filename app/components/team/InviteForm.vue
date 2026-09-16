<script setup lang="ts">
import { ref } from 'vue'
import { z } from 'zod'

const props = defineProps<{
  teamId: string
  defaultRole?: 'trainer' | 'player'
}>()

const emit = defineEmits<{
  (e: 'issued', payload: { id: string }): void
}>()

const schema = z.object({
  email: z.string().trim().toLowerCase().email('Bitte gültige E-Mail eingeben.'),
  role: z.enum(['trainer', 'player']),
})

const { issue } = useInvitations()
const { create, remove } = usePlayers()

const email = ref('')
const role = ref<'trainer' | 'player'>(props.defaultRole ?? 'player')
const playerName = ref('')
const jerseyNumber = ref<number | null>(null)
const position = ref('')
const fieldErrors = ref<{ email?: string; name?: string; jersey_number?: string }>({})
const submitError = ref<string | null>(null)
const loading = ref(false)

const onJerseyInput = (evt: Event) => {
  const v = (evt.target as HTMLInputElement).value
  jerseyNumber.value = v === '' ? null : Number(v)
}

const submit = async () => {
  fieldErrors.value = {}
  submitError.value = null
  const parsed = schema.safeParse({ email: email.value, role: role.value })
  if (!parsed.success) {
    for (const issue_ of parsed.error.issues) {
      if (issue_.path[0] === 'email') fieldErrors.value.email = issue_.message
    }
    return
  }

  // Player-detail fields are optional — filling in a name alongside role
  // "player" creates the roster entry now and auto-links it once accepted.
  // Leaving them blank keeps the old plain-invite behaviour unchanged.
  const wantsPlayerRow = parsed.data.role === 'player' && playerName.value.trim() !== ''
  if (wantsPlayerRow && jerseyNumber.value !== null) {
    if (!Number.isInteger(jerseyNumber.value) || jerseyNumber.value < 0) {
      fieldErrors.value.jersey_number = 'Trikotnummer muss eine nicht-negative Ganzzahl sein.'
      return
    }
  }

  loading.value = true
  let createdPlayerId: string | null = null
  try {
    let player_id: string | undefined
    if (wantsPlayerRow) {
      const created = await create(props.teamId, {
        name: playerName.value.trim(),
        jersey_number: jerseyNumber.value,
        position: position.value.trim() || null,
        photo_consent: false,
        active: true,
      })
      player_id = created.id
      createdPlayerId = created.id
    }
    const res = await issue({
      team_id: props.teamId,
      email: parsed.data.email,
      role: parsed.data.role,
      player_id,
    })
    emit('issued', res)
    email.value = ''
    playerName.value = ''
    jerseyNumber.value = null
    position.value = ''
  } catch (err) {
    if (createdPlayerId) {
      try {
        await remove(createdPlayerId)
      } catch {
        // Keep the original invitation error visible; cleanup can be retried manually.
      }
    }
    const e = err as { code?: string; statusCode?: number; statusMessage?: string; message?: string }
    if (e.code === '23505') {
      submitError.value =
        'Trikotnummer ist im aktiven Kader bereits vergeben. Zuerst den bisherigen Spieler deaktivieren.'
    } else {
      submitError.value = e.statusMessage ?? e.message ?? 'Einladung konnte nicht erstellt werden.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form
    class="rounded border border-neutral-200 bg-white p-4 space-y-4"
    novalidate
    @submit.prevent="submit"
  >
    <div class="flex flex-col sm:flex-row gap-3">
      <label class="flex-1 block">
        <span class="text-sm font-medium text-neutral-800">E-Mail</span>
        <input
          v-model="email"
          type="email"
          required
          class="mt-1 w-full min-h-touch px-3 rounded border border-neutral-300 focus:border-neutral-900 focus:outline-none"
        />
        <span v-if="fieldErrors.email" class="text-sm text-red-700">{{ fieldErrors.email }}</span>
      </label>
      <label class="block">
        <span class="text-sm font-medium text-neutral-800">Rolle</span>
        <select
          v-model="role"
          class="mt-1 w-full min-h-touch px-3 rounded border border-neutral-300 bg-white focus:border-neutral-900 focus:outline-none"
        >
          <option value="player">Spieler</option>
          <option value="trainer">Trainer</option>
        </select>
      </label>
    </div>
    <div v-if="role === 'player'" class="space-y-3">
      <label class="block">
        <span class="text-sm font-medium text-neutral-800">Name (optional)</span>
        <input
          v-model="playerName"
          type="text"
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
    </div>
    <div class="flex items-center justify-end gap-3 border-t border-neutral-200 pt-4">
      <p v-if="submitError" class="text-sm text-red-700 mr-auto" role="alert">{{ submitError }}</p>
      <button
        type="submit"
        :disabled="loading"
        class="min-h-touch px-4 rounded bg-neutral-900 text-white font-medium hover:bg-neutral-800 disabled:opacity-60"
      >
        {{ loading ? 'Sende…' : 'Einladen' }}
      </button>
    </div>
  </form>
</template>
