import type { Database } from '~/types/database'

type MyTeam = {
  team_id: string
  role: string
  teams: {
    id: string
    name: string
    slug: string
  } | null
}

export const useTeams = () => {
  const client = useSupabaseClient<Database>()
  const user = useSupabaseUser()

  const createTeam = async (payload: { name: string; slug?: string }) => {
    return await $fetch<{ slug: string }>('/api/teams/create', {
      method: 'POST',
      body: payload,
    })
  }

  const update = async (team_id: string, payload: { name?: string; slug?: string }) => {
    const { data, error } = await client
      .from('teams')
      .update(payload)
      .eq('id', team_id)
      .select('id')
      .single()
    if (error) throw error
    return data
  }

  const updateWithSettings = async (
    team_id: string,
    payload: { name: string; slug: string; season_start: string },
  ) => {
    return await $fetch<{ slug: string }>(`/api/teams/${team_id}/settings`, {
      method: 'PUT',
      body: payload,
    })
  }

  const myTeams = async (): Promise<MyTeam[]> => {
    if (!user.value) return []
    const { data, error } = await client
      .from('memberships')
      .select('team_id, role, teams(id, name, slug)')
      .eq('user_id', user.value.sub)
    if (error) throw error
    return (data ?? []) as MyTeam[]
  }

  return { createTeam, update, updateWithSettings, myTeams }
}
