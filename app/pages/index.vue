<script setup lang="ts">
// T041: role-aware landing.
// - session + memberships → /t/<lastSlug or first>
// - session + no memberships → /start
// - no session → /login (handled by auth.global)

const user = useSupabaseUser()

if (import.meta.client && user.value) {
  const client = useSupabaseClient()
  const { data } = await client
    .from('memberships')
    .select('teams(slug)')
    .eq('user_id', user.value.id)
    .limit(1)
    .maybeSingle()

  const lastSlug = localStorage.getItem('ifa:lastSlug') || null
  type Row = { teams: { slug: string } | null }
  const firstSlug = (data as Row | null)?.teams?.slug ?? null

  const target = lastSlug || firstSlug
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
