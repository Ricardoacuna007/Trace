import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TraceConfig } from '../lib/db'
import type { AppNode } from '../types/workspace'
import { DEFAULT_TRACE_CONFIG_JSON } from './defaults'
import { useTraceStore } from './useTraceStore'

const dbMocks = vi.hoisted(() => ({
  addNoteRelation: vi.fn(),
  ignoreConnectionSuggestion: vi.fn(),
  listIgnoredSuggestions: vi.fn(),
  removeNoteRelation: vi.fn(),
  saveVaultCustomization: vi.fn(),
}))

function parseMockTraceConfig(configJson: string): TraceConfig {
  const fallback: TraceConfig = {
    theme: 'dark',
    accent_color: '#5e8bff',
    font_family: 'DM Sans',
    editor_width: 'centered',
    editor: {
      font_size: 15,
      line_height: 1.75,
      block_spacing: 8,
      max_width: 980,
    },
    graph: {
      orphan_color: '#f87171',
      bridge_color: '#f59e0b',
      cluster_colors: ['#5e8bff', '#4ade80', '#f59e0b', '#f87171', '#a78bfa', '#22d3ee'],
      show_labels: true,
      node_scale: 1,
    },
    vim_mode: false,
    pinned_note_ids: [],
    layout: {
      sidebar_position: 'left',
      right_panel: 'visible',
      visible_elements: {
        breadcrumb: true,
        metabar: true,
        word_count: true,
        modified_at: true,
        titlebar: true,
        traffic_lights: true,
      },
    },
    ui_modules: {
      show_breadcrumbs: true,
      show_backlinks: true,
      show_node_icons: true,
      enable_autosave: true,
    },
  }

  try {
    const parsed = JSON.parse(configJson || '{}') as Partial<TraceConfig>
    return {
      ...fallback,
      ...parsed,
      ui_modules: {
        ...fallback.ui_modules,
        ...(parsed.ui_modules ?? {}),
      },
      editor: {
        ...fallback.editor,
        ...(parsed.editor ?? {}),
      },
      graph: {
        ...fallback.graph,
        ...(parsed.graph ?? {}),
      },
      layout: {
        ...fallback.layout,
        ...(parsed.layout ?? {}),
        visible_elements: {
          ...fallback.layout.visible_elements,
          ...(parsed.layout?.visible_elements ?? {}),
        },
      },
      pinned_note_ids: Array.isArray(parsed.pinned_note_ids) ? parsed.pinned_note_ids : [],
    }
  } catch {
    return fallback
  }
}

vi.mock('../lib/db', () => ({
  addNoteRelation: dbMocks.addNoteRelation,
  changeNodeIcon: vi.fn(),
  commitNoteDraftSnapshot: vi.fn(),
  createNode: vi.fn(),
  deleteNode: vi.fn(),
  exportCurrentNoteMarkdown: vi.fn(),
  exportVaultMarkdown: vi.fn(),
  getActiveVault: vi.fn(),
  getCurrentVaultPath: vi.fn(),
  getNoteBacklinks: vi.fn(),
  importMarkdownDirectory: vi.fn(),
  ignoreConnectionSuggestion: dbMocks.ignoreConnectionSuggestion,
  listIgnoredSuggestions: dbMocks.listIgnoredSuggestions,
  listNodeRelations: vi.fn(),
  listNodes: vi.fn(),
  listNoteRelations: vi.fn(),
  moveNode: vi.fn(),
  parseTraceConfig: parseMockTraceConfig,
  persistNote: vi.fn(),
  readVaultCustomization: vi.fn(),
  removeNoteRelation: dbMocks.removeNoteRelation,
  renameNode: vi.fn(),
  saveVaultCustomization: dbMocks.saveVaultCustomization,
  scanMarkdownDatabase: vi.fn(),
  searchNotesGlobal: vi.fn(),
  setActiveVault: vi.fn(),
  updateMarkdownFrontmatterProperty: vi.fn(),
  updateNoteContent: vi.fn(),
  updateNoteTags: vi.fn(),
  updateNoteTitle: vi.fn(),
}))

