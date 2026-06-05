export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    const message = record.message
    if (typeof message === 'string' && message.length > 0) {
      return message
    }
    try {
      return JSON.stringify(record)
    } catch {
      return 'unknown object error'
    }
  }

  return 'unknown error'
}
