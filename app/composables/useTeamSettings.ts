import type { Database } from '~/types/database'

export const useTeamSettings = () => {
  const client = useSupabaseClient<Database>()

  const get = async (team_id: string) => {
    const { data, error } = await client
      .from('team_settings')
      .select('team_id, season_start')
      .eq('team_id', team_id)
      .maybeSingle()
    if (error) throw error
    return data
  }

  const update = async (team_id: string, payload: { season_start: string }) => {
    const { error } = await client.from('team_settings').update(payload).eq('team_id', team_id)
    if (error) throw error
  }

  return { get, update }
}
