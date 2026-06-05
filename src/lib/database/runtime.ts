import { invoke } from '@tauri-apps/api/core'
import Database from '@tauri-apps/plugin-sql'
import { DEFAULT_NOTE_TITLE, sanitizeStoredContent } from '../../features/notes-editor/note-utils'
import type { AppNode, NodeType } from '../../types/workspace'
import { toErrorMessage } from './errors'
import { parseTags } from './tags'
import type { ActiveVaultInfo, LegacyNoteRow, NodeRow } from './types'

export const DEFAULT_WORKSPACE_TITLE = 'Workspace'
export const DEFAULT_ICON_BY_TYPE: Record<NodeType, string> = {
  workspace: 'workspace',
  folder: 'folder',
  note: 'note',
}

let dbPromise: Promise<Database> | null = null
let currentDbUrl: string | null = null
let currentVaultPath: string | null = null

function stripWindowsVerbatimPrefix(path: string): string {
  if (path.startsWith('\\\\?\\UNC\\')) {
    return `\\\\${path.slice('\\\\?\\UNC\\'.length)}`
  }
  if (path.startsWith('\\\\?\\')) {
    return path.slice('\\\\?\\'.length)
  }
  if (path.startsWith('\\??\\')) {
    return path.slice('\\??\\'.length)
  }
  return path
}

function sanitizeSqliteDbUrl(dbUrl: string): string {
  if (!dbUrl.startsWith('sqlite:')) {
    return dbUrl
  }

  const rawPath = dbUrl.slice('sqlite:'.length)
  const normalizedPath = stripWindowsVerbatimPrefix(rawPath)
  return `sqlite:${normalizedPath}`
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function createNodeId(prefix: NodeType | 'node'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function mapNodeRow(row: NodeRow): AppNode {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    parentId: row.parent_id,
    content: row.type === 'note' ? sanitizeStoredContent(row.content) : undefined,
    icon: row.icon ?? undefined,
    tags: row.type === 'note' ? parseTags(row.tags) : undefined,
    position: row.position,
    updatedAt: row.updated_at,
  }
}

function applyVault(vault: ActiveVaultInfo): void {
  currentDbUrl = vault.dbUrl
  currentVaultPath = vault.vaultPath
  dbPromise = null
}

async function closeCurrentConnection(): Promise<void> {
  if (!dbPromise) {
    return
  }
  try {
    const db = await dbPromise
    await db.close()
  } catch {
    // Best effort close before switching vaults.
  } finally {
    dbPromise = null
  }
}

export async function getActiveVault(): Promise<ActiveVaultInfo | null> {
  if (!isTauriRuntime()) {
    return null
  }

  const active = await invoke<ActiveVaultInfo | null>('get_active_vault')
  if (active && active.dbUrl !== currentDbUrl) {
    await closeCurrentConnection()
  }
  if (active) {
    applyVault(active)
  } else {
    await closeCurrentConnection()
    currentDbUrl = null
    currentVaultPath = null
    dbPromise = null
  }

  return active
}

export async function setActiveVault(vaultPath: string): Promise<ActiveVaultInfo> {
  if (!isTauriRuntime()) {
    throw new Error('Vault selection is only available while running inside Tauri.')
  }

  const selected = await invoke<ActiveVaultInfo>('set_active_vault', { vaultPath })
  if (selected.dbUrl !== currentDbUrl) {
    await closeCurrentConnection()
  }
  applyVault(selected)
  return selected
}

export function getCurrentVaultPath(): string | null {
  return currentVaultPath
}

async function migrateLegacyNotesIfNeeded(db: Database): Promise<void> {
  const existingCountRows = await db.select<{ count: number }[]>('SELECT COUNT(*) as count FROM nodes')
  const existingCount = existingCountRows[0]?.count ?? 0
  if (existingCount > 0) {
    return
  }

  const hasLegacyTableRows = await db.select<{ name: string }[]>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='notes'",
  )
  if (hasLegacyTableRows.length === 0) {
    return
  }

  const legacyNotes = await db.select<LegacyNoteRow[]>(
    'SELECT id, title, content, created_at, updated_at FROM notes ORDER BY updated_at DESC, id DESC',
  )
  if (legacyNotes.length === 0) {
    return
  }

  const workspaceId = createNodeId('workspace')
  const createdAt = nowIso()

  await db.execute(
    `INSERT INTO nodes (id, title, type, parent_id, content, icon, tags, position, updated_at)
     VALUES ($1, $2, 'workspace', NULL, NULL, $3, '[]', 0, $4)`,
    [workspaceId, DEFAULT_WORKSPACE_TITLE, DEFAULT_ICON_BY_TYPE.workspace, createdAt],
  )

  for (const [index, legacy] of legacyNotes.entries()) {
    const nodeId = createNodeId('note')
    await db.execute(
      `INSERT INTO nodes (id, title, type, parent_id, content, icon, tags, position, updated_at)
       VALUES ($1, $2, 'note', $3, $4, $5, '[]', $6, $7)`,
      [
        nodeId,
        legacy.title?.trim() ? legacy.title : DEFAULT_NOTE_TITLE,
        workspaceId,
        sanitizeStoredContent(legacy.content),
        DEFAULT_ICON_BY_TYPE.note,
        index,
        legacy.updated_at || createdAt,
      ],
    )
  }
}

