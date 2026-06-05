import type { Block } from '@blocknote/core'
import { Suspense, lazy } from 'react'
import type { NoteGraphData } from '../../features/notes-graph/graph'
import type { MarkdownDbSnapshot, NoteBacklink, TraceUIModules } from '../../lib/db'
import type { AppViewMode, NoteRelation, SaveStatus, ViewMode } from '../../store/types'
import type { Note } from '../../types/note'
import type { AppNode, TreeNode as WorkspaceTreeNode } from '../../types/workspace'
import { ConnectNoteModal } from './ConnectNoteModal'
import { EditorLayout } from './EditorLayout'
import { NoteHeader } from './NoteHeader'
import { NoteMetaBar } from './NoteMetaBar'
import { Sidebar } from './Sidebar'
import { TitleBar } from './TitleBar'
import { WorkspaceView } from './WorkspaceView'

const LazyGraphView = lazy(async () => {
  const module = await import('./GraphView')
  return { default: module.GraphView }
})

const LazyMarkdownDatabaseView = lazy(async () => {
  const module = await import('../../features/markdown-database/MarkdownDatabaseView')
  return { default: module.MarkdownDatabaseView }
})

const LazySettingsView = lazy(async () => {
  const module = await import('../../features/settings/SettingsView')
  return { default: module.SettingsView }
})

interface AppShellProps {
  activeVaultPath: string | null
  activeView: AppViewMode
  backlinks: NoteBacklink[]
  breadcrumbs: AppNode[]
  customCss: string
  customizationLoading: boolean
  customizationSaving: boolean
  editorWidth: 'full' | 'centered'
  graphData: NoteGraphData
  hasPendingChanges: boolean
  isBacklinksPanelOpen: boolean
  ioMessage: string | null
  ioWorking: boolean
  isPropertiesPanelOpen: boolean
  isSidebarOpen: boolean
  markdownDbLoading: boolean
  markdownDbSnapshot: MarkdownDbSnapshot | null
  nodeTree: WorkspaceTreeNode[]
  nodes: AppNode[]
  noteRelations: NoteRelation[]
  pinnedNoteIds: string[]
  recentConnectionIds: string[]
  saveStatus: SaveStatus
  selectedNodeId: string | null
  selectedNote: Note | null
  traceConfigJson: string
  traceDir: string | null
  uiModules: TraceUIModules
  viewMode: ViewMode
  onContentChange: (noteId: string, blocks: Block[]) => void
  onCreateFolder: () => void
  onCreateNote: () => void
  onExportCurrentNoteMarkdown: () => void
  onExportVaultMarkdown: () => void
  onImportMarkdown: () => void
  onOpenCommandPalette: () => void
  onOpenConnectModal: () => void
  onOpenNode: (id: string) => void
  onOpenNodeFromGraph: (noteId: string) => void
  onOpenWikiLink: (title: string) => void
  onPinNote: (noteId: string) => void
  onPrintCurrentNote: () => void
  onRefreshMarkdownDatabase: () => void
  onReloadCustomization: () => void
  onSaveCustomization: (configJson: string, customCss: string) => void
  onSetActiveView: (view: AppViewMode) => void
  onSetEditorWidth: (width: 'full' | 'centered') => void
  onTitleChange: (noteId: string, title: string) => void
  onToggleModule: (module: keyof TraceUIModules, enabled: boolean) => void
  onUnpinNote: (noteId: string) => void
  onUpdateMarkdownProperty: (filePath: string, key: string, value: unknown) => void
}

function StatusDot({ hasPendingChanges, saveStatus }: { hasPendingChanges: boolean; saveStatus: SaveStatus }) {
  const label = saveStatus === 'saving'
    ? 'guardando'
    : saveStatus === 'saved'
      ? 'guardado'
      : saveStatus === 'error'
        ? 'error'
        : hasPendingChanges
          ? 'pendiente'
          : 'estable'
  const color = saveStatus === 'error'
    ? 'bg-[var(--red)]'
    : saveStatus === 'saving' || hasPendingChanges
      ? 'bg-[var(--amber)]'
      : 'bg-[var(--green)]'

  return (
    <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg2)] px-2 py-1 font-mono text-[10px] text-[var(--t3)]">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </div>
  )
}

function ViewFallback({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-1 items-center justify-center bg-[var(--bg)] font-mono text-[11px] text-[var(--t3)]">
      {label}
    </div>
  )
}

