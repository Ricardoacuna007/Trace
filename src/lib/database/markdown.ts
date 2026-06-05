import { invoke } from '@tauri-apps/api/core'
import { isTauriRuntime, nowIso } from './runtime'
import type { ImportSummary, MarkdownDbRow, MarkdownDbSnapshot } from './types'

export async function exportCurrentNoteMarkdown(noteId: string, outputDir: string): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error('Exportacion disponible solo en Tauri.')
  }
  return invoke<string>('export_note_markdown', { noteId, outputDir })
}

export async function exportVaultMarkdown(outputDir: string): Promise<number> {
  if (!isTauriRuntime()) {
    throw new Error('Exportacion disponible solo en Tauri.')
  }
  return invoke<number>('export_vault_markdown', { outputDir })
}

export async function importMarkdownDirectory(sourceDir: string): Promise<ImportSummary> {
  if (!isTauriRuntime()) {
    throw new Error('Importacion disponible solo en Tauri.')
  }
  return invoke<ImportSummary>('import_markdown_directory', { sourceDir })
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return value as Record<string, unknown>
}

export async function scanMarkdownDatabase(): Promise<MarkdownDbSnapshot> {
  if (!isTauriRuntime()) {
    return {
      vaultPath: '',
      indexedFiles: 0,
      columns: [],
      rows: [],
      generatedAt: nowIso(),
    }
  }

  const snapshot = await invoke<MarkdownDbSnapshot>('scan_markdown_database')
  return {
    ...snapshot,
    columns: Array.isArray(snapshot.columns) ? snapshot.columns : [],
    rows: Array.isArray(snapshot.rows)
      ? snapshot.rows.map((row) => ({
        ...row,
        properties: toRecord(row.properties),
      }))
      : [],
  }
}

export async function updateMarkdownFrontmatterProperty(
  filePath: string,
  key: string,
  value: unknown,
): Promise<MarkdownDbRow> {
  if (!isTauriRuntime()) {
    throw new Error('Edicion Markdown disponible solo en Tauri.')
  }

  const row = await invoke<MarkdownDbRow>('update_markdown_frontmatter_property', {
    filePath,
    key,
    value: value ?? null,
  })

  return {
    ...row,
    properties: toRecord(row.properties),
  }
}
