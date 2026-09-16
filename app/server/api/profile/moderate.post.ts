import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import type { Database } from '~/types/database'
import { useAdminDb, schema } from '~/server/utils/db'

const bodySchema = z.object({
  target_user_id: z.string().uuid(),
  team_id: z.string().uuid(),
  field: z.enum(['name', 'avatar']),
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  }
  const { target_user_id, team_id, field } = parsed.data

  const db = useAdminDb()

  const [caller] = await db
    .select({ role: schema.memberships.role })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.teamId, team_id), eq(schema.memberships.userId, user.id)))
    .limit(1)
  if (!caller || caller.role !== 'trainer') {
    throw createError({ statusCode: 403, statusMessage: 'Only trainers of the team may moderate' })
  }

  const [target] = await db
    .select({ userId: schema.memberships.userId })
    .from(schema.memberships)
    .where(
      and(eq(schema.memberships.teamId, team_id), eq(schema.memberships.userId, target_user_id)),
    )
    .limit(1)
  if (!target) {
    throw createError({ statusCode: 403, statusMessage: 'Target is not a member of this team' })
  }

  const admin = serverSupabaseServiceRole<Database>(event)

  if (field === 'name') {
    const { data: targetUser, error: getUserErr } = await admin.auth.admin.getUserById(
      target_user_id,
    )
    if (getUserErr || !targetUser.user?.email) {
      throw createError({
        statusCode: 500,
        statusMessage: getUserErr?.message ?? 'Target user not found',
      })
    }
    const defaultName = targetUser.user.email.split('@')[0]
    await db
      .update(schema.userProfiles)
      .set({ displayName: defaultName })
      .where(eq(schema.userProfiles.id, target_user_id))
  } else {
    const [profile] = await db
      .select({ avatarPath: schema.userProfiles.avatarPath })
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.id, target_user_id))
      .limit(1)
    const path = profile?.avatarPath ?? null
    if (path) {
      await db
        .update(schema.userProfiles)
        .set({ avatarPath: null })
        .where(eq(schema.userProfiles.id, target_user_id))
      await admin.storage
        .from('avatars')
        .remove([path])
        .catch(() => undefined)
    }
  }

  return { ok: true }
})
