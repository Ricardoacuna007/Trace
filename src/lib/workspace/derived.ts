import type { Note } from '../../types/note'
import type { AppNode } from '../../types/workspace'

export function notesFromNodes(nodes: AppNode[]): Note[] {
  return nodes.filter((node): node is Note => (
    node.type === 'note' && typeof node.content === 'string'
  ))
}

export function activeViewFromMode(mode: string): 'editor' | 'graph' | 'workspace' {
  if (mode === 'graph') {
    return 'graph'
  }
  if (mode === 'workspace') {
    return 'workspace'
  }
  return 'editor'
}
