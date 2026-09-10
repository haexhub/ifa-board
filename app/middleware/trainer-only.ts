// T035: trainer-only guard for team-scoped routes.
// Requires trainer membership in the current slugged team.

export default defineNuxtRouteMiddleware(async (to) => {
  const slug = (to.params as { slug?: string }).slug
  if (!slug) return

  const client = useSupabaseClient()
  const user = useSupabaseUser()
  if (!user.value) return navigateTo('/login')

  const { data, error } = await client
    .from('memberships')
    .select('role, teams!inner(slug)')
    .eq('teams.slug', slug)
    .eq('user_id', user.value.id)
    .maybeSingle()

  if (error || !data || data.role !== 'trainer') {
    return navigateTo(`/t/${slug}/dashboard`)
  }
})
