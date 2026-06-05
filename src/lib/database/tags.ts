export function parseTags(rawTags: string | null | undefined): string[] {
  if (!rawTags || rawTags.trim().length === 0) {
    return []
  }

  try {
    const parsed = JSON.parse(rawTags)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed
      .filter((tag): tag is string => typeof tag === 'string')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
  } catch {
    return []
  }
}

export function toStoredTags(tags: string[]): string {
  const normalized = tags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
  return JSON.stringify(normalized)
}
