use super::{schema::ensure_trace_schema, vault::resolve_active_vault_db_path};
use rusqlite::{Connection, OpenFlags};
use serde_json::json;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use trace_core::{
    models::Node,
    notes::{create_note, CreateNoteInput},
};

const QUICK_CAPTURE_LABEL: &str = "quick-capture";
const INBOX_NOTE_CREATED_EVENT: &str = "trace-inbox-note-created";
const DEFAULT_CAPTURE_TITLE: &str = "Captura rapida";

#[tauri::command]
pub fn create_inbox_note(app_handle: AppHandle, content: String) -> Result<Node, String> {
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return Err("Escribe algo antes de guardar la captura.".to_string());
    }

    let db_path = resolve_active_vault_db_path(&app_handle)?
        .ok_or_else(|| "Selecciona un vault en Trace antes de usar captura rapida.".to_string())?;
    let connection = Connection::open_with_flags(db_path, OpenFlags::SQLITE_OPEN_READ_WRITE)
        .map_err(|error| format!("No se pudo abrir la base de datos del vault: {error}"))?;
    let _ = connection.busy_timeout(Duration::from_millis(1200));
    ensure_trace_schema(&connection)?;

    let title = capture_title(trimmed);
    let content_json = plain_text_to_blocknote_json(trimmed)?;
    let node = create_note(
        &connection,
        CreateNoteInput {
            title: Some(title),
            parent_id: None,
            content: Some(content_json),
            tags: Vec::new(),
            inbox: true,
        },
    )
    .map_err(|error| format!("No se pudo crear la nota de bandeja: {error}"))?;

    app_handle
        .emit(INBOX_NOTE_CREATED_EVENT, &node)
        .map_err(|error| format!("No se pudo notificar la captura: {error}"))?;

    Ok(node)
}

pub(crate) fn show_quick_capture_window(app_handle: &AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window(QUICK_CAPTURE_LABEL) {
        window
            .show()
            .map_err(|error| format!("No se pudo mostrar captura rapida: {error}"))?;
        window
            .center()
            .map_err(|error| format!("No se pudo centrar captura rapida: {error}"))?;
        window
            .set_focus()
            .map_err(|error| format!("No se pudo enfocar captura rapida: {error}"))?;
        return Ok(());
    }

    WebviewWindowBuilder::new(
        app_handle,
        QUICK_CAPTURE_LABEL,
        WebviewUrl::App("index.html?window=quick-capture".into()),
    )
    .title("Trace Capture")
    .inner_size(480.0, 120.0)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .focused(true)
    .center()
    .build()
    .map_err(|error| format!("No se pudo abrir captura rapida: {error}"))?;

    Ok(())
}

fn capture_title(content: &str) -> String {
    content
        .lines()
        .find_map(|line| {
            let trimmed = line.trim();
            (!trimmed.is_empty()).then(|| trimmed.chars().take(80).collect::<String>())
        })
        .unwrap_or_else(|| DEFAULT_CAPTURE_TITLE.to_string())
}

fn plain_text_to_blocknote_json(content: &str) -> Result<String, String> {
    let blocks = content
        .replace('\r', "")
        .split('\n')
        .map(|line| {
            json!({
                "type": "paragraph",
                "content": line
            })
        })
        .collect::<Vec<_>>();

    serde_json::to_string(&blocks)
        .map_err(|error| format!("No se pudo preparar el contenido de captura: {error}"))
}