function note(id: string, title: string): AppNode {
  return {
    id,
    title,
    type: 'note',
    parentId: 'workspace-1',
    content: '[]',
    inbox: false,
    position: 0,
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function resetStore() {
  useTraceStore.setState({
    activeVaultPath: 'C:\\vault',
    connections: [],
    customCss: '',
    error: null,
    noteRelations: [],
    nodes: [
      {
        id: 'workspace-1',
        title: 'Workspace',
        type: 'workspace',
        parentId: null,
        inbox: false,
        position: 0,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      note('note-a', 'Alpha'),
      note('note-b', 'Beta'),
    ],
    notes: [
      note('note-a', 'Alpha') as AppNode & { type: 'note'; content: string },
      note('note-b', 'Beta') as AppNode & { type: 'note'; content: string },
    ],
    ignoredSuggestionPairs: [],
    pinnedNoteIds: [],
    recentConnectionIds: [],
    traceConfigJson: DEFAULT_TRACE_CONFIG_JSON,
    traceDir: 'C:\\vault\\.trace',
    vaultRequired: false,
  })
}

describe('useTraceStore frontend workspace actions', () => {
  beforeEach(() => {
    dbMocks.addNoteRelation.mockReset()
    dbMocks.addNoteRelation.mockResolvedValue(undefined)
    dbMocks.ignoreConnectionSuggestion.mockReset()
    dbMocks.ignoreConnectionSuggestion.mockResolvedValue(undefined)
    dbMocks.removeNoteRelation.mockReset()
    dbMocks.removeNoteRelation.mockResolvedValue(undefined)
    dbMocks.listIgnoredSuggestions.mockReset()
    dbMocks.saveVaultCustomization.mockReset()
    dbMocks.saveVaultCustomization.mockImplementation(async (configJson: string, customCss: string) => ({
      traceDir: 'C:\\vault\\.trace',
      configJson,
      customCss,
    }))
    resetStore()
  })

  it('connectNotes creates bidirectional local relations without duplicates', async () => {
    await useTraceStore.getState().connectNotes('note-a', ['note-b', 'note-b', 'note-a', ''])

    expect(dbMocks.addNoteRelation).toHaveBeenCalledTimes(2)
    expect(dbMocks.addNoteRelation).toHaveBeenCalledWith('note-a', 'note-b')
    expect(dbMocks.addNoteRelation).toHaveBeenCalledWith('note-b', 'note-a')
    expect(useTraceStore.getState().noteRelations).toEqual([
      { sourceId: 'note-a', targetId: 'note-b' },
      { sourceId: 'note-b', targetId: 'note-a' },
    ])
    expect(useTraceStore.getState().recentConnectionIds).toEqual(['note-b'])
  })

  it('disconnectNotes removes bidirectional local relations', async () => {
    useTraceStore.setState({
      noteRelations: [
        { sourceId: 'note-a', targetId: 'note-b' },
        { sourceId: 'note-b', targetId: 'note-a' },
        { sourceId: 'note-b', targetId: 'note-c' },
      ],
      connections: [
        { sourceId: 'note-a', targetId: 'note-b' },
        { sourceId: 'note-b', targetId: 'note-a' },
        { sourceId: 'note-b', targetId: 'note-c' },
      ],
      recentConnectionIds: ['note-b'],
    })

    await useTraceStore.getState().disconnectNotes('note-a', 'note-b')

    expect(dbMocks.removeNoteRelation).toHaveBeenCalledTimes(2)
    expect(dbMocks.removeNoteRelation).toHaveBeenCalledWith('note-a', 'note-b')
    expect(dbMocks.removeNoteRelation).toHaveBeenCalledWith('note-b', 'note-a')
    expect(useTraceStore.getState().noteRelations).toEqual([
      { sourceId: 'note-b', targetId: 'note-c' },
    ])
    expect(useTraceStore.getState().recentConnectionIds).toEqual([])
  })

  it('ignoreConnectionSuggestion stores bidirectional ignored pairs', async () => {
    await useTraceStore.getState().ignoreConnectionSuggestion('note-a', 'note-b')

    expect(dbMocks.ignoreConnectionSuggestion).toHaveBeenCalledTimes(2)
    expect(dbMocks.ignoreConnectionSuggestion).toHaveBeenCalledWith('note-a', 'note-b')
    expect(dbMocks.ignoreConnectionSuggestion).toHaveBeenCalledWith('note-b', 'note-a')
    expect(useTraceStore.getState().ignoredSuggestionPairs).toEqual([
      'note-a->note-b',
      'note-b->note-a',
    ])
  })

  it('persists pinned note ids into trace config', async () => {
    useTraceStore.getState().pinNote('note-a')
    await vi.waitFor(() => {
      expect(dbMocks.saveVaultCustomization).toHaveBeenCalled()
    })

    const [configJson] = dbMocks.saveVaultCustomization.mock.calls[0] as [string, string]
    expect(JSON.parse(configJson)).toMatchObject({
      pinned_note_ids: ['note-a'],
    })
    expect(useTraceStore.getState().pinnedNoteIds).toEqual(['note-a'])
  })
})
