use super::vault::resolve_active_vault_db_path;
use deunicode::deunicode;
use rusqlite::{params, Connection, OpenFlags};
use serde::Serialize;
use serde_json::Value;
use std::time::Duration;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResultDto {
    pub note_id: String,
    pub title: String,
    pub snippet: String,
    pub score: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BacklinkDto {
    pub source_id: String,
    pub title: String,
    pub preview: String,
    pub updated_at: String,
}

#[tauri::command]
pub async fn search_notes(
    app_handle: AppHandle,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<SearchResultDto>, String> {
    let raw_query = query.trim();
    if raw_query.is_empty() {
        return Ok(Vec::new());
    }

    let Some(connection) = open_active_db_readonly(&app_handle)? else {
        return Ok(Vec::new());
    };

    let max_results = clamp_limit(limit);
    let tokens = tokenize_search_input(raw_query);
    let fts_query = build_fts_query(&tokens);

    if !fts_query.is_empty() {
        match query_fts(&connection, &fts_query, max_results) {
            Ok(results) => return Ok(results),
            Err(_) => {
                // Fallback below keeps the app usable even if an old vault has no FTS table.
            }
        }
    }

    query_like(&connection, raw_query, max_results)
}

#[tauri::command]
pub async fn get_backlinks(
    app_handle: AppHandle,
    target_id: String,
    limit: Option<u32>,
) -> Result<Vec<BacklinkDto>, String> {
    let trimmed = target_id.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let Some(connection) = open_active_db_readonly(&app_handle)? else {
        return Ok(Vec::new());
    };

    let max_results = clamp_limit(limit) as i64;
    let mut statement = connection
        .prepare(
            "SELECT n.id, n.title, n.content, n.updated_at
       FROM note_relations r
       JOIN nodes n ON n.id = r.source_id
       WHERE r.target_id = ?1 AND n.type = 'note'
       ORDER BY n.updated_at DESC
       LIMIT ?2",
        )
        .map_err(|error| format!("failed to prepare backlinks query: {error}"))?;

    let rows = statement
        .query_map(params![trimmed, max_results], |row| {
            let raw_content = row.get::<_, Option<String>>(2)?.unwrap_or_default();
            Ok(BacklinkDto {
                source_id: row.get(0)?,
                title: row.get(1)?,
                preview: build_plain_preview(&raw_content),
                updated_at: row.get(3)?,
            })
        })
        .map_err(|error| format!("failed to execute backlinks query: {error}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("failed to decode backlinks rows: {error}"))
}

fn open_active_db_readonly(app_handle: &AppHandle) -> Result<Option<Connection>, String> {
    let Some(db_path) = resolve_active_vault_db_path(app_handle)? else {
        return Ok(None);
    };
    if !db_path.exists() {
        return Ok(None);
    }

    let connection = Connection::open_with_flags(db_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|error| format!("failed to open sqlite in read mode: {error}"))?;
    let _ = connection.busy_timeout(Duration::from_millis(1200));
    Ok(Some(connection))
}

fn clamp_limit(limit: Option<u32>) -> u32 {
    let value = limit.unwrap_or(20);
    value.clamp(1, 100)
}

fn tokenize_search_input(value: &str) -> Vec<String> {
    let ascii = deunicode(value).to_lowercase();
    let normalized: String = ascii
        .chars()
        .map(|char| {
            if char.is_ascii_alphanumeric() {
                char
            } else {
                ' '
            }
        })
        .collect();

    normalized
        .split_whitespace()
        .map(str::trim)
        .filter(|token| token.len() >= 2)
        .take(10)
        .map(std::string::ToString::to_string)
        .collect()
}

fn build_fts_query(tokens: &[String]) -> String {
    tokens
        .iter()
        .map(|token| format!("{token}*"))
        .collect::<Vec<_>>()
        .join(" AND ")
}

fn query_fts(
    connection: &Connection,
    fts_query: &str,
    limit: u32,
) -> Result<Vec<SearchResultDto>, rusqlite::Error> {
    let mut statement = connection.prepare(
        "SELECT n.id,
            n.title,
            snippet(nodes_fts, 2, '[', ']', ' ... ', 16) AS snippet_text,
            bm25(nodes_fts) AS rank
     FROM nodes_fts
     JOIN nodes n ON n.id = nodes_fts.note_id
     WHERE nodes_fts MATCH ?1
     ORDER BY rank
     LIMIT ?2",
    )?;

    let rows = statement.query_map(params![fts_query, i64::from(limit)], |row| {
        let snippet = row.get::<_, Option<String>>(2)?.unwrap_or_default();
        let score = row.get::<_, Option<f64>>(3)?.unwrap_or(0.0);
        Ok(SearchResultDto {
            note_id: row.get(0)?,
            title: row.get(1)?,
            snippet: if snippet.trim().is_empty() {
                "Sin extracto disponible.".to_string()
            } else {
                snippet
            },
            score,
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>()
}

fn query_like(
    connection: &Connection,
    raw_query: &str,
    limit: u32,
) -> Result<Vec<SearchResultDto>, String> {
    let like_query = format!("%{}%", raw_query.to_lowercase());
    let mut statement = connection
        .prepare(
            "SELECT id, title, content
       FROM nodes
       WHERE type = 'note'
         AND (LOWER(title) LIKE ?1 OR LOWER(COALESCE(content, '')) LIKE ?1)
       ORDER BY updated_at DESC
       LIMIT ?2",
        )
        .map_err(|error| format!("failed to prepare fallback search query: {error}"))?;

    let rows = statement
        .query_map(params![like_query, i64::from(limit)], |row| {
            let raw_content = row.get::<_, Option<String>>(2)?.unwrap_or_default();
            Ok(SearchResultDto {
                note_id: row.get(0)?,
                title: row.get(1)?,
                snippet: build_plain_preview(&raw_content),
                score: 0.0,
            })
        })
        .map_err(|error| format!("failed to execute fallback search query: {error}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("failed to decode fallback search rows: {error}"))
}

fn build_plain_preview(content: &str) -> String {
    let text = extract_note_text(content);
    if text.is_empty() {
        return "Sin contenido.".to_string();
    }

    const LIMIT: usize = 170;
    if text.chars().count() <= LIMIT {
        return text;
    }

    let mut preview = String::new();
    for (index, char) in text.chars().enumerate() {
        if index >= LIMIT {
            break;
        }
        preview.push(char);
    }
    preview.push_str("...");
    preview
}

fn extract_note_text(content: &str) -> String {
    let parsed = match serde_json::from_str::<Value>(content) {
        Ok(value) => value,
        Err(_) => return String::new(),
    };

    let mut collector = String::new();
    collect_text_deep(&parsed, &mut collector);
    collector.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn collect_text_deep(value: &Value, collector: &mut String) {
    match value {
        Value::Array(items) => {
            for item in items {
                collect_text_deep(item, collector);
            }
        }
        Value::Object(map) => {
            if let Some(Value::String(text)) = map.get("text") {
                if !text.is_empty() {
                    collector.push(' ');
                    collector.push_str(text);
                }
            }

            for (key, value) in map {
                if key == "text" {
                    continue;
                }
                collect_text_deep(value, collector);
            }
        }
        _ => {}
    }
}
