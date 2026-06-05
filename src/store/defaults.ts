export const CONTENT_AUTOSAVE_DELAY_MS = 550
export const TITLE_AUTOSAVE_DELAY_MS = 420

export const DEFAULT_TRACE_CONFIG_JSON = JSON.stringify(
  {
    theme: 'dark',
    accent_color: '#5e8bff',
    font_family: 'DM Sans',
    editor_width: 'centered',
    vim_mode: false,
    pinned_note_ids: [],
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
