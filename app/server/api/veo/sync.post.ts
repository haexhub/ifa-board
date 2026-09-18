import { eq, sql } from 'drizzle-orm'
import { schema, useAdminDb } from '~/server/utils/db'
import { getAccessToken } from '~/server/utils/veo/auth'
import { fetchAnalysisStats, listMatches, type VeoMatchListItem } from '~/server/utils/veo/client'
import { mapAnalysisStatsToRows } from '~/server/utils/veo/mapStats'

type Db = ReturnType<typeof useAdminDb>
type TeamMapping = typeof schema.veoTeamMappings.$inferSelect

const touchAttempt = (db: Db, teamId: string) =>
  db
    .insert(schema.veoSyncStatus)
    .values({ teamId, lastAttemptAt: new Date() })
    .onConflictDoUpdate({
      target: schema.veoSyncStatus.teamId,
      set: { lastAttemptAt: new Date() },
    })

const recordSuccess = (db: Db, teamId: string) =>
  db
    .update(schema.veoSyncStatus)
    .set({ lastSuccessAt: new Date(), consecutiveFailures: 0, lastError: null })
    .where(eq(schema.veoSyncStatus.teamId, teamId))

const recordFailure = (db: Db, teamId: string, error: unknown) =>
  db
    .update(schema.veoSyncStatus)
    .set({
      consecutiveFailures: sql`${schema.veoSyncStatus.consecutiveFailures} + 1`,
      lastError: error instanceof Error ? error.message : String(error),
    })
    .where(eq(schema.veoSyncStatus.teamId, teamId))

const upsertMatch = async (db: Db, teamId: string, match: VeoMatchListItem) => {
  const values = {
    teamId,
    veoMatchId: match.identifier,
    playedAt: new Date(match.start),
    opponentName: match.opponent_team_name,
    ownScore: match.info.stats.score_aggregated.own,
    opponentScore: match.info.stats.score_aggregated.opponent,
    homeOrAway: match.own_team_home_or_away,
  }
  const [row] = await db
    .insert(schema.veoMatches)
    .values(values)
    .onConflictDoUpdate({
      target: schema.veoMatches.veoMatchId,
      set: { ...values, lastSyncedAt: new Date() },
    })
    .returning({ id: schema.veoMatches.id })
  if (!row) throw new Error(`Upsert of veo_matches for ${match.identifier} returned no row`)
  return row.id
}

const upsertStats = async (db: Db, rows: ReturnType<typeof mapAnalysisStatsToRows>) => {
  for (const row of rows) {
    await db
      .insert(schema.veoMatchStats)
      .values(row)
      .onConflictDoUpdate({
        target: [
          schema.veoMatchStats.matchId,
          schema.veoMatchStats.teamAssociation,
          schema.veoMatchStats.statType,
        ],
        set: { category: row.category, value: row.value, periodValues: row.periodValues },
      })
  }
}

const syncTeam = async (db: Db, mapping: TeamMapping) => {
  await touchAttempt(db, mapping.teamId)
  try {
    const accessToken = await getAccessToken(mapping.teamId)
    const matches = await listMatches(accessToken, {
      veoClubSlug: mapping.veoClubSlug,
      veoTeamSlug: mapping.veoTeamSlug,
    })
    // FR-007: a match without completed Veo analysis is skipped, not an error.
    const analyzable = matches.filter((m) => m.has_analytics_enabled)

    for (const match of analyzable) {
      const matchId = await upsertMatch(db, mapping.teamId, match)
      const statsPayload = await fetchAnalysisStats(accessToken, {
        veoTeamId: match.team__id,
        veoMatchIds: [match.identifier],
      })
      await upsertStats(db, mapAnalysisStatsToRows(statsPayload, matchId))
    }

    await recordSuccess(db, mapping.teamId)
    return { teamId: mapping.teamId, ok: true, matches: analyzable.length }
  } catch (err) {
    await recordFailure(db, mapping.teamId, err)
    return { teamId: mapping.teamId, ok: false }
  }
}

export default defineEventHandler(async (event) => {
  const expected = `Bearer ${useRuntimeConfig().veoSyncSecret}`
  if (getHeader(event, 'authorization') !== expected) {
    throw createError({ statusCode: 401, statusMessage: 'Not authorized' })
  }

  const db = useAdminDb()
  const mappings = await db
    .select()
    .from(schema.veoTeamMappings)
    .where(eq(schema.veoTeamMappings.enabled, true))

  const results = []
  for (const mapping of mappings) {
    results.push(await syncTeam(db, mapping))
  }
  return { synced: results }
})
