<script setup lang="ts">
import type { QueryData } from '@supabase/supabase-js'
import type { Database } from '~/types/database'

// T041: role-aware landing.
// - session + memberships → /t/<lastSlug or first>
// - session + no memberships → /start
// - no session → /login (handled by auth.global)

const user = useSupabaseUser()

if (import.meta.client && user.value) {
  const client = useSupabaseClient<Database>()
  const membershipsQuery = client
    .from('memberships')
    .select('teams(slug)')
    .eq('user_id', user.value.id)
  type Membership = QueryData<typeof membershipsQuery>[number]
  const { data } = await membershipsQuery

  const lastSlug = localStorage.getItem('ifa:lastSlug') || null
  const slugs = (data ?? [])
    .map((membership: Membership) => membership.teams?.slug)
    .filter((slug): slug is string => Boolean(slug))
  const firstSlug = slugs[0] ?? null

  const target = lastSlug && slugs.includes(lastSlug) ? lastSlug : firstSlug
  if (target) {
    await navigateTo(`/t/${target}`)
  } else {
    await navigateTo('/start')
  }
}
</script>

<template>
  <div class="text-center py-16 text-neutral-500">Weiterleitung…</div>
</template>
