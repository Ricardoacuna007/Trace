use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TraceUiModules {
    pub show_breadcrumbs: bool,
    pub show_backlinks: bool,
    pub show_node_icons: bool,
    pub enable_autosave: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VaultConfig {
    pub theme: String,
    pub accent_color: String,
    pub font_family: String,
    pub editor_width: String,
    pub vim_mode: bool,
    pub pinned_note_ids: Vec<String>,
    pub ui_modules: TraceUiModules,
}

impl Default for VaultConfig {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            accent_color: "#5e8bff".to_string(),
            font_family: "DM Sans".to_string(),
            editor_width: "centered".to_string(),
            vim_mode: false,
            pinned_note_ids: Vec::new(),
            ui_modules: TraceUiModules {
                show_breadcrumbs: true,
                show_backlinks: true,
                show_node_icons: true,
                enable_autosave: true,
            },
        }
    }
}
