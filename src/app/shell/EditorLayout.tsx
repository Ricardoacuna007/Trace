import type { Block } from '@blocknote/core'
import type { NoteBacklink, TraceRightPanelMode } from '../../lib/db'
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
  editorWidth: 'full' | 'centered'
  rightPanelMode: TraceRightPanelMode
  showBacklinks: boolean
  showModifiedAt: boolean
  showProperties: boolean
  showWordCount: boolean
  onContentChange: (noteId: string, blocks: Block[]) => void
  onConnectNotes: (sourceId: string, targetIds: string[]) => void
  onIgnoreConnectionSuggestion: (sourceId: string, targetId: string) => void
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
  editorWidth,
  rightPanelMode,
  showBacklinks,
  showModifiedAt,
  showProperties,
  showWordCount,
  onContentChange,
  onConnectNotes,
  onIgnoreConnectionSuggestion,
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
          showBacklinks={showBacklinks}
          showProperties={showProperties}
          onConnectNotes={onConnectNotes}
          onIgnoreConnectionSuggestion={onIgnoreConnectionSuggestion}
          onSelectNode={onSelectNode}
        />
      ) : null}
    </div>
  )
}
