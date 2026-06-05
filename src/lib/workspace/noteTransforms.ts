import type { Note } from '../../types/note'
import type { AppNode } from '../../types/workspace'

export function asNote(node: AppNode | undefined): Note | null {
  if (!node || node.type !== 'note' || typeof node.content !== 'string') {
    return null
  }
  return node as Note
}
