import type { Database } from '~/types/database'

export type ActiveCategory = {
  id: string
  name: string
  sort_order: number
  value_min: number
  value_max: number
}

export const useCategories = () => {
  const client = useSupabaseClient<Database>()

  const listActive = async (team_id: string): Promise<ActiveCategory[]> => {
    const { data, error } = await client
      .from('point_categories')
      .select('id, name, sort_order, value_min, value_max')
      .eq('team_id', team_id)
      .eq('active', true)
      .order('sort_order', { ascending: true })
    if (error) throw error
    return (data ?? []) as ActiveCategory[]
  }

  return { listActive }
}
