<script setup lang="ts">
import { ref } from 'vue'
import { z } from 'zod'

const schema = z.object({
  name: z.string().trim().min(1, 'Bitte Team-Name eingeben.').max(80),
  slug: z
    .string()
    .trim()
    .max(64)
    .regex(/^[a-z0-9-]*$/, 'Nur Kleinbuchstaben, Ziffern und Bindestriche.')
    .optional()
    .transform((v) => (v ? v : undefined)),
})

const { createTeam } = useTeams()

const name = ref('')
const slug = ref('')
const fieldErrors = ref<{ name?: string; slug?: string }>({})
const submitError = ref<string | null>(null)
const loading = ref(false)

const submit = async () => {
  fieldErrors.value = {}
  submitError.value = null
  const parsed = schema.safeParse({ name: name.value, slug: slug.value })
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (key === 'name' || key === 'slug') {
        fieldErrors.value[key] = issue.message
      }
    }
    return
  }
  loading.value = true
  try {
    const res = await createTeam(parsed.data)
    await navigateTo(`/t/${res.slug}`)
  } catch (err) {
    const e = err as { statusCode?: number; statusMessage?: string; message?: string }
    if (e.statusCode === 409) {
      fieldErrors.value.slug = 'Dieser Slug ist bereits vergeben.'
    } else {
      submitError.value = e.statusMessage ?? e.message ?? 'Team konnte nicht angelegt werden.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="space-y-4" novalidate @submit.prevent="submit">
    <label class="block">
      <span class="text-sm font-medium text-neutral-800">Team-Name</span>
      <input
        v-model="name"
        type="text"
        required
        maxlength="80"
        class="mt-1 w-full min-h-touch px-3 rounded border border-neutral-300 focus:border-neutral-900 focus:outline-none"
      />
      <span v-if="fieldErrors.name" class="text-sm text-red-700">{{ fieldErrors.name }}</span>
    </label>
    <label class="block">
      <span class="text-sm font-medium text-neutral-800">
        Slug <span class="text-neutral-500 font-normal">(optional)</span>
      </span>
      <input
        v-model="slug"
        type="text"
        maxlength="64"
        placeholder="wird aus dem Namen abgeleitet"
        class="mt-1 w-full min-h-touch px-3 rounded border border-neutral-300 focus:border-neutral-900 focus:outline-none"
      />
      <span v-if="fieldErrors.slug" class="text-sm text-red-700">{{ fieldErrors.slug }}</span>
    </label>
    <button
      type="submit"
      :disabled="loading"
      class="w-full min-h-touch px-4 rounded bg-neutral-900 text-white font-medium hover:bg-neutral-800 disabled:opacity-60"
    >
      {{ loading ? 'Lege an…' : 'Team gründen' }}
    </button>
    <p v-if="submitError" class="text-sm text-red-700" role="alert">{{ submitError }}</p>
  </form>
</template>
