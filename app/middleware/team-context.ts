// T034: /t/[slug]/** guard — require membership in the slugged team.
// Applied via `definePageMeta({ middleware: ['team-context'] })` in team pages,
// or attached to a layout that wraps every team-scoped route.

export default defineNuxtRouteMiddleware(async (to) => {
  const slug = (to.params as { slug?: string }).slug
  if (!slug) return

  const client = useSupabaseClient()
  const user = useSupabaseUser()
  if (!user.value) return navigateTo('/login')

  const { data, error } = await client
    .from('memberships')
    .select('team_id, role, teams!inner(slug)')
    .eq('teams.slug', slug)
    .eq('user_id', user.value.sub)
    .maybeSingle()

  if (error || !data) {
    return navigateTo('/start')
  }
})
