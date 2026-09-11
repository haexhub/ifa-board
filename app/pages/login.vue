<script setup lang="ts">
import LoginMagicLink from '~/components/auth/LoginMagicLink.vue'

definePageMeta({
  layout: 'onboarding',
})

const route = useRoute()
const redirect = computed(() => {
  const raw = route.query.redirect
  return typeof raw === 'string' && raw.startsWith('/') ? raw : undefined
})
const initialEmail = computed(() => {
  const raw = route.query.email
  return typeof raw === 'string' ? raw : undefined
})
</script>

<template>
  <section class="space-y-6 py-6">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold text-neutral-900">Anmelden</h1>
      <p class="text-neutral-600">Wir schicken dir einen Anmelde-Link per E-Mail.</p>
    </header>
    <LoginMagicLink :initial-email="initialEmail" :redirect-to="redirect" />
  </section>
</template>
