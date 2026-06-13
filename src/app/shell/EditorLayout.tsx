import type { Block } from '@blocknote/core'
import type { NoteBacklink, TraceCodeRunnerSettings, TraceRightPanelMode } from '../../lib/db'
import type { NoteRelation } from '../../store/types'
import type { Note } from '../../types/note'
import type { AppNode } from '../../types/workspace'
import { EditorWrapper } from './EditorWrapper'
import { RightPanel } from './RightPanel'

interface EditorLayoutProps {
  backlinks: NoteBacklink[]
  ignoredSuggestionPairs: string[]
  nodes: AppNode[]
  note: Note
  noteRelations: NoteRelation[]
  recentConnectionIds: string[]
  traceCodeRunnerSettings: TraceCodeRunnerSettings
  editorWidth: 'full' | 'centered'
  rightPanelMode: TraceRightPanelMode
  showBacklinks: boolean
  showModifiedAt: boolean
  showProperties: boolean
  showWordCount: boolean
  onContentChange: (noteId: string, blocks: Block[]) => void
  onConnectNotes: (sourceId: string, targetIds: string[]) => void
  onDisconnectNotes: (sourceId: string, targetId: string) => void
  onIgnoreConnectionSuggestion: (sourceId: string, targetId: string) => void
  onMoveNode: (id: string, newParentId: string | null) => void
  onOpenWikiLink: (title: string) => void
  onSelectNode: (id: string) => void
  onTitleChange: (noteId: string, title: string) => void
}

export function EditorLayout({
  backlinks,
  ignoredSuggestionPairs,
  nodes,
  note,
  noteRelations,
  recentConnectionIds,
  traceCodeRunnerSettings,
  editorWidth,
  rightPanelMode,
  showBacklinks,
  showModifiedAt,
  showProperties,
  showWordCount,
  onContentChange,
  onConnectNotes,
  onDisconnectNotes,
  onIgnoreConnectionSuggestion,
  onMoveNode,
  onOpenWikiLink,
  onSelectNode,
  onTitleChange,
}: EditorLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <EditorWrapper
        note={note}
        editorWidth={editorWidth}
        showModifiedAt={showModifiedAt}
        showWordCount={showWordCount}
        traceCodeRunnerSettings={traceCodeRunnerSettings}
        onContentChange={onContentChange}
        onOpenWikiLink={onOpenWikiLink}
        onTitleChange={onTitleChange}
      />
      {rightPanelMode === 'visible' ? (
        <RightPanel
          backlinks={backlinks}
          ignoredSuggestionPairs={ignoredSuggestionPairs}
          nodes={nodes}
          note={note}
          noteRelations={noteRelations}
          recentConnectionIds={recentConnectionIds}
          traceCodeRunnerSettings={traceCodeRunnerSettings}
          showBacklinks={showBacklinks}
          showProperties={showProperties}
          onConnectNotes={onConnectNotes}
          onDisconnectNotes={onDisconnectNotes}
          onIgnoreConnectionSuggestion={onIgnoreConnectionSuggestion}
          onMoveNode={onMoveNode}
          onSelectNode={onSelectNode}
        />
      ) : null}
    </div>
  )
}
