import { describe, expect, it } from 'vitest'
import { parseTraceConfig } from './customization'

describe('parseTraceConfig', () => {
  it('deduplicates and trims pinned note ids', () => {
    const config = parseTraceConfig(JSON.stringify({
      pinned_note_ids: [' note-a ', 'note-b', 'note-a', '', 12],
    }))

    expect(config.pinned_note_ids).toEqual(['note-a', 'note-b'])
  })

  it('keeps ui module defaults when config is partial', () => {
    const config = parseTraceConfig(JSON.stringify({
      ui_modules: {
        show_backlinks: false,
      },
    }))

    expect(config.ui_modules).toEqual({
      show_breadcrumbs: true,
      show_backlinks: false,
      show_node_icons: true,
      enable_autosave: true,
    })
  })
})
