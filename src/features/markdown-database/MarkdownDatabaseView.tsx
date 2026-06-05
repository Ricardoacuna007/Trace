import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { RefreshCw, Table2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { MarkdownDbColumn, MarkdownDbRow, MarkdownDbSnapshot } from '../../lib/db'

interface MarkdownDatabaseViewProps {
  snapshot: MarkdownDbSnapshot | null
  loading: boolean
  onRefresh: () => void
  onUpdateProperty: (filePath: string, key: string, value: unknown) => void
}

const EMPTY_MARKDOWN_ROWS: MarkdownDbRow[] = []
const EMPTY_MARKDOWN_COLUMNS: MarkdownDbColumn[] = []

function asString(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

function parseInputValue(raw: string, valueType: string): unknown {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    return null
  }
  if (valueType === 'number') {
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : trimmed
  }
  if (valueType === 'multi') {
    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }
  if (valueType === 'json') {
    try {
      return JSON.parse(trimmed)
    } catch {
      return trimmed
    }
  }
  return trimmed
}

function EditablePropertyCell({
  row,
  column,
  value,
  onCommit,
}: {
  row: MarkdownDbRow
  column: MarkdownDbColumn
  value: unknown
  onCommit: (filePath: string, key: string, value: unknown) => void
}) {
  const valueText = asString(value)
  const [draftState, setDraftState] = useState(() => ({
    source: valueText,
    value: valueText,
  }))
  const draft = draftState.source === valueText ? draftState.value : valueText

  if (column.valueType === 'checkbox') {
    const checked = Boolean(value)
    return (
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onCommit(row.filePath, column.key, event.target.checked)}
        className="h-4 w-4 accent-[var(--accent)]"
      />
    )
  }

  const inputType = column.valueType === 'date'
    ? 'date'
    : column.valueType === 'number'
      ? 'number'
      : 'text'

  return (
    <input
      type={inputType}
      value={draft}
      onChange={(event) => setDraftState({ source: valueText, value: event.target.value })}
      onBlur={() => onCommit(row.filePath, column.key, parseInputValue(draft, column.valueType))}
      className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--t1)] outline-none transition-colors duration-150 focus:border-[rgba(94,139,255,0.55)]"
    />
  )
}

export function MarkdownDatabaseView({
  snapshot,
  loading,
  onRefresh,
  onUpdateProperty,
}: MarkdownDatabaseViewProps) {
  const rows = snapshot?.rows ?? EMPTY_MARKDOWN_ROWS
  const columnsMeta = snapshot?.columns ?? EMPTY_MARKDOWN_COLUMNS

  const columns = useMemo<ColumnDef<MarkdownDbRow>[]>(() => {
    const base: ColumnDef<MarkdownDbRow>[] = [
      {
        id: 'title',
        header: 'Titulo',
        cell: ({ row }) => (
          <div className="min-w-[220px]">
            <p className="truncate text-xs font-medium text-[var(--t1)]">{row.original.title}</p>
            <p className="truncate font-mono text-[11px] text-[var(--t3)]">{row.original.relativePath}</p>
          </div>
        ),
      },
    ]

    const dynamic = columnsMeta.map((column): ColumnDef<MarkdownDbRow> => ({
      id: column.key,
      header: column.key,
      cell: ({ row }) => {
        const value = row.original.properties[column.key]
        return (
          <EditablePropertyCell
            row={row.original}
            column={column}
            value={value}
            onCommit={onUpdateProperty}
          />
        )
      },
    }))

    return [...base, ...dynamic]
  }, [columnsMeta, onUpdateProperty])

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <section className="flex h-full w-full flex-1 flex-col gap-4 bg-[var(--bg)] px-5 py-5 md:px-7 md:py-6">
      <header className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg2)] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--accent-glow)] text-[var(--accent)]">
                <Table2 className="h-4 w-4" />
              </span>
              <h1 className="m-0 text-[22px] font-light text-[var(--t1)]">Base de datos Markdown</h1>
            </div>
            <p className="text-xs text-[var(--t2)]">
              Frontmatter bidireccional: edita celdas y Trace reescribe el .md.
            </p>
            <p className="mt-1 font-mono text-[11px] text-[var(--t3)]">
              {snapshot ? `${snapshot.indexedFiles} archivos indexados` : 'Sin datos indexados'}
            </p>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg3)] px-3 py-1.5 text-xs text-[var(--t2)] transition-colors duration-150 ease-in-out hover:border-[var(--border2)] hover:text-[var(--t1)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Indexando...' : 'Reindexar'}
          </button>
        </div>
      </header>

      <div className="trace-scrollbar min-h-0 flex-1 overflow-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg2)]">
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 bg-[var(--bg3)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="border-b border-[var(--border)] px-3 py-2 text-left font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--t3)]"
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-[var(--t2)]" colSpan={Math.max(columns.length, 1)}>
                  No hay archivos Markdown para mostrar en esta boveda.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-[rgba(255,255,255,0.04)] transition-colors duration-150 hover:bg-[var(--bg3)]">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="border-b border-[rgba(255,255,255,0.04)] px-3 py-2 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
