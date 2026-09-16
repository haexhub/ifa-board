import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { useUserDb, schema } from '~/server/utils/db'

const teamIdSchema = z.string().uuid()

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  season_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export default defineEventHandler(async (event) => {
  const teamId = getRouterParam(event, 'team_id')
  if (!teamId || !teamIdSchema.safeParse(teamId).success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid team id' })
  }

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  }

  try {
    return await useUserDb(event, async (tx) => {
      const [team] = await tx
        .update(schema.teams)
        .set({ name: parsed.data.name, slug: parsed.data.slug })
        .where(eq(schema.teams.id, teamId))
        .returning({ id: schema.teams.id })

      if (!team) {
        throw createError({ statusCode: 403, statusMessage: 'Team update is not permitted' })
      }

      const [settings] = await tx
        .update(schema.teamSettings)
        .set({ seasonStart: parsed.data.season_start })
        .where(eq(schema.teamSettings.teamId, teamId))
        .returning({ teamId: schema.teamSettings.teamId })

      if (!settings) {
        throw createError({ statusCode: 500, statusMessage: 'Team settings row is missing' })
      }

      return { slug: parsed.data.slug }
    })
  } catch (err) {
    const error = err as {
      code?: string
      statusCode?: number
      statusMessage?: string
      message?: string
    }
    if (error.statusCode) throw err
    if (error.code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'Slug already taken' })
    }
    throw createError({ statusCode: 500, statusMessage: error.message ?? 'Team update failed' })
  }
})
