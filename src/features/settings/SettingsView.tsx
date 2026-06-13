import { useMemo, useState } from 'react'
import type { TraceEditorSettings, TraceLayoutConfig, TraceUIModules } from '../../lib/db'
import type { Note } from '../../types/note'
import type { AppNode } from '../../types/workspace'
import { CustomizationEditors } from './components/CustomizationEditors'
import { ImportExportSection } from './components/ImportExportSection'
import { SettingsHeader } from './components/SettingsHeader'
import { SyncSection } from './components/SyncSection'
import { UIModulesSection } from './components/UIModulesSection'

interface SettingsViewProps {
  vaultPath: string | null
  traceDir: string | null
  configJson: string
  customCss: string
  customizationLoading: boolean
  customizationSaving: boolean
  ioWorking: boolean
  ioMessage: string | null
  nodes: AppNode[]
  selectedNote: Note | null
  traceTheme: 'dark' | 'light'
  traceAccentColor: string
  traceFontFamily: string
  traceEditorSettings: TraceEditorSettings
  traceLayout: TraceLayoutConfig
  editorWidth: 'full' | 'centered'
  uiModules: TraceUIModules
  onReloadCustomization: () => void
  onSaveCustomization: (configJson: string, customCss: string) => void
  onImportMarkdown: () => void
  onExportVaultMarkdown: () => void
  onExportCurrentNoteMarkdown: () => void
  onPrintCurrentNote: () => void
  onReloadWorkspace: () => Promise<void>
  onSetEditorWidth: (width: 'full' | 'centered') => void
  onUpdateTraceAppearance: (patch: Partial<{
    theme: 'dark' | 'light'
    accent_color: string
    font_family: string
  }>) => void
  onUpdateTraceEditorSettings: (patch: Partial<TraceEditorSettings>) => void
  onUpdateTraceLayout: (layout: TraceLayoutConfig) => void
  onToggleModule: (module: keyof TraceUIModules, enabled: boolean) => void
}

export function SettingsView({
  vaultPath,
  traceDir,
  configJson,
  customCss,
  customizationLoading,
  customizationSaving,
  ioWorking,
  ioMessage,
  nodes,
  selectedNote,
  traceTheme,
  traceAccentColor,
  traceFontFamily,
  traceEditorSettings,
  traceLayout,
  editorWidth,
  uiModules,
  onReloadCustomization,
  onSaveCustomization,
  onImportMarkdown,
  onExportVaultMarkdown,
  onExportCurrentNoteMarkdown,
  onPrintCurrentNote,
  onReloadWorkspace,
  onSetEditorWidth,
  onUpdateTraceAppearance,
  onUpdateTraceEditorSettings,
  onUpdateTraceLayout,
  onToggleModule,
}: SettingsViewProps) {
  const [configDraftState, setConfigDraftState] = useState(() => ({
    source: configJson,
    value: configJson,
  }))
  const [cssDraftState, setCssDraftState] = useState(() => ({
    source: customCss,
    value: customCss,
  }))

  const configDraft = configDraftState.source === configJson ? configDraftState.value : configJson
  const cssDraft = cssDraftState.source === customCss ? cssDraftState.value : customCss

  const hasChanges = useMemo(() => {
    return configDraft !== configJson || cssDraft !== customCss
  }, [configDraft, configJson, cssDraft, customCss])

  const notes = useMemo(() => {
    return nodes
      .filter((node): node is Note => node.type === 'note')
      .map((note) => ({
        ...note,
        content: note.content ?? '[]',
        tags: note.tags ?? [],
      }))
  }, [nodes])

  return (
    <section className="trace-scrollbar flex h-full w-full flex-1 overflow-y-auto bg-[var(--bg)] px-5 py-5 md:px-7 md:py-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <SettingsHeader
          configDraft={configDraft}
          cssDraft={cssDraft}
          customizationLoading={customizationLoading}
          customizationSaving={customizationSaving}
          hasChanges={hasChanges}
          traceDir={traceDir}
          vaultPath={vaultPath}
          onReloadCustomization={onReloadCustomization}
          onSaveCustomization={onSaveCustomization}
        />

        <UIModulesSection
          editorWidth={editorWidth}
          traceTheme={traceTheme}
          traceAccentColor={traceAccentColor}
          traceFontFamily={traceFontFamily}
          traceEditorSettings={traceEditorSettings}
          traceLayout={traceLayout}
          uiModules={uiModules}
          onSetEditorWidth={onSetEditorWidth}
          onUpdateTraceAppearance={onUpdateTraceAppearance}
          onUpdateTraceEditorSettings={onUpdateTraceEditorSettings}
          onUpdateTraceLayout={onUpdateTraceLayout}
          onToggleModule={onToggleModule}
        />

        <SyncSection notes={notes} onReloadWorkspace={onReloadWorkspace} />

        <CustomizationEditors
          configDraft={configDraft}
          configSource={configJson}
          cssDraft={cssDraft}
          cssSource={customCss}
          onConfigDraftChange={(source, value) => setConfigDraftState({ source, value })}
          onCssDraftChange={(source, value) => setCssDraftState({ source, value })}
        />

        <ImportExportSection
          ioMessage={ioMessage}
          ioWorking={ioWorking}
          selectedNote={selectedNote}
          onImportMarkdown={onImportMarkdown}
          onExportVaultMarkdown={onExportVaultMarkdown}
          onExportCurrentNoteMarkdown={onExportCurrentNoteMarkdown}
          onPrintCurrentNote={onPrintCurrentNote}
        />
      </div>
    </section>
  )
}
