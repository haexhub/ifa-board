import type { Database } from '~/types/database'

export type ActiveCategory = {
  id: string
  name: string
  sort_order: number
  value_min: number
  value_max: number
}

export type Category = ActiveCategory & { active: boolean }

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

  const listAll = async (team_id: string): Promise<Category[]> => {
    const { data, error } = await client
      .from('point_categories')
      .select('id, name, active, sort_order, value_min, value_max')
      .eq('team_id', team_id)
      .order('sort_order', { ascending: true })
    if (error) throw error
    return (data ?? []) as Category[]
  }

  const create = async (
    team_id: string,
    payload: { name: string; value_min: number; value_max: number; sort_order: number; active: boolean },
  ) => {
    const { data, error } = await client
      .from('point_categories')
      .insert({ team_id, ...payload })
      .select('id')
      .single()
    if (error) throw error
    return data as { id: string }
  }

  const update = async (
    id: string,
    payload: Partial<{ name: string; value_min: number; value_max: number; sort_order: number; active: boolean }>,
  ) => {
    const { error } = await client.from('point_categories').update(payload).eq('id', id)
    if (error) throw error
  }

  const deactivate = async (id: string) => {
    await update(id, { active: false })
  }

  const reorder = async (team_id: string, items: { id: string; sort_order: number }[]) => {
    for (const item of items) {
      const { error } = await client
        .from('point_categories')
        .update({ sort_order: item.sort_order })
        .eq('id', item.id)
        .eq('team_id', team_id)
      if (error) throw error
    }
  }

  const hasEntries = async (category_id: string): Promise<boolean> => {
    const { count, error } = await client
      .from('point_entries')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', category_id)
    if (error) throw error
    return (count ?? 0) > 0
  }

  const remove = async (id: string) => {
    const { error } = await client.from('point_categories').delete().eq('id', id)
    if (error) throw error
  }

  return { listActive, listAll, create, update, deactivate, reorder, hasEntries, remove }
}
