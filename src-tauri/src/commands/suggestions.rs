use super::{schema::ensure_trace_schema, vault::resolve_active_vault_db_path};
use rusqlite::{Connection, OpenFlags};
use tauri::AppHandle;
use trace_core::suggestions::SuggestedConnection;

#[tauri::command]
pub fn suggest_note_connections(
    app_handle: AppHandle,
    note_id: String,
    limit: Option<usize>,
) -> Result<Vec<SuggestedConnection>, String> {
    let Some(db_path) = resolve_active_vault_db_path(&app_handle)? else {
        return Err("No hay base de datos activa para esta boveda.".to_string());
    };

    let connection = Connection::open_with_flags(
        db_path,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE,
    )
    .map_err(|error| format!("No se pudo abrir SQLite para sugerencias: {error}"))?;
    ensure_trace_schema(&connection)?;

    trace_core::suggestions::suggest_connections(&connection, note_id.trim(), limit)
        .map_err(|error| format!("No se pudieron calcular sugerencias: {error}"))
}