export function AppShell({
  activeVaultPath,
  activeView,
  backlinks,
  breadcrumbs,
  customCss,
  customizationLoading,
  customizationSaving,
  editorWidth,
  graphData,
  hasPendingChanges,
  isBacklinksPanelOpen,
  ioMessage,
  ioWorking,
  isPropertiesPanelOpen,
  isSidebarOpen,
  markdownDbLoading,
  markdownDbSnapshot,
  nodeTree,
  nodes,
  noteRelations,
  pinnedNoteIds,
  recentConnectionIds,
  saveStatus,
  selectedNodeId,
  selectedNote,
  traceConfigJson,
  traceDir,
  uiModules,
  viewMode,
  onContentChange,
  onCreateFolder,
  onCreateNote,
  onExportCurrentNoteMarkdown,
  onExportVaultMarkdown,
  onImportMarkdown,
  onOpenCommandPalette,
  onOpenConnectModal,
  onOpenNode,
  onOpenNodeFromGraph,
  onOpenWikiLink,
  onPinNote,
  onPrintCurrentNote,
  onRefreshMarkdownDatabase,
  onReloadCustomization,
  onSaveCustomization,
  onSetActiveView,
  onSetEditorWidth,
  onTitleChange,
  onToggleModule,
  onUnpinNote,
  onUpdateMarkdownProperty,
}: AppShellProps) {
  const pinned = selectedNote ? pinnedNoteIds.includes(selectedNote.id) : false
  const connectionCount = selectedNote
    ? noteRelations.filter((relation) => relation.sourceId === selectedNote.id).length
    : 0

  return (
    <div className="app-shell flex h-screen flex-col overflow-hidden bg-[var(--bg)] text-[var(--t1)]">
      <TitleBar />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {isSidebarOpen ? (
          <Sidebar
            nodeTree={nodeTree}
            selectedNodeId={selectedNodeId}
            pinnedNoteIds={pinnedNoteIds}
            showNodeIcons={uiModules.show_node_icons}
            onCreateNote={onCreateNote}
            onOpenCommandPalette={onOpenCommandPalette}
            onPinNote={onPinNote}
            onSelectNode={onOpenNode}
            onSetWorkspaceView={() => onSetActiveView('workspace')}
            onUnpinNote={onUnpinNote}
          />
        ) : null}

        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {viewMode === 'settings' ? (
            <Suspense fallback={<ViewFallback label="Cargando configuracion..." />}>
              <LazySettingsView
                vaultPath={activeVaultPath}
                traceDir={traceDir}
                configJson={traceConfigJson}
                customCss={customCss}
                customizationLoading={customizationLoading}
                customizationSaving={customizationSaving}
                ioWorking={ioWorking}
                ioMessage={ioMessage}
                selectedNote={selectedNote}
                editorWidth={editorWidth}
                uiModules={uiModules}
                onReloadCustomization={onReloadCustomization}
                onSaveCustomization={onSaveCustomization}
                onImportMarkdown={onImportMarkdown}
                onExportVaultMarkdown={onExportVaultMarkdown}
                onExportCurrentNoteMarkdown={onExportCurrentNoteMarkdown}
                onPrintCurrentNote={onPrintCurrentNote}
                onSetEditorWidth={onSetEditorWidth}
                onToggleModule={onToggleModule}
              />
            </Suspense>
          ) : viewMode === 'database' ? (
            <Suspense fallback={<ViewFallback label="Cargando base Markdown..." />}>
              <LazyMarkdownDatabaseView
                snapshot={markdownDbSnapshot}
                loading={markdownDbLoading}
                onRefresh={onRefreshMarkdownDatabase}
                onUpdateProperty={onUpdateMarkdownProperty}
              />
            </Suspense>
          ) : activeView === 'graph' ? (
            <Suspense fallback={<ViewFallback label="Cargando grafo..." />}>
              <LazyGraphView
                graph={graphData}
                selectedNoteId={selectedNote?.id ?? null}
                onOpenNote={onOpenNodeFromGraph}
              />
            </Suspense>
          ) : activeView === 'workspace' || !selectedNote ? (
            <WorkspaceView
              activeVaultPath={activeVaultPath}
              nodes={nodes}
              noteRelations={noteRelations}
              onCreateFolder={onCreateFolder}
              onCreateNote={onCreateNote}
              onOpenNote={onOpenNode}
            />
          ) : (
            <>
              {uiModules.show_breadcrumbs ? <NoteHeader breadcrumbs={breadcrumbs} /> : null}
              <NoteMetaBar
                note={selectedNote}
                isPinned={pinned}
                connectionCount={connectionCount}
                onOpenConnectModal={onOpenConnectModal}
              />
              <EditorLayout
                backlinks={backlinks}
                nodes={nodes}
                note={selectedNote}
                noteRelations={noteRelations}
                recentConnectionIds={recentConnectionIds}
                editorWidth={editorWidth}
                showBacklinks={uiModules.show_backlinks && isBacklinksPanelOpen}
                showProperties={isPropertiesPanelOpen}
                onContentChange={onContentChange}
                onOpenWikiLink={onOpenWikiLink}
                onSelectNode={onOpenNode}
                onTitleChange={onTitleChange}
              />
              <StatusDot hasPendingChanges={hasPendingChanges} saveStatus={saveStatus} />
            </>
          )}
        </main>
      </div>
      <ConnectNoteModal />
    </div>
  )
}
