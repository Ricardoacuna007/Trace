export const CONTENT_AUTOSAVE_DELAY_MS = 550
export const TITLE_AUTOSAVE_DELAY_MS = 420

export const DEFAULT_TRACE_CONFIG_JSON = JSON.stringify(
  {
    theme: 'dark',
    accent_color: '#5e8bff',
    font_family: 'DM Sans',
    editor_width: 'centered',
    editor: {
      font_size: 15,
      line_height: 1.75,
      block_spacing: 8,
      max_width: 980,
    },
    graph: {
      orphan_color: '#f87171',
      bridge_color: '#f59e0b',
      cluster_colors: ['#5e8bff', '#4ade80', '#f59e0b', '#f87171', '#a78bfa', '#22d3ee'],
      cluster_labels: {},
      show_labels: true,
      node_scale: 1,
    },
    code_runner: {
      timeout_ms: 30000,
      max_output_chars: 10000,
    },
    vim_mode: false,
    pinned_note_ids: [],
    layout: {
      sidebar_position: 'left',
      right_panel: 'visible',
      visible_elements: {
        breadcrumb: true,
        metabar: true,
        word_count: true,
        modified_at: true,
        titlebar: true,
        traffic_lights: true,
      },
    },
    ui_modules: {
      show_breadcrumbs: true,
      show_backlinks: true,
      show_node_icons: true,
      enable_autosave: true,
    },
  },
  null,
  2,
)
