export function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    if (typeof record.message === 'string' && record.message.length > 0) {
      return record.message
    }
    try {
      return JSON.stringify(record)
    } catch {
      return 'Unknown object error'
    }
  }
  return 'Unexpected error'
}
