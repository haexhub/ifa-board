import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import type { Database } from '~/types/database'
import { useAdminDb, schema } from '~/server/utils/db'

const bodySchema = z.object({
  team_id: z.string().uuid(),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(['trainer', 'player']),
})

const generateToken = () => randomBytes(24).toString('base64url')

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  }
  const { team_id, email, role } = parsed.data

  const db = useAdminDb()

  const [caller] = await db
    .select({ role: schema.memberships.role })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.teamId, team_id), eq(schema.memberships.userId, user.id)))
    .limit(1)

  if (!caller || caller.role !== 'trainer') {
    throw createError({ statusCode: 403, statusMessage: 'Only trainers of the team may invite' })
  }

  const token = generateToken()

  let invitationId: string
  try {
    const result = await db.transaction(async (tx) => {
      await tx
        .delete(schema.invitations)
        .where(
          and(
            eq(schema.invitations.teamId, team_id),
            sql`lower(${schema.invitations.email}) = ${email}`,
            isNull(schema.invitations.acceptedAt),
            sql`${schema.invitations.expiresAt} <= now()`,
          ),
        )

      const [inserted] = await tx
        .insert(schema.invitations)
        .values({
          teamId: team_id,
          email,
          role,
          token,
          invitedBy: user.id,
        })
        .returning({ id: schema.invitations.id })
      if (!inserted) throw new Error('Invitation insert returned no row')
      return inserted
    })
    invitationId = result.id
  } catch (err) {
    const e = err as { code?: string; message?: string }
    if (e.code === '23505') {
      throw createError({
        statusCode: 409,
        statusMessage: 'An open invitation for this email already exists',
      })
    }
    throw createError({ statusCode: 500, statusMessage: e.message ?? 'Invitation insert failed' })
  }

  const origin = getRequestURL(event).origin
  const admin = serverSupabaseServiceRole<Database>(event)
  const { error: mailErr } = await admin.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origin}/callback?redirect=${encodeURIComponent(`/invite/${token}`)}`,
    },
  })
  if (mailErr) {
    await db.delete(schema.invitations).where(eq(schema.invitations.id, invitationId))
    throw createError({ statusCode: 500, statusMessage: mailErr.message })
  }

  return { id: invitationId }
})
