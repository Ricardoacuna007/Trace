use anyhow::{Context, Result};
use axum::{
    extract::{Query, State},
    response::{IntoResponse, Response},
    Json,
};
use chrono::DateTime;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use trace_core::{
    models::{Node, NodeType},
    notes,
};
use uuid::Uuid;

use super::{open_connection, server_error, unix_timestamp, AppState};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct SyncPushRequest {
    notes: Vec<Node>,
    since: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ConflictItem {
    note_id: String,
    client: Node,
    server: Node,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct SyncPushResponse {
    accepted: Vec<String>,
    conflicts: Vec<ConflictItem>,
}

#[derive(Debug, Deserialize)]
pub(super) struct SyncPullQuery {
    since: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SyncPullResponse {
    notes: Vec<Node>,
    server_time: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SyncStatusResponse {
    last_push: Option<i64>,
    last_pull: Option<i64>,
    last_sync_ok: Option<i64>,
    pending_conflicts: i64,
}

pub(super) async fn push(
    State(state): State<AppState>,
    Json(payload): Json<SyncPushRequest>,
) -> Response {
    match push_notes(&state, payload) {
        Ok(response) => Json(response).into_response(),
        Err(error) => server_error(error),
    }
}

pub(super) async fn pull(
    State(state): State<AppState>,
    Query(query): Query<SyncPullQuery>,
) -> Response {
    match pull_notes(&state, query.since.unwrap_or_default()) {
        Ok(response) => Json(response).into_response(),
        Err(error) => server_error(error),
    }
}

pub(super) async fn status(State(state): State<AppState>) -> Response {
    match sync_status(&state) {
        Ok(response) => Json(response).into_response(),
        Err(error) => server_error(error),
    }
}

fn push_notes(state: &AppState, payload: SyncPushRequest) -> Result<SyncPushResponse> {
    let mut connection = open_connection(&state.db_path)?;
    let tx = connection
        .transaction()
        .context("No se pudo iniciar transaccion de sync push")?;
    let mut accepted = Vec::new();
    let mut conflicts = Vec::new();

    for client_note in payload.notes {
        let server_note =
            notes::get_note(&tx, &client_note.id).context("No se pudo leer nota de servidor")?;

        if let Some(server_note) = server_note {
            if updated_at_epoch(&server_note.updated_at) > updated_at_epoch(&client_note.updated_at)
            {
                conflicts.push(ConflictItem {
                    note_id: client_note.id.clone(),
                    client: client_note,
                    server: server_note,
                });
                continue;
            }
        }

        upsert_note(&tx, &client_note).context("No se pudo aplicar nota de sync push")?;
        accepted.push(client_note.id);
    }

    let status = if conflicts.is_empty() {
        "ok"
    } else {
        "conflict"
    };
    let now = unix_timestamp();
    insert_sync_log(
        &tx,
        "push",
        status,
        accepted.len() as i64,
        0,
        serde_json::json!({
            "accepted": accepted.clone(),
            "conflicts": conflicts.iter().map(|item| item.note_id.as_str()).collect::<Vec<_>>(),
            "since": payload.since
        }),
    )?;
    update_sync_state_for_push(&tx, now, conflicts.is_empty())?;
    tx.commit().context("No se pudo cerrar sync push")?;

    Ok(SyncPushResponse {
        accepted,
        conflicts,
    })
}

fn pull_notes(state: &AppState, since: i64) -> Result<SyncPullResponse> {
    let connection = open_connection(&state.db_path)?;
    let server_time = unix_timestamp();
    let pulled_notes = notes::list_notes(&connection)
        .context("No se pudieron listar notas para sync pull")?
        .into_iter()
        .filter(|note| updated_at_epoch(&note.updated_at) > since)
        .collect::<Vec<_>>();

    insert_sync_log(
        &connection,
        "pull",
        "ok",
        0,
        pulled_notes.len() as i64,
        serde_json::json!({ "since": since }),
    )?;
    update_sync_state_for_pull(&connection, server_time)?;

    Ok(SyncPullResponse {
        notes: pulled_notes,
        server_time,
    })
}

fn sync_status(state: &AppState) -> Result<SyncStatusResponse> {
    let connection = open_connection(&state.db_path)?;
    let (last_push, last_pull, last_sync_ok) = connection
        .query_row(
            "SELECT last_push_at, last_pull_at, last_sync_ok
             FROM sync_state
             WHERE id = 'singleton'",
            [],
            |row| {
                Ok((
                    row.get::<_, Option<i64>>(0)?,
                    row.get::<_, Option<i64>>(1)?,
                    row.get::<_, Option<i64>>(2)?,
                ))
            },
        )
        .context("No se pudo leer sync_state")?;
    let pending_conflicts = connection
        .query_row(
            "SELECT COUNT(*) FROM sync_log WHERE status = 'conflict'",
            [],
            |row| row.get::<_, i64>(0),
        )
        .context("No se pudo contar conflictos de sync")?;

    Ok(SyncStatusResponse {
        last_push,
        last_pull,
        last_sync_ok,
        pending_conflicts,
    })
}

fn upsert_note(connection: &Connection, note: &Node) -> Result<()> {
    let tags_json = serde_json::to_string(&note.tags).context("No se pudieron serializar tags")?;
    connection
        .execute(
            "INSERT INTO nodes (id, title, type, parent_id, content, icon, tags, inbox, position, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(id) DO UPDATE SET
               title = excluded.title,
               type = excluded.type,
               parent_id = excluded.parent_id,
               content = excluded.content,
               icon = excluded.icon,
               tags = excluded.tags,
               inbox = excluded.inbox,
               position = excluded.position,
               updated_at = excluded.updated_at",
            params![
                note.id.as_str(),
                note.title.as_str(),
                node_type_to_db(note.node_type),
                note.parent_id.as_deref(),
                note.content.as_deref(),
                note.icon.as_deref(),
                tags_json,
                if note.inbox { 1 } else { 0 },
                note.position,
                note.updated_at.as_str()
            ],
        )
        .context("No se pudo hacer upsert de nota")?;
    Ok(())
}

fn insert_sync_log(
    connection: &Connection,
    direction: &str,
    status: &str,
    notes_sent: i64,
    notes_recv: i64,
    detail: serde_json::Value,
) -> Result<()> {
    let detail_json =
        serde_json::to_string(&detail).context("No se pudo serializar sync detail")?;
    connection
        .execute(
            "INSERT INTO sync_log (id, direction, status, notes_sent, notes_recv, detail, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, unixepoch())",
            params![
                Uuid::new_v4().to_string(),
                direction,
                status,
                notes_sent,
                notes_recv,
                detail_json
            ],
        )
        .context("No se pudo registrar sync_log")?;
    Ok(())
}

fn update_sync_state_for_push(
    connection: &Connection,
    timestamp: i64,
    completed_without_conflicts: bool,
) -> Result<()> {
    if completed_without_conflicts {
        connection
            .execute(
                "UPDATE sync_state
                 SET last_push_at = ?1, last_sync_ok = ?1
                 WHERE id = 'singleton'",
                [timestamp],
            )
            .context("No se pudo actualizar sync_state push ok")?;
    } else {
        connection
            .execute(
                "UPDATE sync_state
                 SET last_push_at = ?1
                 WHERE id = 'singleton'",
                [timestamp],
            )
            .context("No se pudo actualizar sync_state push conflict")?;
    }
    Ok(())
}

fn update_sync_state_for_pull(connection: &Connection, timestamp: i64) -> Result<()> {
    connection
        .execute(
            "UPDATE sync_state
             SET last_pull_at = ?1, last_sync_ok = ?1
             WHERE id = 'singleton'",
            [timestamp],
        )
        .context("No se pudo actualizar sync_state pull")?;
    Ok(())
}

fn node_type_to_db(node_type: NodeType) -> &'static str {
    match node_type {
        NodeType::Workspace => "workspace",
        NodeType::Folder => "folder",
        NodeType::Note => "note",
    }
}

fn updated_at_epoch(value: &str) -> i64 {
    value
        .parse::<i64>()
        .ok()
        .or_else(|| {
            DateTime::parse_from_rfc3339(value)
                .ok()
                .map(|date| date.timestamp())
        })
        .unwrap_or_default()
}
