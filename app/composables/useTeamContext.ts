// T040: current team context (slug from URL) + list of user's memberships.

import { computed } from 'vue'

type Membership = {
  team_id: string
  role: 'trainer' | 'player'
  teams: {
    id: string
    name: string
    slug: string
  } | null
}

export const useTeamContext = () => {
  const route = useRoute()
  const client = useSupabaseClient()
  const user = useSupabaseUser()

  const currentSlug = computed<string | null>(
    () => (route.params as { slug?: string }).slug ?? null,
  )

  const { data: memberships, refresh } = useAsyncData<Membership[]>(
    'my-memberships',
    async () => {
      if (!user.value) return []
      const { data, error } = await client
        .from('memberships')
        .select('team_id, role, teams (id, name, slug)')
        .eq('user_id', user.value.id)
      if (error) throw error
      return (data ?? []) as unknown as Membership[]
    },
    { watch: [user] },
  )

  const currentMembership = computed(() => {
    const slug = currentSlug.value
    if (!slug) return null
    return memberships.value?.find((m) => m.teams?.slug === slug) ?? null
  })

  const currentTeam = computed(() => currentMembership.value?.teams ?? null)
  const isTrainer = computed(() => currentMembership.value?.role === 'trainer')

  return {
    currentSlug,
    currentTeam,
    currentMembership,
    isTrainer,
    memberships,
    refresh,
  }
}
