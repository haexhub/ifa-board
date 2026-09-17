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
    <ShadcnLabel class="block space-y-1">
      <span>E-Mail-Adresse</span>
      <ShadcnInput v-model="email" type="email" autocomplete="email" required />
      <span v-if="fieldError" class="block text-sm text-destructive">{{ fieldError }}</span>
    </ShadcnLabel>
    <ShadcnButton type="submit" :disabled="loading" class="w-full">
      {{ loading ? 'Sende Link…' : 'Link senden' }}
    </ShadcnButton>
    <p v-if="submitError" class="text-sm text-destructive" role="alert">{{ submitError }}</p>
  </form>
  <div v-else class="rounded-lg border border-success/30 bg-success/10 p-4 text-success">
    <p class="font-medium">Prüfe deine E-Mails</p>
    <p class="text-sm mt-1 text-foreground">
      Wir haben dir einen Anmelde-Link an <strong>{{ email }}</strong> geschickt.
    </p>
  </div>
</template>
