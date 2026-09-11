<script setup lang="ts">
import { ref } from 'vue'
import { z } from 'zod'

const props = defineProps<{
  initialEmail?: string
  redirectTo?: string
}>()

const emailSchema = z.string().trim().toLowerCase().email()

const { signInWithMagicLink } = useAuth()

const email = ref(props.initialEmail ?? '')
const fieldError = ref<string | null>(null)
const submitError = ref<string | null>(null)
const sent = ref(false)
const loading = ref(false)

const submit = async () => {
  fieldError.value = null
  submitError.value = null
  const parsed = emailSchema.safeParse(email.value)
  if (!parsed.success) {
    fieldError.value = 'Bitte gib eine gültige E-Mail-Adresse ein.'
    return
  }
  loading.value = true
  const { error } = await signInWithMagicLink(parsed.data, props.redirectTo)
  loading.value = false
  if (error) {
    submitError.value = error.message
    return
  }
  sent.value = true
}
</script>

<template>
  <form v-if="!sent" class="space-y-4" novalidate @submit.prevent="submit">
    <label class="block">
      <span class="text-sm font-medium text-neutral-800">E-Mail-Adresse</span>
      <input
        v-model="email"
        type="email"
        autocomplete="email"
        required
        class="mt-1 w-full min-h-touch px-3 rounded border border-neutral-300 focus:border-neutral-900 focus:outline-none"
      />
      <span v-if="fieldError" class="text-sm text-red-700">{{ fieldError }}</span>
    </label>
    <button
      type="submit"
      :disabled="loading"
      class="w-full min-h-touch px-4 rounded bg-neutral-900 text-white font-medium hover:bg-neutral-800 disabled:opacity-60"
    >
      {{ loading ? 'Sende Link…' : 'Link senden' }}
    </button>
    <p v-if="submitError" class="text-sm text-red-700" role="alert">{{ submitError }}</p>
  </form>
  <div v-else class="rounded border border-green-200 bg-green-50 p-4 text-green-900">
    <p class="font-medium">Prüfe deine E-Mails</p>
    <p class="text-sm mt-1">
      Wir haben dir einen Anmelde-Link an <strong>{{ email }}</strong> geschickt.
    </p>
  </div>
</template>
