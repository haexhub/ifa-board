import { z } from 'zod'
import type { Database } from '~/types/database'

const rankingCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  sort_order: z.number(),
})

export type RankingCategory = z.infer<typeof rankingCategorySchema>

const rankingRowSchema = z.object({
  rank_position: z.number(),
  player_id: z.string(),
  name: z.string(),
  jersey_number: z.number().nullable(),
  scores: z.record(z.string(), z.number()),
})

export type RankingRow = z.infer<typeof rankingRowSchema>

const teamRankingSchema = z.object({
  team_id: z.string(),
  from: z.string(),
  to: z.string(),
  categories: z.array(rankingCategorySchema),
  rows: z.array(rankingRowSchema),
})

export type TeamRanking = z.infer<typeof teamRankingSchema>

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
    const parsed = teamRankingSchema.safeParse(data)
    if (!parsed.success) throw new Error('Ungültiges Ranglistenformat')
    return parsed.data
  }

  return { getTeamRanking }
}
