<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { POST_LOGIN_REDIRECT_KEY } from '~/composables/useAuth'
import type { Database } from '~/types/database'

definePageMeta({
  layout: 'onboarding',
})

const user = useSupabaseUser()
const route = useRoute()
const client = useSupabaseClient<Database>()
const error = ref<string | null>(null)

const readStoredRedirect = (): string | null => {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(POST_LOGIN_REDIRECT_KEY)
  localStorage.removeItem(POST_LOGIN_REDIRECT_KEY)
  if (!raw) return null
  if (!raw.startsWith('/') || raw[1] === '/' || raw[1] === '\\') return null
  return raw
}

const finalize = async () => {
  const rawRedirect = route.query.redirect
  const queryRedirect =
    typeof rawRedirect === 'string' &&
    rawRedirect.startsWith('/') &&
    rawRedirect[1] !== '/' &&
    rawRedirect[1] !== '\\'
      ? rawRedirect
      : null
  const redirect = queryRedirect ?? readStoredRedirect()

  if (redirect) {
    await navigateTo(redirect, { replace: true })
    return
  }

  if (!user.value) return
  const { data } = await client
    .from('memberships')
    .select('teams(slug)')
    .eq('user_id', user.value.id)

  const slugs = (data ?? []).map((m) => m.teams?.slug).filter((s): s is string => Boolean(s))
  const lastSlug = import.meta.client ? localStorage.getItem('ifa:lastSlug') : null
  const target = lastSlug && slugs.includes(lastSlug) ? lastSlug : (slugs[0] ?? null)

  if (target) {
    await navigateTo(`/t/${target}`, { replace: true })
  } else {
    await navigateTo('/start', { replace: true })
  }
}

const consumeImplicitFragment = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash
  if (!hash || !hash.includes('access_token=')) return false
  const params = new URLSearchParams(hash.slice(1))
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (!accessToken || !refreshToken) return false
  const { error: setErr } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })
  if (setErr) return false
  history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  return true
}

const consumePkceCode = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false
  const code = new URLSearchParams(window.location.search).get('code')
  if (!code) return false
  const { error: exchangeErr } = await client.auth.exchangeCodeForSession(code)
  if (exchangeErr) return false
  history.replaceState(null, '', window.location.pathname)
  return true
}

const pollForSession = async () => {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (user.value) return true
    const { data } = await client.auth.getSession()
    if (data.session?.user) return true
    await new Promise((r) => setTimeout(r, 200))
  }
  return false
}

onMounted(async () => {
  await consumeImplicitFragment()
  await consumePkceCode()
  const ok = await pollForSession()
  if (!ok) {
    error.value =
      'Anmeldung konnte nicht abgeschlossen werden. Bitte fordere einen neuen Link an.'
    return
  }
  await finalize()
})
</script>

<template>
  <div class="text-center py-16">
    <p v-if="!error" class="text-neutral-500">Melde dich an…</p>
    <p v-else class="text-red-700" role="alert">{{ error }}</p>
  </div>
</template>
