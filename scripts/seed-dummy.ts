/**
 * Idempotent dummy-seed for local development.
 *
 * Fills every existing team with a set of active players and point
 * categories, only inserting rows that don't exist yet. Uses the Supabase
 * service role — never run this against a production database.
 *
 * Usage:
 *   pnpm db:seed:dummy               # seed all teams
 *   pnpm db:seed:dummy -- --slug=xy  # seed only the team with slug=xy
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY missing (.env).')
  process.exit(1)
}

let targetUrl: URL
try {
  targetUrl = new URL(SUPABASE_URL)
} catch {
  console.error('SUPABASE_URL is not a valid URL.')
  process.exit(1)
}

const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
if (!localHosts.has(targetUrl.hostname) && process.env.ALLOW_REMOTE_DUMMY_SEED !== 'true') {
  console.error(
    'Refusing to seed a remote Supabase project. Set ALLOW_REMOTE_DUMMY_SEED=true to override.',
  )
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const args = process.argv.slice(2)
const slugArg = args.find((a) => a.startsWith('--slug='))?.slice('--slug='.length)

const PLAYER_TEMPLATE = [
  { name: 'Alice Anker', jersey_number: 7, position: 'ST', photo_consent: true },
  { name: 'Bruno Bereit', jersey_number: 10, position: 'MF', photo_consent: false },
  { name: 'Chiara Cool', jersey_number: 3, position: 'DF', photo_consent: true },
  { name: 'Dario Dribble', jersey_number: 22, position: 'MF', photo_consent: true },
  { name: 'Emma Elfmeter', jersey_number: 1, position: 'TW', photo_consent: true },
  { name: 'Finn Flanke', jersey_number: null, position: 'AV', photo_consent: false },
]

const CATEGORY_TEMPLATE = [
  { name: 'Einsatz', sort_order: 1, value_min: 0, value_max: 5 },
  { name: 'Technik', sort_order: 2, value_min: 0, value_max: 5 },
  { name: 'Zweikampf', sort_order: 3, value_min: 0, value_max: 5 },
  { name: 'Fair Play', sort_order: 4, value_min: -3, value_max: 3 },
]

type TeamRow = { id: string; slug: string; name: string }

const listTeams = async (): Promise<TeamRow[]> => {
  const q = admin.from('teams').select('id, slug, name')
  const { data, error } = slugArg ? await q.eq('slug', slugArg) : await q
  if (error) throw error
  return (data ?? []) as TeamRow[]
}

const seedPlayers = async (team: TeamRow): Promise<number> => {
  const { data: existing, error } = await admin
    .from('players')
    .select('name')
    .eq('team_id', team.id)
  if (error) throw error
  const known = new Set((existing ?? []).map((r) => (r as { name: string }).name.toLowerCase()))
  const toInsert = PLAYER_TEMPLATE.filter((p) => !known.has(p.name.toLowerCase())).map((p) => ({
    team_id: team.id,
    ...p,
  }))
  if (toInsert.length === 0) return 0
  const { error: insertError } = await admin.from('players').insert(toInsert)
  if (insertError) throw insertError
  return toInsert.length
}

const seedCategories = async (team: TeamRow): Promise<number> => {
  const { data: existing, error } = await admin
    .from('point_categories')
    .select('name')
    .eq('team_id', team.id)
  if (error) throw error
  const known = new Set((existing ?? []).map((r) => (r as { name: string }).name.toLowerCase()))
  const toInsert = CATEGORY_TEMPLATE.filter((c) => !known.has(c.name.toLowerCase())).map((c) => ({
    team_id: team.id,
    active: true,
    ...c,
  }))
  if (toInsert.length === 0) return 0
  const { error: insertError } = await admin.from('point_categories').insert(toInsert)
  if (insertError) throw insertError
  return toInsert.length
}

const main = async () => {
  const teams = await listTeams()
  if (teams.length === 0) {
    console.log(
      slugArg
        ? `No team with slug=${slugArg} found. Create one first (via /start).`
        : 'No teams found. Create one via /start first.',
    )
    return
  }

  for (const team of teams) {
    const [addedPlayers, addedCategories] = await Promise.all([
      seedPlayers(team),
      seedCategories(team),
    ])
    console.log(
      `Team ${team.slug} (${team.name}): +${addedPlayers} players, +${addedCategories} categories`,
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
