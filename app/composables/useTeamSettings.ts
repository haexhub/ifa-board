import type { Database } from '~/types/database'

export type TeamSettings = {
  team_id: string
  season_start: string
}

export const useTeamSettings = () => {
  const client = useSupabaseClient<Database>()

  const get = async (team_id: string): Promise<TeamSettings | null> => {
    const { data, error } = await client
      .from('team_settings')
      .select('team_id, season_start')
      .eq('team_id', team_id)
      .maybeSingle()
    if (error) throw error
    return (data as TeamSettings) ?? null
  }

  return { get }
}
