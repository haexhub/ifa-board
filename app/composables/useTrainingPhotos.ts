import type { Database } from '~/types/database'
import { extensionForMime, photoFileSchema } from '~/utils/validators'

const BUCKET = 'training-photos'
const SIGNED_URL_TTL_SECONDS = 600

export type TrainingPhotoRow = {
  id: string
  training_id: string
  storage_path: string
  content_type: string
  size_bytes: number
  uploaded_by: string
  uploaded_at: string
}

export type TrainingPhotoView = TrainingPhotoRow & { signed_url: string }

export class TrainingPhotoDatabaseError extends Error {
  constructor(
    readonly path: string,
    readonly databaseError: unknown,
    readonly cleanupError: unknown,
  ) {
    const databaseMessage =
      databaseError instanceof Error
        ? databaseError.message
        : 'Foto konnte nicht gespeichert werden'
    const cleanupMessage = cleanupError instanceof Error ? cleanupError.message : ''
    super(
      cleanupError
        ? `${databaseMessage} (Aufräumen fehlgeschlagen: ${cleanupMessage})`
        : databaseMessage,
    )
    this.name = 'TrainingPhotoDatabaseError'
  }
}

const randomUuid = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
    .map((n, i) => {
      const h = n.toString(16).padStart(2, '0')
      if (i === 4 || i === 6 || i === 8 || i === 10) return `-${h}`
      return h
    })
    .join('')
}

export const useTrainingPhotos = () => {
  const client = useSupabaseClient<Database>()
  const user = useSupabaseUser()

  const upload = async (
    training_id: string,
    team_id: string,
    file: File,
  ): Promise<TrainingPhotoRow> => {
    if (!user.value) throw new Error('Not authenticated')
    const parsed = photoFileSchema.safeParse({
      type: file.type,
      size: file.size,
      name: file.name,
    })
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((i) => i.message).join(', '))
    }

    const ext = extensionForMime(file.type)
    const path = `${team_id}/${training_id}/${randomUuid()}.${ext}`

    const { error: uploadError } = await client.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    })
    if (uploadError) throw uploadError

    const { data, error } = await client
      .from('training_photos')
      .insert({
        training_id,
        storage_path: path,
        content_type: file.type,
        size_bytes: file.size,
        uploaded_by: user.value.id,
      })
      .select('*')
      .single()
    if (error) {
      const { error: cleanupError } = await client.storage.from(BUCKET).remove([path])
      throw new TrainingPhotoDatabaseError(path, error, cleanupError)
    }
    return data as TrainingPhotoRow
  }

  const list = async (training_id: string): Promise<TrainingPhotoView[]> => {
    const { data, error } = await client
      .from('training_photos')
      .select('*')
      .eq('training_id', training_id)
      .order('uploaded_at', { ascending: true })
    if (error) throw error
    const rows = (data ?? []) as TrainingPhotoRow[]
    if (rows.length === 0) return []
    const paths = rows.map((r) => r.storage_path)
    const { data: signed, error: signedError } = await client.storage
      .from(BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
    if (signedError) throw signedError
    const byPath = new Map<string, string>()
    for (let i = 0; i < paths.length; i += 1) {
      const s = signed?.[i]
      if (s?.signedUrl) byPath.set(paths[i]!, s.signedUrl)
    }
    return rows.map((r) => ({ ...r, signed_url: byPath.get(r.storage_path) ?? '' }))
  }

  return { upload, list }
}
