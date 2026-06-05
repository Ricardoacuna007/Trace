import { Download, FileDown, FileSearch, Printer, Upload } from 'lucide-react'
import type { Note } from '../../../types/note'

interface ImportExportSectionProps {
  ioMessage: string | null
  ioWorking: boolean
  selectedNote: Note | null
  onExportCurrentNoteMarkdown: () => void
  onExportVaultMarkdown: () => void
  onImportMarkdown: () => void
  onPrintCurrentNote: () => void
}

export function ImportExportSection({
  ioMessage,
  ioWorking,
  selectedNote,
  onExportCurrentNoteMarkdown,
  onExportVaultMarkdown,
  onImportMarkdown,
  onPrintCurrentNote,
}: ImportExportSectionProps) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg2)] p-4">
      <p className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--t3)]">
        Importacion y exportacion (Markdown / PDF)
      </p>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={onImportMarkdown}
          disabled={ioWorking}
          className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-xs font-medium text-[var(--t2)] transition-colors duration-150 ease-in-out hover:border-[var(--border2)] hover:text-[var(--t1)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload className="h-3.5 w-3.5" />
          Importar carpeta MD
        </button>

        <button
          type="button"
          onClick={onExportVaultMarkdown}
          disabled={ioWorking}
          className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-xs font-medium text-[var(--t2)] transition-colors duration-150 ease-in-out hover:border-[var(--border2)] hover:text-[var(--t1)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download className="h-3.5 w-3.5" />
          Exportar boveda MD
        </button>

        <button
          type="button"
          onClick={onExportCurrentNoteMarkdown}
          disabled={ioWorking || !selectedNote}
          className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-xs font-medium text-[var(--t2)] transition-colors duration-150 ease-in-out hover:border-[var(--border2)] hover:text-[var(--t1)] disabled:cursor-not-allowed disabled:opacity-60"
          title={selectedNote ? `Exportar: ${selectedNote.title}` : 'Selecciona una nota para exportar'}
        >
          <FileDown className="h-3.5 w-3.5" />
          Exportar nota MD
        </button>

        <button
          type="button"
          onClick={onPrintCurrentNote}
          disabled={!selectedNote}
          className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-xs font-medium text-[var(--t2)] transition-colors duration-150 ease-in-out hover:border-[var(--border2)] hover:text-[var(--t1)] disabled:cursor-not-allowed disabled:opacity-60"
          title={selectedNote ? `Imprimir/PDF: ${selectedNote.title}` : 'Selecciona una nota para imprimir'}
        >
          <Printer className="h-3.5 w-3.5" />
          Exportar nota PDF
        </button>
      </div>

      <div className="mt-3 rounded-[var(--radius-md)] border border-dashed border-[var(--border2)] bg-[var(--bg3)] px-3 py-2 text-[11px] text-[var(--t3)]">
        El importador detecta frontmatter `tags`/`related` y enlaces `[[wiki-links]]`.
      </div>

      {selectedNote ? (
        <div className="mt-2 flex items-center gap-1 text-[11px] text-[var(--t2)]">
          <FileSearch className="h-3.5 w-3.5 text-[var(--t3)]" />
          Nota actual: <span className="font-medium text-[var(--t1)]">{selectedNote.title}</span>
        </div>
      ) : null}

      {ioMessage ? (
        <div className="mt-3 rounded-[var(--radius-md)] border border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.1)] px-3 py-2 text-xs text-[var(--green)]">
          {ioMessage}
        </div>
      ) : null}
    </section>
  )
}
