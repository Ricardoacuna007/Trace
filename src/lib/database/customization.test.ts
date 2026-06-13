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

  it('normalizes layout defaults from partial config', () => {
    const config = parseTraceConfig(JSON.stringify({
      layout: {
        sidebar_position: 'right',
        visible_elements: {
          metabar: false,
          word_count: false,
        },
      },
    }))

    expect(config.layout).toEqual({
      sidebar_position: 'right',
      right_panel: 'visible',
      visible_elements: {
        breadcrumb: true,
        metabar: false,
        word_count: false,
        modified_at: true,
        titlebar: true,
        traffic_lights: true,
      },
    })
  })

  it('normalizes editor appearance settings', () => {
    const config = parseTraceConfig(JSON.stringify({
      editor: {
        font_size: 99,
        line_height: 0.5,
        block_spacing: 14,
        max_width: 1100,
      },
    }))

    expect(config.editor).toEqual({
      font_size: 20,
      line_height: 1.35,
      block_spacing: 14,
      max_width: 1100,
    })
  })

  it('normalizes graph appearance settings', () => {
    const config = parseTraceConfig(JSON.stringify({
      graph: {
        orphan_color: '#111111',
        bridge_color: 'not-a-color',
        cluster_colors: ['#222222', '#333333', 'bad', '#444444', '#555555', '#666666', '#777777'],
        cluster_labels: {
          'note-a|note-b': ' Arquitectura ',
          empty: '',
          long: 'x'.repeat(80),
        },
        show_labels: false,
        node_scale: 99,
      },
    }))

    expect(config.graph).toEqual({
      orphan_color: '#111111',
      bridge_color: '#f59e0b',
      cluster_colors: ['#222222', '#333333', '#444444', '#555555', '#666666', '#777777'],
      cluster_labels: {
        'note-a|note-b': 'Arquitectura',
        long: 'x'.repeat(64),
      },
      show_labels: false,
      node_scale: 1.5,
    })
  })

  it('normalizes code runner limits', () => {
    const config = parseTraceConfig(JSON.stringify({
      code_runner: {
        timeout_ms: 999_999,
        max_output_chars: 100,
      },
    }))

    expect(config.code_runner).toEqual({
      timeout_ms: 120_000,
      max_output_chars: 1_000,
    })
  })
})
