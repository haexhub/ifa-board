import type { Database } from '~/types/database'

export type ActivePlayer = {
  id: string
  name: string
  jersey_number: number | null
  position: string | null
  photo_consent: boolean
}

export const usePlayers = () => {
  const client = useSupabaseClient<Database>()

  const listActive = async (team_id: string): Promise<ActivePlayer[]> => {
    const { data, error } = await client
      .from('players')
      .select('id, name, jersey_number, position, photo_consent')
      .eq('team_id', team_id)
      .eq('active', true)
    if (error) throw error
    const rows = (data ?? []) as ActivePlayer[]
    return rows.sort((a, b) => {
      const an = a.jersey_number
      const bn = b.jersey_number
      if (an === null && bn === null) return a.name.localeCompare(b.name, 'de')
      if (an === null) return 1
      if (bn === null) return -1
      if (an !== bn) return an - bn
      return a.name.localeCompare(b.name, 'de')
    })
  }

  return { listActive }
}
