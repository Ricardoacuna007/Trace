import { DEFAULT_NOTE_TITLE, EMPTY_NOTE_CONTENT, sanitizeStoredContent } from '../../features/notes-editor/note-utils'
import type { Note } from '../../types/note'
import type { AppNode } from '../../types/workspace'
import {
  createNodeId,
  DEFAULT_ICON_BY_TYPE,
  DEFAULT_WORKSPACE_TITLE,
  getDatabase,
  mapNodeRow,
  nextPositionForParent,
  nowIso,
} from './runtime'
import { parseTags, toStoredTags } from './tags'
import type { NewNodeParams, NodeRow, RelationRow } from './types'

export async function listNodes(): Promise<AppNode[]> {
  const db = await getDatabase()
  const rows = await db.select<NodeRow[]>(
    `SELECT id, title, type, parent_id, content, icon, tags, inbox, position, updated_at
     FROM nodes
     ORDER BY parent_id IS NULL DESC, parent_id, position, updated_at DESC`,
  )
  return rows.map(mapNodeRow)
}

export async function createNode(params: NewNodeParams): Promise<AppNode> {
  const db = await getDatabase()
  const id = createNodeId(params.type)
  const updatedAt = nowIso()
  const parentId = params.parentId ?? null
  const position = await nextPositionForParent(db, parentId)

  const title =
    params.title?.trim()
      ? params.title.trim()
      : params.type === 'workspace'
        ? DEFAULT_WORKSPACE_TITLE
        : params.type === 'folder'
          ? 'Nueva carpeta'
          : DEFAULT_NOTE_TITLE

  const content = params.type === 'note'
    ? sanitizeStoredContent(params.content ?? EMPTY_NOTE_CONTENT)
    : null
  const icon = params.icon ?? DEFAULT_ICON_BY_TYPE[params.type] ?? null
  const tags = params.type === 'note' ? toStoredTags(params.tags ?? []) : '[]'
  const inbox = params.type === 'note' && params.inbox === true

  await db.execute(
    `INSERT INTO nodes (id, title, type, parent_id, content, icon, tags, inbox, position, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [id, title, params.type, parentId, content, icon, tags, inbox ? 1 : 0, position, updatedAt],
  )

  return {
    id,
    title,
    type: params.type,
    parentId,
    content: params.type === 'note' ? content ?? EMPTY_NOTE_CONTENT : undefined,
    icon: icon ?? undefined,
    tags: params.type === 'note' ? parseTags(tags) : undefined,
    inbox,
    position,
    updatedAt,
  }
}

export async function createInboxNote(contentText: string): Promise<AppNode> {
  const lines = contentText.replace(/\r/g, '').split('\n')
  const firstLine = lines.find((line) => line.trim().length > 0)?.trim() ?? DEFAULT_NOTE_TITLE
  const title = firstLine || DEFAULT_NOTE_TITLE
  const blocks = lines.length > 0 ? lines : ['']
  const content = JSON.stringify(blocks.map((line) => ({
    type: 'paragraph',
    content: line,
  })))

  return createNode({
    type: 'note',
    parentId: null,
    title,
    content,
    icon: 'inbox',
    tags: [],
    inbox: true,
  })
}

export async function renameNode(id: string, title: string): Promise<{ updatedAt: string }> {
  const db = await getDatabase()
  const updatedAt = nowIso()
  await db.execute('UPDATE nodes SET title = $1, updated_at = $2 WHERE id = $3', [
    title.trim() || DEFAULT_NOTE_TITLE,
    updatedAt,
    id,
  ])
  return { updatedAt }
}

export async function changeNodeIcon(id: string, icon: string | null): Promise<{ updatedAt: string }> {
  const db = await getDatabase()
  const updatedAt = nowIso()
  await db.execute('UPDATE nodes SET icon = $1, updated_at = $2 WHERE id = $3', [
    icon,
    updatedAt,
    id,
  ])
  return { updatedAt }
}

export async function updateNoteTags(id: string, tags: string[]): Promise<{ updatedAt: string }> {
  const db = await getDatabase()
  const updatedAt = nowIso()
  await db.execute(
    `UPDATE nodes
     SET tags = $1, updated_at = $2
     WHERE id = $3 AND type = 'note'`,
    [toStoredTags(tags), updatedAt, id],
  )
  return { updatedAt }
}

export async function persistNote(
  id: string,
  title: string,
  content: string,
): Promise<{ updatedAt: string }> {
  const db = await getDatabase()
  const updatedAt = nowIso()

  await db.execute(
    `UPDATE nodes
     SET title = $1, content = $2, updated_at = $3
     WHERE id = $4 AND type = 'note'`,
    [title || DEFAULT_NOTE_TITLE, sanitizeStoredContent(content), updatedAt, id],
  )

  return { updatedAt }
}

export async function upsertSyncedNote(note: Note): Promise<void> {
  const db = await getDatabase()
  const parentId = note.parentId && await nodeExists(note.parentId) ? note.parentId : null

  await db.execute(
    `INSERT INTO nodes (id, title, type, parent_id, content, icon, tags, inbox, position, updated_at)
     VALUES ($1, $2, 'note', $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       type = excluded.type,
       parent_id = excluded.parent_id,
       content = excluded.content,
       icon = excluded.icon,
       tags = excluded.tags,
       inbox = excluded.inbox,
       position = excluded.position,
       updated_at = excluded.updated_at`,
    [
      note.id,
      note.title.trim() || DEFAULT_NOTE_TITLE,
      parentId,
      sanitizeStoredContent(note.content),
      note.icon ?? 'note',
      toStoredTags(note.tags ?? []),
      note.inbox ? 1 : 0,
      note.position,
      note.updatedAt,
    ],
  )
}

export async function updateNoteTitle(
  id: string,
  title: string,
): Promise<{ updatedAt: string }> {
  const db = await getDatabase()
  const updatedAt = nowIso()
  await db.execute(
    `UPDATE nodes
     SET title = $1, updated_at = $2
     WHERE id = $3 AND type = 'note'`,
    [title.trim() || DEFAULT_NOTE_TITLE, updatedAt, id],
  )
  return { updatedAt }
}

export async function updateNoteContent(
  id: string,
  content: string,
): Promise<{ updatedAt: string }> {
  const db = await getDatabase()
  const updatedAt = nowIso()
  await db.execute(
    `UPDATE nodes
     SET content = $1, updated_at = $2
     WHERE id = $3 AND type = 'note'`,
    [sanitizeStoredContent(content), updatedAt, id],
  )
  return { updatedAt }
}

export async function commitNoteDraftSnapshot(
  id: string,
  payload: {
    title: string
    content: string
    tags: string[]
    relatedIds: string[]
  },
): Promise<{ updatedAt: string }> {
  const db = await getDatabase()
  const updatedAt = nowIso()
  const normalizedTitle = payload.title.trim() || DEFAULT_NOTE_TITLE
  const normalizedContent = sanitizeStoredContent(payload.content)
  const normalizedTags = toStoredTags(payload.tags)
  const normalizedTargets = Array.from(
    new Set(
      payload.relatedIds
        .map((target) => target.trim())
        .filter((target) => target.length > 0 && target !== id),
    ),
  )

  await db.execute('BEGIN IMMEDIATE TRANSACTION')
  try {
    await db.execute(
      `UPDATE nodes
       SET title = $1, content = $2, tags = $3, updated_at = $4
       WHERE id = $5 AND type = 'note'`,
      [normalizedTitle, normalizedContent, normalizedTags, updatedAt, id],
    )

    await db.execute('DELETE FROM note_relations WHERE source_id = $1', [id])
    for (const targetId of normalizedTargets) {
      await db.execute(
        'INSERT OR IGNORE INTO note_relations (source_id, target_id) VALUES ($1, $2)',
        [id, targetId],
      )
    }

    await db.execute('COMMIT')
  } catch (error) {
    try {
      await db.execute('ROLLBACK')
    } catch {
      // Best effort rollback.
    }
    throw error
  }

  return { updatedAt }
}

export async function moveNode(
  id: string,
  newParentId: string | null,
): Promise<{ position: number; updatedAt: string }> {
  const db = await getDatabase()
  const updatedAt = nowIso()
  const position = await nextPositionForParent(db, newParentId)

  await db.execute(
    `UPDATE nodes
     SET parent_id = $1, inbox = CASE WHEN $1 IS NULL THEN inbox ELSE 0 END, position = $2, updated_at = $3
     WHERE id = $4`,
    [newParentId, position, updatedAt, id],
  )

  return { position, updatedAt }
}

export async function listNoteRelations(): Promise<RelationRow[]> {
  const db = await getDatabase()
  return db.select<RelationRow[]>(
    'SELECT source_id, target_id FROM note_relations',
  )
}

export async function listIgnoredSuggestions(): Promise<RelationRow[]> {
  const db = await getDatabase()
  return db.select<RelationRow[]>(
    'SELECT source_id, target_id FROM ignored_suggestions',
  )
}

export async function addNoteRelation(sourceId: string, targetId: string): Promise<void> {
  const db = await getDatabase()
  await db.execute(
    'INSERT OR IGNORE INTO note_relations (source_id, target_id) VALUES ($1, $2)',
    [sourceId, targetId],
  )
}

export async function ignoreConnectionSuggestion(sourceId: string, targetId: string): Promise<void> {
  const db = await getDatabase()
  await db.execute(
    'INSERT OR IGNORE INTO ignored_suggestions (source_id, target_id) VALUES ($1, $2)',
    [sourceId, targetId],
  )
}

export async function removeNoteRelation(sourceId: string, targetId: string): Promise<void> {
  const db = await getDatabase()
  await db.execute(
    'DELETE FROM note_relations WHERE source_id = $1 AND target_id = $2',
    [sourceId, targetId],
  )
}

export async function deleteNode(id: string): Promise<void> {
  const db = await getDatabase()
  await db.execute('DELETE FROM nodes WHERE id = $1', [id])
}

async function nodeExists(id: string): Promise<boolean> {
  const db = await getDatabase()
  const rows = await db.select<Array<{ count: number }>>(
    'SELECT COUNT(*) AS count FROM nodes WHERE id = $1',
    [id],
  )
  return (rows[0]?.count ?? 0) > 0
}
