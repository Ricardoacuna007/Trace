import { useMemo, useState } from 'react'
import type { TraceUIModules } from '../../lib/db'
import type { Note } from '../../types/note'
import { CustomizationEditors } from './components/CustomizationEditors'
import { ImportExportSection } from './components/ImportExportSection'
import { SettingsHeader } from './components/SettingsHeader'
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
  selectedNote: Note | null
  editorWidth: 'full' | 'centered'
  uiModules: TraceUIModules
  onReloadCustomization: () => void
  onSaveCustomization: (configJson: string, customCss: string) => void
  onImportMarkdown: () => void
  onExportVaultMarkdown: () => void
  onExportCurrentNoteMarkdown: () => void
  onPrintCurrentNote: () => void
  onSetEditorWidth: (width: 'full' | 'centered') => void
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
  selectedNote,
  editorWidth,
  uiModules,
  onReloadCustomization,
  onSaveCustomization,
  onImportMarkdown,
  onExportVaultMarkdown,
  onExportCurrentNoteMarkdown,
  onPrintCurrentNote,
  onSetEditorWidth,
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
          uiModules={uiModules}
          onSetEditorWidth={onSetEditorWidth}
          onToggleModule={onToggleModule}
        />

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
