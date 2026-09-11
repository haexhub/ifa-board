import type { Database } from '~/types/database'

export type RankingCategory = {
  id: string
  name: string
  sort_order: number
}

export type RankingRow = {
  rank_position: number
  player_id: string
  name: string
  jersey_number: number | null
  scores: Record<string, number>
}

export type TeamRanking = {
  team_id: string
  from: string
  to: string
  categories: RankingCategory[]
  rows: RankingRow[]
}

export const useRanking = () => {
  const client = useSupabaseClient<Database>()

  const getTeamRanking = async (
    team_id: string,
    from: string,
    to: string,
  ): Promise<TeamRanking> => {
    const { data, error } = await client.rpc('get_team_ranking', {
      p_team: team_id,
      p_from: from,
      p_to: to,
    })
    if (error) throw error
    if (!data) {
      return { team_id, from, to, categories: [], rows: [] }
    }
    return data as unknown as TeamRanking
  }

  return { getTeamRanking }
}
