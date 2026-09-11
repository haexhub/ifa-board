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

const email = ref('')
const role = ref<'trainer' | 'player'>(props.defaultRole ?? 'player')
const fieldErrors = ref<{ email?: string }>({})
const submitError = ref<string | null>(null)
const loading = ref(false)

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
  loading.value = true
  try {
    const res = await issue({ team_id: props.teamId, email: parsed.data.email, role: parsed.data.role })
    emit('issued', res)
    email.value = ''
  } catch (err) {
    const e = err as { statusCode?: number; statusMessage?: string; message?: string }
    submitError.value = e.statusMessage ?? e.message ?? 'Einladung konnte nicht erstellt werden.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end" novalidate @submit.prevent="submit">
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
    <button
      type="submit"
      :disabled="loading"
      class="min-h-touch px-4 rounded bg-neutral-900 text-white font-medium hover:bg-neutral-800 disabled:opacity-60"
    >
      {{ loading ? 'Sende…' : 'Einladen' }}
    </button>
    <p v-if="submitError" class="text-sm text-red-700 basis-full" role="alert">{{ submitError }}</p>
  </form>
</template>
