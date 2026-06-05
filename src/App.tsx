import { open } from '@tauri-apps/plugin-dialog'
import { useCallback, useEffect } from 'react'
import type { Block } from '@blocknote/core'
import {
  useAppHotkeys,
  useAppStoreSelection,
  useBacklinks,
  useCommandSearch,
  useSelectedEditorState,
  useUnsavedChangesWarning,
} from './hooks'
import { isContainerNode } from './lib/workspace'
import { AppErrorBanner } from './app/shell/AppErrorBanner'
import { AppLoading } from './app/shell/AppLoading'
import { AppShell } from './app/shell/AppShell'
import { CommandPalette } from './app/shell/CommandPalette'
import { ThemeInjector } from './app/shell/ThemeInjector'
import { VaultSelector } from './app/shell/VaultSelector'
import { normalizeWikiLinkTitle } from './features/notes-editor/wikiLinks'

function App() {
  const {
    nodes,
    nodeTree,
    noteRelations,
    activeNoteId,
    activeView,
    pinnedNoteIds,
    recentConnectionIds,
    selectedNodeId,
    viewMode,
    loading,
    vaultRequired,
    saveStatus,
    error,
    graphData,
    traceDir,
    traceConfigJson,
    customCss,
    customizationLoading,
    customizationSaving,
    editorWidth,
    isBacklinksPanelOpen,
    ioWorking,
    ioMessage,
    isPropertiesPanelOpen,
    isSidebarOpen,
    markdownDbLoading,
    markdownDbSnapshot,
    activeVaultPath,
    uiModules,
    draftNote,
    draftRelatedNoteIds,
    isDirty,
    initialize,
    selectVaultPath,
    loadVaultCustomization,
    saveVaultCustomization,
    importMarkdownFromDir,
    exportCurrentNoteToMarkdown,
    exportVaultToMarkdown,
    refreshMarkdownDatabase,
    updateMarkdownDatabaseProperty,
    runGlobalSearch,
    clearGlobalSearch,
    selectNode,
    setActiveView,
    setViewMode,
    createFolder,
    createNewNote,
    createNoteFromTitle,
    beginNoteDraft,
    discardDraft,
    commitDraftToDB,
    openConnectModal,
    pinNote,
    queueNoteTitleSave,
    queueSaveContent,
    saveNoteNow,
    hasPendingChanges,
    toggleSidebar,
    updateUIModule,
    setEditorWidth,
    unpinNote,
  } = useAppStoreSelection()
  const {
    commandOpen,
    commandQuery,
    handleCommandOpenChange,
    openCommandPalette,
    setCommandQuery,
  } = useCommandSearch({
    clearGlobalSearch,
    runGlobalSearch,
  })

  useEffect(() => {
    void initialize()
  }, [initialize])

  const {
    breadcrumbs,
    isActiveNoteDirty,
    selectedNode,
    selectedNote,
  } = useSelectedEditorState({
    beginNoteDraft,
    draftNote,
    draftRelatedNoteIds,
    hasPendingChanges,
    isDirty,
    nodes,
    noteRelations,
    selectedNodeId,
  })

  const backlinks = useBacklinks(selectedNote?.id ?? null)

  const handleContentChange = useCallback((noteId: string, blocks: Block[]) => {
    queueSaveContent(noteId, blocks)
  }, [queueSaveContent])

  const handleSelectNode = useCallback(async (noteId: string) => {
    if (!selectedNote || selectedNote.id === noteId) {
      selectNode(noteId)
      return
    }

    if (!isActiveNoteDirty) {
      selectNode(noteId)
      return
    }

    const shouldSave = window.confirm(
      'Tienes cambios sin guardar. ¿Quieres guardarlos antes de cambiar de nota?',
    )
    if (shouldSave) {
      await commitDraftToDB(selectedNote.id)
      selectNode(noteId)
      return
    }

    const shouldDiscard = window.confirm(
      '¿Deseas descartar los cambios del borrador y continuar?',
    )
    if (!shouldDiscard) {
      return
    }

    discardDraft()
    selectNode(noteId)
  }, [commitDraftToDB, discardDraft, isActiveNoteDirty, selectNode, selectedNote])

  const handleOpenNodeFromGraph = useCallback((noteId: string) => {
    void handleSelectNode(noteId)
    setActiveView('editor')
  }, [handleSelectNode, setActiveView])

  const handleOpenNodeFromSearch = useCallback((noteId: string) => {
    void handleSelectNode(noteId)
    setActiveView('editor')
  }, [handleSelectNode, setActiveView])

  const handleOpenWikiLink = useCallback(async (rawTitle: string) => {
    const title = normalizeWikiLinkTitle(rawTitle)
    if (!title) {
      return
    }

    const existingNote = nodes.find((node) => (
      node.type === 'note' && node.title.trim().toLowerCase() === title.toLowerCase()
    ))
    if (existingNote) {
      await handleSelectNode(existingNote.id)
      setActiveView('editor')
      return
    }

    if (selectedNote && isActiveNoteDirty) {
      const shouldSave = window.confirm(
        'Tienes cambios sin guardar. Quieres guardarlos antes de crear la nota enlazada?',
      )
      if (shouldSave) {
        await commitDraftToDB(selectedNote.id)
      } else {
        const shouldDiscard = window.confirm(
          'Deseas descartar los cambios del borrador y continuar?',
        )
        if (!shouldDiscard) {
          return
        }
        discardDraft()
      }
    }

    await createNoteFromTitle(title, selectedNote?.parentId)
    setActiveView('editor')
  }, [
    commitDraftToDB,
    createNoteFromTitle,
    discardDraft,
    handleSelectNode,
    isActiveNoteDirty,
    nodes,
    selectedNote,
    setActiveView,
  ])

  const handlePickVault = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Selecciona la carpeta de tu boveda',
    })

    if (typeof selected === 'string' && selected.trim().length > 0) {
      await selectVaultPath(selected)
    }
  }, [selectVaultPath])

  const pickDirectory = useCallback(async (title: string): Promise<string | null> => {
    const selected = await open({
      directory: true,
      multiple: false,
      title,
    })

    if (typeof selected !== 'string') {
      return null
    }

    const trimmed = selected.trim()
    return trimmed.length > 0 ? trimmed : null
  }, [])

  const handleImportMarkdown = useCallback(async () => {
    const sourceDir = await pickDirectory('Selecciona carpeta Markdown para importar')
    if (!sourceDir) {
      return
    }
    await importMarkdownFromDir(sourceDir)
  }, [importMarkdownFromDir, pickDirectory])

  const handleExportVault = useCallback(async () => {
    const outputDir = await pickDirectory('Selecciona carpeta de salida para exportar la boveda')
    if (!outputDir) {
      return
    }
    await exportVaultToMarkdown(outputDir)
  }, [exportVaultToMarkdown, pickDirectory])

  const handleExportCurrentNote = useCallback(async () => {
    if (!selectedNote) {
      return
    }

    const outputDir = await pickDirectory('Selecciona carpeta de salida para exportar la nota')
    if (!outputDir) {
      return
    }
    await exportCurrentNoteToMarkdown(selectedNote.id, outputDir)
  }, [exportCurrentNoteToMarkdown, pickDirectory, selectedNote])

  const handlePrintCurrentNote = useCallback(() => {
    if (!selectedNote) {
      return
    }

    setActiveView('editor')
    requestAnimationFrame(() => window.print())
  }, [selectedNote, setActiveView])

  const handleCreateNoteShortcut = useCallback(() => {
    const parentId = isContainerNode(selectedNode)
      ? selectedNode.id
      : undefined
    void createNewNote(parentId)
  }, [createNewNote, selectedNode])

  useAppHotkeys({
    autosaveEnabled: uiModules.enable_autosave,
    onCreateNote: handleCreateNoteShortcut,
    onOpenCommandPalette: openCommandPalette,
    onSaveNoteNow: (noteId) => void saveNoteNow(noteId),
    onToggleSidebar: toggleSidebar,
    selectedNode,
    selectedNote,
  })

  useUnsavedChangesWarning(isActiveNoteDirty)

  if (loading) {
    return <AppLoading configJson={traceConfigJson} customCss={customCss} />
  }

  if (vaultRequired) {
    return (
      <main className="flex h-full flex-col">
        <ThemeInjector configJson={traceConfigJson} customCss={customCss} />
        <VaultSelector selecting={loading} error={error} onPickVault={handlePickVault} />
      </main>
    )
  }

  return (
    <main className="flex h-full flex-col">
      <ThemeInjector configJson={traceConfigJson} customCss={customCss} />
      <CommandPalette
        open={commandOpen}
        query={commandQuery}
        activeNoteId={activeNoteId}
        nodes={nodes}
        onOpenChange={handleCommandOpenChange}
        onQueryChange={setCommandQuery}
        onOpenNote={handleOpenNodeFromSearch}
        onCreateFolder={() => void createFolder()}
        onCreateNote={handleCreateNoteShortcut}
        onSwitchView={(mode) => {
          if (mode === 'settings' || mode === 'database') {
            setViewMode(mode)
            return
          }
          setActiveView(mode)
        }}
        onOpenConnect={openConnectModal}
        onOpenSettings={() => setViewMode('settings')}
        onExportMarkdown={() => void handleExportCurrentNote()}
      />

      <AppErrorBanner error={error} />

      <AppShell
        activeVaultPath={activeVaultPath}
        activeView={activeView}
        backlinks={backlinks}
        breadcrumbs={breadcrumbs}
        customCss={customCss}
        customizationLoading={customizationLoading}
        customizationSaving={customizationSaving}
        editorWidth={editorWidth}
        graphData={graphData}
        hasPendingChanges={isActiveNoteDirty}
        isBacklinksPanelOpen={isBacklinksPanelOpen}
        ioMessage={ioMessage}
        ioWorking={ioWorking}
        isPropertiesPanelOpen={isPropertiesPanelOpen}
        isSidebarOpen={isSidebarOpen}
        markdownDbLoading={markdownDbLoading}
        markdownDbSnapshot={markdownDbSnapshot}
        nodeTree={nodeTree}
        nodes={nodes}
        noteRelations={noteRelations}
        pinnedNoteIds={pinnedNoteIds}
        recentConnectionIds={recentConnectionIds}
        saveStatus={saveStatus}
        selectedNodeId={selectedNodeId}
        selectedNote={selectedNote}
        traceConfigJson={traceConfigJson}
        traceDir={traceDir}
        uiModules={uiModules}
        viewMode={viewMode}
        onContentChange={handleContentChange}
        onCreateFolder={() => void createFolder()}
        onCreateNote={handleCreateNoteShortcut}
        onExportCurrentNoteMarkdown={() => void handleExportCurrentNote()}
        onExportVaultMarkdown={() => void handleExportVault()}
        onImportMarkdown={() => void handleImportMarkdown()}
        onOpenCommandPalette={openCommandPalette}
        onOpenConnectModal={openConnectModal}
        onOpenNode={(id) => void handleSelectNode(id)}
        onOpenNodeFromGraph={handleOpenNodeFromGraph}
        onOpenWikiLink={(title) => void handleOpenWikiLink(title)}
        onPinNote={pinNote}
        onRefreshMarkdownDatabase={() => void refreshMarkdownDatabase()}
        onReloadCustomization={() => void loadVaultCustomization()}
        onSaveCustomization={(configJson, customCss) => void saveVaultCustomization(configJson, customCss)}
        onSetActiveView={setActiveView}
        onSetEditorWidth={(width) => void setEditorWidth(width)}
        onTitleChange={queueNoteTitleSave}
        onToggleModule={(module, enabled) => void updateUIModule(module, enabled)}
        onUnpinNote={unpinNote}
        onPrintCurrentNote={handlePrintCurrentNote}
        onUpdateMarkdownProperty={(filePath, key, value) => void updateMarkdownDatabaseProperty(filePath, key, value)}
      />
    </main>
  )
}

export default App
