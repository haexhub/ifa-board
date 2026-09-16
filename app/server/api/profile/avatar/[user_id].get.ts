import { eq } from 'drizzle-orm'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '~/types/database'
import { useUserDb, schema } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const targetUserId = getRouterParam(event, 'user_id')
  if (!targetUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing user_id' })
  }

  // useUserDb throws 401 if there's no session. Running the lookup inside it
  // (role=authenticated + the caller's own JWT claims) means the existing
  // user_profiles_read_team RLS policy decides visibility here too — an
  // empty result is indistinguishable from "not visible", which is exactly
  // the 403 this route wants for that case.
  const row = await useUserDb(event, async (tx) => {
    const [r] = await tx
      .select({ avatarPath: schema.userProfiles.avatarPath })
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.id, targetUserId))
      .limit(1)
    return r ?? null
  })

  if (!row) {
    throw createError({ statusCode: 403, statusMessage: 'Not visible' })
  }
  if (!row.avatarPath) {
    throw createError({ statusCode: 404, statusMessage: 'No avatar' })
  }

  const admin = serverSupabaseServiceRole<Database>(event)
  const { data, error } = await admin.storage.from('avatars').download(row.avatarPath)
  if (error || !data) {
    throw createError({ statusCode: 404, statusMessage: 'Avatar not found' })
  }

  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  setResponseHeader(event, 'Content-Type', data.type || 'application/octet-stream')
  return new Uint8Array(await data.arrayBuffer())
})
