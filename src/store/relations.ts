import type { ExplicitNoteRelation } from '../features/notes-graph/graph'
import type { NoteRelation } from './types'

export function normalizeRelations(rows: Array<{ source_id: string; target_id: string }>): NoteRelation[] {
  return rows.map((row) => ({
    sourceId: row.source_id,
    targetId: row.target_id,
  }))
}

export function toExplicitRelations(relations: NoteRelation[]): ExplicitNoteRelation[] {
  return relations.map((relation) => ({
    sourceId: relation.sourceId,
    targetId: relation.targetId,
  }))
}
