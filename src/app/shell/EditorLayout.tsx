import type { Block } from '@blocknote/core'
import type { NoteBacklink } from '../../lib/db'
import type { NoteRelation } from '../../store/types'
import type { Note } from '../../types/note'
import type { AppNode } from '../../types/workspace'
import { EditorWrapper } from './EditorWrapper'
import { RightPanel } from './RightPanel'

interface EditorLayoutProps {
  backlinks: NoteBacklink[]
  nodes: AppNode[]
  note: Note
  noteRelations: NoteRelation[]
  recentConnectionIds: string[]
  editorWidth: 'full' | 'centered'
  showBacklinks: boolean
  showProperties: boolean
  onContentChange: (noteId: string, blocks: Block[]) => void
  onOpenWikiLink: (title: string) => void
  onSelectNode: (id: string) => void
  onTitleChange: (noteId: string, title: string) => void
}

export function EditorLayout({
  backlinks,
  nodes,
  note,
  noteRelations,
  recentConnectionIds,
  editorWidth,
  showBacklinks,
  showProperties,
  onContentChange,
  onOpenWikiLink,
  onSelectNode,
  onTitleChange,
}: EditorLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <EditorWrapper
        note={note}
        editorWidth={editorWidth}
        onContentChange={onContentChange}
        onOpenWikiLink={onOpenWikiLink}
        onTitleChange={onTitleChange}
      />
      <RightPanel
        backlinks={backlinks}
        nodes={nodes}
        note={note}
        noteRelations={noteRelations}
        recentConnectionIds={recentConnectionIds}
        showBacklinks={showBacklinks}
        showProperties={showProperties}
        onSelectNode={onSelectNode}
      />
    </div>
  )
}
