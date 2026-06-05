use anyhow::{Context, Result};
use rusqlite::{params, Connection};
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct AuditEvent {
    pub id: String,
    pub event: String,
    pub user_id: Option<String>,
    pub ip: Option<String>,
    pub detail: serde_json::Value,
    pub created_at: i64,
}

pub fn log_event(
    connection: &Connection,
    event: &str,
    user_id: Option<&str>,
    ip: Option<&str>,
    detail: serde_json::Value,
) -> Result<()> {
    let detail_json =
        serde_json::to_string(&detail).context("No se pudo serializar audit detail")?;
    connection
        .execute(
            "INSERT INTO audit_log (id, event, user_id, ip, detail, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, unixepoch())",
            params![Uuid::new_v4().to_string(), event, user_id, ip, detail_json],
        )
        .context("No se pudo escribir audit log")?;
    Ok(())
}

pub fn list_events(connection: &Connection, limit: u32, offset: u32) -> Result<Vec<AuditEvent>> {
    let mut statement = connection
        .prepare(
            "SELECT id, event, user_id, ip, detail, created_at
             FROM audit_log
             ORDER BY created_at DESC
             LIMIT ?1 OFFSET ?2",
        )
        .context("No se pudo preparar consulta audit log")?;

    let rows = statement
        .query_map(params![limit, offset], |row| {
            let detail_json: String = row.get(4)?;
            let detail = serde_json::from_str(&detail_json).unwrap_or_else(|_| {
                serde_json::json!({
                    "raw": detail_json
                })
            });
            Ok(AuditEvent {
                id: row.get(0)?,
                event: row.get(1)?,
                user_id: row.get(2)?,
                ip: row.get(3)?,
                detail,
                created_at: row.get(5)?,
            })
        })
        .context("No se pudo consultar audit log")?;

    let mut events = Vec::new();
    for row in rows {
        events.push(row.context("No se pudo leer evento de audit log")?);
    }
    Ok(events)
}
