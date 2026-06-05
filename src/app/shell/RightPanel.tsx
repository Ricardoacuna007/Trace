import { FileText, Network, Sigma } from 'lucide-react'
import type { ReactNode } from 'react'
import type { NoteBacklink } from '../../lib/db'
import type { NoteRelation } from '../../store/types'
import type { Note } from '../../types/note'
import type { AppNode } from '../../types/workspace'
import {
  buildBacklinkItems,
  countWords,
  extractHeadings,
  formatDate,
  type BacklinkViewItem,
} from '../../features/notes-editor/contentMetrics'

interface RightPanelProps {
  backlinks: NoteBacklink[]
  nodes: AppNode[]
  note: Note
  noteRelations: NoteRelation[]
  recentConnectionIds: string[]
  showBacklinks: boolean
  showProperties: boolean
  onSelectNode: (id: string) => void
}

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="border-b border-[var(--border)] px-3 py-3">
      <h2 className="mb-2 font-mono text-[10px] uppercase tracking-wide text-[var(--t3)]">{title}</h2>
      {children}
    </section>
  )
}

function isBidirectional(noteId: string, sourceId: string, relations: NoteRelation[]): boolean {
  return relations.some((relation) => relation.sourceId === sourceId && relation.targetId === noteId)
    && relations.some((relation) => relation.sourceId === noteId && relation.targetId === sourceId)
}

function BacklinkRow({
  item,
  noteId,
  recentConnectionIds,
  relations,
  onSelectNode,
}: {
  item: BacklinkViewItem
  noteId: string
  recentConnectionIds: string[]
  relations: NoteRelation[]
  onSelectNode: (id: string) => void
}) {
  const bidirectional = isBidirectional(noteId, item.sourceId, relations)
  const recent = recentConnectionIds.includes(item.sourceId)

  return (
    <button
      type="button"
      onClick={() => onSelectNode(item.sourceId)}
      className={`w-full rounded-[var(--radius-md)] border border-transparent bg-[var(--bg2)] px-2 py-2 text-left transition-all duration-150 hover:border-[var(--border2)] hover:bg-[var(--bg3)] ${
        recent ? 'animate-fadeUp' : ''
      }`}
    >
      <div className="flex gap-2">
        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--t3)]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium text-[var(--t1)]">{item.title}</p>
          <p className="line-clamp-2 text-[11px] leading-snug text-[var(--t2)]">"{item.preview}"</p>
          {bidirectional ? (
            <span className="mt-1 inline-flex rounded-full border border-[rgba(74,222,128,0.25)] bg-[rgba(74,222,128,0.08)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--green)]">
              bidireccional
            </span>
          ) : null}
        </div>
      </div>
    </button>
  )
}

function MiniGraph({
  noteId,
  relations,
  recentConnectionIds,
}: {
  noteId: string
  relations: NoteRelation[]
  recentConnectionIds: string[]
}) {
  const neighbors = Array.from(new Set(relations
    .filter((relation) => relation.sourceId === noteId || relation.targetId === noteId)
    .map((relation) => (relation.sourceId === noteId ? relation.targetId : relation.sourceId))))
    .slice(0, 6)

  const centerX = 86
  const centerY = 38
  const radius = 28

  return (
    <svg width="172" height="76" viewBox="0 0 172 76" role="img" aria-label="Grafo local de la nota">
      {neighbors.map((neighborId, index) => {
        const angle = (index / Math.max(neighbors.length, 1)) * Math.PI * 2 - Math.PI / 2
        const x = centerX + Math.cos(angle) * radius
        const y = centerY + Math.sin(angle) * radius
        return (
          <line
            key={`edge-${neighborId}`}
            x1={centerX}
            y1={centerY}
            x2={x}
            y2={y}
            stroke="var(--border2)"
            strokeWidth="1"
          />
        )
      })}
      <circle cx={centerX} cy={centerY} r="8" fill="var(--accent)" opacity="0.9" />
      {neighbors.map((neighborId, index) => {
        const angle = (index / Math.max(neighbors.length, 1)) * Math.PI * 2 - Math.PI / 2
        const x = centerX + Math.cos(angle) * radius
        const y = centerY + Math.sin(angle) * radius
        const recent = recentConnectionIds.includes(neighborId)
        return (
          <circle
            key={neighborId}
            className={recent ? 'animate-fadeUp' : ''}
            cx={x}
            cy={y}
            r="5"
            fill={recent ? 'var(--green)' : 'var(--t3)'}
            opacity={recent ? 0.95 : 0.65}
          />
        )
      })}
    </svg>
  )
}

export function RightPanel({
  backlinks,
  nodes,
  note,
  noteRelations,
  recentConnectionIds,
  showBacklinks,
  showProperties,
  onSelectNode,
}: RightPanelProps) {
  const headings = extractHeadings(note.content)
  const backlinkItems = buildBacklinkItems(note.id, nodes, noteRelations, backlinks)
  const words = countWords(note.content)
  const outgoing = noteRelations.filter((relation) => relation.sourceId === note.id).length

  return (
    <aside className="trace-scrollbar hidden h-full w-[var(--right-panel-w)] shrink-0 overflow-y-auto border-l border-[var(--border)] bg-[var(--bg2)] xl:block">
      <Section title="Tabla de contenido">
        {headings.length === 0 ? (
          <p className="text-[11px] text-[var(--t3)]">Sin headings.</p>
        ) : (
          <div className="space-y-1">
            {headings.map((heading, index) => (
              <button
                key={heading.id}
                type="button"
                onClick={() => {
                  const elements = document.querySelectorAll('.bn-editor [data-content-type="heading"]')
                  elements.item(index)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }}
                className="block w-full truncate rounded-[var(--radius-sm)] px-1.5 py-1 text-left text-[11px] text-[var(--t2)] hover:bg-[var(--bg3)] hover:text-[var(--t1)]"
                style={{ paddingLeft: `${4 + (heading.level - 1) * 12}px` }}
              >
                {heading.text}
              </button>
            ))}
          </div>
        )}
      </Section>

      {showBacklinks ? (
        <Section title="Notas relacionadas">
          {backlinkItems.length === 0 ? (
            <p className="text-[11px] text-[var(--t3)]">Sin backlinks todavia.</p>
          ) : (
            <div className="space-y-1.5">
              {backlinkItems.map((item) => (
                <BacklinkRow
                  key={item.sourceId}
                  item={item}
                  noteId={note.id}
                  recentConnectionIds={recentConnectionIds}
                  relations={noteRelations}
                  onSelectNode={onSelectNode}
                />
              ))}
            </div>
          )}
        </Section>
      ) : null}

      {showProperties ? (
        <Section title="Propiedades">
          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[var(--t3)]">Creada</span>
              <span className="truncate text-[var(--t2)]">{formatDate(note.updatedAt)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[var(--t3)]">Palabras</span>
              <span className="text-[var(--t2)]">{words}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[var(--t3)]">Salientes</span>
              <span className="text-[var(--t2)]">{outgoing}</span>
            </div>
          </div>
        </Section>
      ) : null}

      <Section title="Grafo local">
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-1">
          <MiniGraph noteId={note.id} relations={noteRelations} recentConnectionIds={recentConnectionIds} />
        </div>
        <div className="mt-2 flex items-center gap-2 text-[10px] text-[var(--t3)]">
          <Network className="h-3 w-3" />
          <span>{outgoing} conexiones</span>
          <Sigma className="h-3 w-3" />
          <span>{words}</span>
        </div>
      </Section>
    </aside>
  )
}
