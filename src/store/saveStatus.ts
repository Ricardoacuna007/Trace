import type { NotesState } from './types'

export function markSaved(set: (partial: Partial<NotesState>) => void, get: () => NotesState) {
  set({ saveStatus: 'saved' })
  setTimeout(() => {
    if (get().saveStatus === 'saved') {
      set({ saveStatus: 'idle' })
    }
  }, 900)
}
