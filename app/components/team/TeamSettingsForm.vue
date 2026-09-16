<script setup lang="ts">
import { ref } from 'vue'
import { z } from 'zod'

const props = defineProps<{
  teamId: string
  name: string
  slug: string
  seasonStart: string
}>()

const emit = defineEmits<{
  (e: 'saved', payload: { slug: string }): void
}>()

const schema = z.object({
  name: z.string().trim().min(1, 'Bitte Team-Name eingeben.').max(80),
  slug: z
    .string()
    .trim()
    .min(1, 'Bitte Slug eingeben.')
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'Nur Kleinbuchstaben, Ziffern und Bindestriche.'),
  season_start: z.string().min(1, 'Bitte Saisonstart wählen.'),
})

const { updateWithSettings } = useTeams()

const name = ref(props.name)
const slug = ref(props.slug)
const seasonStart = ref(props.seasonStart)
const fieldErrors = ref<{ name?: string; slug?: string; season_start?: string }>({})
const submitError = ref<string | null>(null)
const loading = ref(false)

const submit = async () => {
  fieldErrors.value = {}
  submitError.value = null
  const parsed = schema.safeParse({
    name: name.value,
    slug: slug.value,
    season_start: seasonStart.value,
  })
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (key === 'name' || key === 'slug' || key === 'season_start') {
        fieldErrors.value[key] = issue.message
      }
    }
    return
  }
  loading.value = true
  try {
    await updateWithSettings(props.teamId, parsed.data)
    emit('saved', { slug: parsed.data.slug })
  } catch (err) {
    const e = err as {
      code?: string
      statusCode?: number
      statusMessage?: string
      message?: string
    }
    if (e.code === '23505' || e.statusCode === 409) {
      fieldErrors.value.slug = 'Dieser Slug ist bereits vergeben.'
    } else {
      submitError.value = e.statusMessage ?? e.message ?? 'Einstellungen konnten nicht gespeichert werden.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="space-y-4" novalidate data-testid="team-settings-form" @submit.prevent="submit">
    <label class="block">
      <span class="text-sm font-medium text-neutral-800">Team-Name</span>
      <input
        v-model="name"
        type="text"
        required
        maxlength="80"
        class="mt-1 w-full min-h-touch px-3 rounded border border-neutral-300 focus:border-neutral-900 focus:outline-none"
        data-testid="team-settings-name-input"
      />
      <span v-if="fieldErrors.name" class="text-sm text-red-700">{{ fieldErrors.name }}</span>
    </label>
    <label class="block">
      <span class="text-sm font-medium text-neutral-800">Slug</span>
      <input
        v-model="slug"
        type="text"
        required
        maxlength="64"
        class="mt-1 w-full min-h-touch px-3 rounded border border-neutral-300 focus:border-neutral-900 focus:outline-none"
        data-testid="team-settings-slug-input"
      />
      <span v-if="fieldErrors.slug" class="text-sm text-red-700">{{ fieldErrors.slug }}</span>
      <p class="mt-1 text-sm text-amber-700">
        Achtung: Öffentliche Links (z. B. die Rangliste) und Lesezeichen verweisen auf den
        aktuellen Slug. Eine Änderung macht alte Links ungültig.
      </p>
    </label>
    <label class="block">
      <span class="text-sm font-medium text-neutral-800">Saisonstart</span>
      <input
        v-model="seasonStart"
        type="date"
        required
        class="mt-1 w-full min-h-touch px-3 rounded border border-neutral-300 focus:border-neutral-900 focus:outline-none"
        data-testid="team-settings-season-start-input"
      />
      <span v-if="fieldErrors.season_start" class="text-sm text-red-700">{{
        fieldErrors.season_start
      }}</span>
    </label>
    <button
      type="submit"
      :disabled="loading"
      data-testid="team-settings-submit"
      class="min-h-touch px-4 rounded bg-neutral-900 text-white font-medium hover:bg-neutral-800 disabled:opacity-60"
    >
      {{ loading ? 'Speichere…' : 'Speichern' }}
    </button>
    <p v-if="submitError" class="text-sm text-red-700" role="alert">{{ submitError }}</p>
  </form>
</template>
