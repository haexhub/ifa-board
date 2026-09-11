import slugify from 'slug'

export const toSlug = (input: string): string => {
  const trimmed = input.trim()
  if (!trimmed) return ''
  return slugify(trimmed, { lower: true, trim: true })
}

export const nextUniqueSlug = async (
  base: string,
  exists: (candidate: string) => boolean | Promise<boolean>,
): Promise<string> => {
  const normalized = toSlug(base)
  if (!normalized) throw new Error('slug base produced empty result')
  let candidate = normalized
  let suffix = 2
  while (await exists(candidate)) {
    candidate = `${normalized}-${suffix}`
    suffix += 1
    if (suffix > 1000) throw new Error('slug suffix search exhausted')
  }
  return candidate
}
