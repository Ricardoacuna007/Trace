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