async function ensureDefaultWorkspace(db: Database): Promise<void> {
  const workspaceCountRows = await db.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM nodes WHERE type = 'workspace'",
  )
  const workspaceCount = workspaceCountRows[0]?.count ?? 0
  if (workspaceCount > 0) {
    return
  }

  const maxPositionRows = await db.select<{ max_position: number | null }[]>(
    'SELECT MAX(position) as max_position FROM nodes WHERE parent_id IS NULL',
  )
  const nextPosition = (maxPositionRows[0]?.max_position ?? -1) + 1
  const workspaceId = createNodeId('workspace')

  await db.execute(
    `INSERT INTO nodes (id, title, type, parent_id, content, icon, tags, position, updated_at)
     VALUES ($1, $2, 'workspace', NULL, NULL, $3, '[]', $4, $5)`,
    [workspaceId, DEFAULT_WORKSPACE_TITLE, DEFAULT_ICON_BY_TYPE.workspace, nextPosition, nowIso()],
  )
}

async function ensureTagsColumn(db: Database): Promise<void> {
  const columns = await db.select<{ name: string }[]>('PRAGMA table_info(nodes)')
  const hasTags = columns.some((column) => column.name === 'tags')
  if (!hasTags) {
    await db.execute("ALTER TABLE nodes ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'")
  }
}

async function ensureFullTextIndex(db: Database): Promise<void> {
  try {
    await db.execute(`
      CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
        note_id UNINDEXED,
        title,
        content,
        tags,
        tokenize='unicode61 remove_diacritics 2'
      )
    `)

    await db.execute(`
      CREATE TRIGGER IF NOT EXISTS nodes_ai_fts
      AFTER INSERT ON nodes
      WHEN NEW.type = 'note'
      BEGIN
        INSERT INTO nodes_fts (note_id, title, content, tags)
        VALUES (NEW.id, NEW.title, COALESCE(NEW.content, ''), COALESCE(NEW.tags, '[]'));
      END
    `)

    await db.execute(`
      CREATE TRIGGER IF NOT EXISTS nodes_au_fts
      AFTER UPDATE ON nodes
      BEGIN
        DELETE FROM nodes_fts WHERE note_id = OLD.id;
        INSERT INTO nodes_fts (note_id, title, content, tags)
        SELECT NEW.id, NEW.title, COALESCE(NEW.content, ''), COALESCE(NEW.tags, '[]')
        WHERE NEW.type = 'note';
      END
    `)

    await db.execute(`
      CREATE TRIGGER IF NOT EXISTS nodes_ad_fts
      AFTER DELETE ON nodes
      WHEN OLD.type = 'note'
      BEGIN
        DELETE FROM nodes_fts WHERE note_id = OLD.id;
      END
    `)

    await db.execute('DELETE FROM nodes_fts')
    await db.execute(`
      INSERT INTO nodes_fts (note_id, title, content, tags)
      SELECT id, title, COALESCE(content, ''), COALESCE(tags, '[]')
      FROM nodes
      WHERE type = 'note'
    `)
  } catch (error) {
    console.warn('[trace] FTS5 unavailable, fallback search will be used.', error)
  }
}

async function initializeSchema(db: Database): Promise<void> {
  await db.execute('PRAGMA foreign_keys=ON')
  await db.execute('PRAGMA journal_mode=WAL')
  await db.execute('PRAGMA synchronous=NORMAL')

  await db.execute(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('workspace', 'folder', 'note')),
      parent_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
      content TEXT,
      icon TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      position INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  await ensureTagsColumn(db)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS note_relations (
      source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      PRIMARY KEY (source_id, target_id)
    )
  `)

  await db.execute('CREATE INDEX IF NOT EXISTS idx_nodes_parent_position ON nodes(parent_id, position)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_note_relations_source ON note_relations(source_id)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_note_relations_target ON note_relations(target_id)')

  await migrateLegacyNotesIfNeeded(db)
  await ensureDefaultWorkspace(db)
  await ensureFullTextIndex(db)
}

export async function getDatabase(): Promise<Database> {
  if (!isTauriRuntime()) {
    throw new Error('SQLite is only available while running inside Tauri.')
  }
  if (!currentDbUrl) {
    throw new Error('No active vault selected.')
  }

  if (!dbPromise) {
    const dbUrl = sanitizeSqliteDbUrl(currentDbUrl)
    dbPromise = Database.load(dbUrl)
      .then(async (db) => {
        await initializeSchema(db)
        return db
      })
      .catch((error) => {
        dbPromise = null
        throw new Error(`Database.load failed (${dbUrl}): ${toErrorMessage(error)}`)
      })
  }

  try {
    return await dbPromise
  } catch (error) {
    throw new Error(`DB initialization failed: ${toErrorMessage(error)}`)
  }
}

export async function nextPositionForParent(db: Database, parentId: string | null): Promise<number> {
  const query =
    parentId === null
      ? 'SELECT MAX(position) as max_position FROM nodes WHERE parent_id IS NULL'
      : 'SELECT MAX(position) as max_position FROM nodes WHERE parent_id = $1'
  const rows = parentId === null
    ? await db.select<{ max_position: number | null }[]>(query)
    : await db.select<{ max_position: number | null }[]>(query, [parentId])
  return (rows[0]?.max_position ?? -1) + 1
}
