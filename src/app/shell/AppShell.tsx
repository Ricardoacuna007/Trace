import type { Block } from '@blocknote/core'
import { Suspense, lazy } from 'react'
import type { NoteGraphData } from '../../features/notes-graph/graph'
import type { MarkdownDbSnapshot, NoteBacklink, TraceLayoutConfig, TraceUIModules } from '../../lib/db'
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
  traceTheme: 'dark' | 'light'
  traceAccentColor: string
  traceFontFamily: string
  traceLayout: TraceLayoutConfig
  uiModules: TraceUIModules
  viewMode: ViewMode
  renderConnectModal?: boolean
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
  onReloadWorkspace: () => Promise<void>
  onReloadCustomization: () => void
  onSaveCustomization: (configJson: string, customCss: string) => void
  onSetActiveView: (view: AppViewMode) => void
  onSetEditorWidth: (width: 'full' | 'centered') => void
  onTitleChange: (noteId: string, title: string) => void
  onUpdateTraceAppearance: (patch: Partial<{
    theme: 'dark' | 'light'
    accent_color: string
    font_family: string
  }>) => void
  onUpdateTraceLayout: (layout: TraceLayoutConfig) => void
  onToggleModule: (module: keyof TraceUIModules, enabled: boolean) => void
  onTogglePropertiesPanel: () => void
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
  traceTheme,
  traceAccentColor,
  traceFontFamily,
  traceLayout,
  uiModules,
  viewMode,
  renderConnectModal = true,
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
  onReloadWorkspace,
  onReloadCustomization,
  onSaveCustomization,
  onSetActiveView,
  onSetEditorWidth,
  onTitleChange,
  onUpdateTraceAppearance,
  onUpdateTraceLayout,
  onToggleModule,
  onTogglePropertiesPanel,
  onUnpinNote,
  onUpdateMarkdownProperty,
}: AppShellProps) {
  const pinned = selectedNote ? pinnedNoteIds.includes(selectedNote.id) : false
  const connectionCount = selectedNote
    ? noteRelations.filter((relation) => relation.sourceId === selectedNote.id).length
    : 0
  const workspaceTitle = nodes.find((node) => node.type === 'workspace')?.title
    ?? activeVaultPath?.split(/[\\/]/).filter(Boolean).at(-1)
    ?? 'Workspace'
  const inboxNotes = nodes
    .filter((node): node is Note => node.type === 'note' && typeof node.content === 'string' && node.inbox)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const sidebarVisible = isSidebarOpen && traceLayout.sidebar_position !== 'hidden'
  const sidebar = sidebarVisible ? (
    <Sidebar
      inboxNotes={inboxNotes}
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
  ) : null

  return (
    <div className="app-shell flex h-screen flex-col overflow-hidden bg-[var(--bg)] text-[var(--t1)]">
      {traceLayout.visible_elements.titlebar ? (
        <TitleBar
          activeView={activeView}
          workspaceTitle={workspaceTitle}
          showTrafficLights={traceLayout.visible_elements.traffic_lights}
          onSetActiveView={onSetActiveView}
        />
      ) : null}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {traceLayout.sidebar_position === 'left' ? sidebar : null}

        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {viewMode === 'settings' ? (
            <Suspense fallback={<ViewFallback label="Cargando configuracion..." />}>
              <LazySettingsView
                vaultPath={activeVaultPath}
                traceDir={traceDir}
                traceTheme={traceTheme}
                traceAccentColor={traceAccentColor}
                traceFontFamily={traceFontFamily}
                traceLayout={traceLayout}
                configJson={traceConfigJson}
                customCss={customCss}
                customizationLoading={customizationLoading}
                customizationSaving={customizationSaving}
                ioWorking={ioWorking}
                ioMessage={ioMessage}
                nodes={nodes}
                selectedNote={selectedNote}
                editorWidth={editorWidth}
                uiModules={uiModules}
                onReloadCustomization={onReloadCustomization}
                onSaveCustomization={onSaveCustomization}
                onImportMarkdown={onImportMarkdown}
                onExportVaultMarkdown={onExportVaultMarkdown}
                onExportCurrentNoteMarkdown={onExportCurrentNoteMarkdown}
                onPrintCurrentNote={onPrintCurrentNote}
                onReloadWorkspace={onReloadWorkspace}
                onSetEditorWidth={onSetEditorWidth}
                onUpdateTraceAppearance={onUpdateTraceAppearance}
                onUpdateTraceLayout={onUpdateTraceLayout}
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
              <NoteHeader
                breadcrumbs={breadcrumbs}
                note={selectedNote}
                showBreadcrumb={uiModules.show_breadcrumbs && traceLayout.visible_elements.breadcrumb}
                propertiesPanelOpen={isPropertiesPanelOpen}
                onExportMarkdown={onExportCurrentNoteMarkdown}
                onOpenCommandPalette={onOpenCommandPalette}
                onOpenConnectModal={onOpenConnectModal}
                onPrintCurrentNote={onPrintCurrentNote}
                onTogglePropertiesPanel={onTogglePropertiesPanel}
              />
              {traceLayout.visible_elements.metabar ? (
                <NoteMetaBar
                  note={selectedNote}
                  isPinned={pinned}
                  connectionCount={connectionCount}
                  onOpenConnectModal={onOpenConnectModal}
                />
              ) : null}
              <EditorLayout
                backlinks={backlinks}
                nodes={nodes}
                note={selectedNote}
                noteRelations={noteRelations}
                recentConnectionIds={recentConnectionIds}
                editorWidth={editorWidth}
                rightPanelMode={traceLayout.right_panel}
                showBacklinks={uiModules.show_backlinks && isBacklinksPanelOpen}
                showModifiedAt={traceLayout.visible_elements.modified_at}
                showProperties={isPropertiesPanelOpen}
                showWordCount={traceLayout.visible_elements.word_count}
                onContentChange={onContentChange}
                onOpenWikiLink={onOpenWikiLink}
                onSelectNode={onOpenNode}
                onTitleChange={onTitleChange}
              />
              <StatusDot hasPendingChanges={hasPendingChanges} saveStatus={saveStatus} />
            </>
          )}
        </main>
        {traceLayout.sidebar_position === 'right' ? sidebar : null}
      </div>
      {renderConnectModal ? <ConnectNoteModal /> : null}
    </div>
  )
}
