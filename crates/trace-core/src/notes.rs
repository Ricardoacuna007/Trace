use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::models::{Node, NodeType, NoteRelation};

const DEFAULT_NOTE_TITLE: &str = "Untitled";
const EMPTY_NOTE_CONTENT: &str = "[]";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNoteInput {
    pub title: Option<String>,
    pub parent_id: Option<String>,
    pub content: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub inbox: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNoteInput {
    pub title: Option<String>,
    pub content: Option<String>,
    pub parent_id: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub inbox: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletedResponse {
    pub deleted: bool,
}

pub fn list_nodes(connection: &Connection) -> Result<Vec<Node>, rusqlite::Error> {
    let mut statement = connection.prepare(
        "SELECT id, title, type, parent_id, content, icon, tags, inbox, position, updated_at
         FROM nodes
         ORDER BY parent_id IS NULL DESC, parent_id, position, updated_at DESC",
    )?;

    let rows = statement.query_map([], map_node_row)?;
    rows.collect()
}

pub fn list_notes(connection: &Connection) -> Result<Vec<Node>, rusqlite::Error> {
    let mut statement = connection.prepare(
        "SELECT id, title, type, parent_id, content, icon, tags, inbox, position, updated_at
         FROM nodes
         WHERE type = 'note'
         ORDER BY updated_at DESC, position ASC",
    )?;

    let rows = statement.query_map([], map_node_row)?;
    rows.collect()
}

pub fn get_note(connection: &Connection, id: &str) -> Result<Option<Node>, rusqlite::Error> {
    connection
        .query_row(
            "SELECT id, title, type, parent_id, content, icon, tags, inbox, position, updated_at
             FROM nodes
             WHERE id = ?1 AND type = 'note'",
            [id],
            map_node_row,
        )
        .optional()
}

pub fn create_note(
    connection: &Connection,
    input: CreateNoteInput,
) -> Result<Node, rusqlite::Error> {
    let id = format!("note-{}", Uuid::new_v4());
    let now = now_iso();
    let parent_id = input.parent_id;
    let position = next_position_for_parent(connection, parent_id.as_deref())?;
    let title = normalize_title(input.title.as_deref());
    let content = sanitize_content(input.content.as_deref());
    let tags = normalize_tags(input.tags);
    let tags_json = serialize_tags(&tags);

    connection.execute(
        "INSERT INTO nodes (id, title, type, parent_id, content, icon, tags, inbox, position, updated_at)
         VALUES (?1, ?2, 'note', ?3, ?4, 'file-text', ?5, ?6, ?7, ?8)",
        params![
            id,
            title,
            parent_id,
            content,
            tags_json,
            if input.inbox { 1 } else { 0 },
            position,
            now
        ],
    )?;

    get_note(connection, &id)?.ok_or(rusqlite::Error::QueryReturnedNoRows)
}

pub fn update_note(
    connection: &Connection,
    id: &str,
    input: UpdateNoteInput,
) -> Result<Option<Node>, rusqlite::Error> {
    let Some(current) = get_note(connection, id)? else {
        return Ok(None);
    };

    let title = input
        .title
        .as_deref()
        .map(|title| normalize_title(Some(title)))
        .unwrap_or(current.title);
    let content = input
        .content
        .as_deref()
        .map(|content| sanitize_content(Some(content)))
        .or(current.content)
        .unwrap_or_else(|| EMPTY_NOTE_CONTENT.to_string());
    let tags = input.tags.map(normalize_tags).unwrap_or(current.tags);
    let parent_id = input.parent_id.or(current.parent_id);
    let inbox = input.inbox.unwrap_or(current.inbox);
    let now = now_iso();
    let tags_json = serialize_tags(&tags);

    connection.execute(
        "UPDATE nodes
         SET title = ?1, content = ?2, parent_id = ?3, tags = ?4, inbox = ?5, updated_at = ?6
         WHERE id = ?7 AND type = 'note'",
        params![
            title,
            content,
            parent_id,
            tags_json,
            if inbox { 1 } else { 0 },
            now,
            id
        ],
    )?;

    get_note(connection, id)
}

pub fn delete_note(connection: &Connection, id: &str) -> Result<bool, rusqlite::Error> {
    let affected = connection.execute("DELETE FROM nodes WHERE id = ?1 AND type = 'note'", [id])?;
    Ok(affected > 0)
}

pub fn list_relations(connection: &Connection) -> Result<Vec<NoteRelation>, rusqlite::Error> {
    let mut statement = connection.prepare(
        "SELECT source_id, target_id
         FROM note_relations
         ORDER BY source_id, target_id",
    )?;
    let rows = statement.query_map([], |row| {
        Ok(NoteRelation {
            source_id: row.get(0)?,
            target_id: row.get(1)?,
        })
    })?;
    rows.collect()
}

pub fn connect_notes(
    connection: &mut Connection,
    source_id: &str,
    target_ids: &[String],
) -> Result<Vec<NoteRelation>, rusqlite::Error> {
    let tx = connection.transaction()?;
    let mut created = Vec::new();

    for target_id in normalize_targets(source_id, target_ids) {
        tx.execute(
            "INSERT OR IGNORE INTO note_relations (source_id, target_id) VALUES (?1, ?2)",
            params![source_id, target_id],
        )?;
        tx.execute(
            "INSERT OR IGNORE INTO note_relations (source_id, target_id) VALUES (?1, ?2)",
            params![target_id, source_id],
        )?;
        created.push(NoteRelation {
            source_id: source_id.to_string(),
            target_id: target_id.to_string(),
        });
        created.push(NoteRelation {
            source_id: target_id.to_string(),
            target_id: source_id.to_string(),
        });
    }

    tx.commit()?;
    Ok(created)
}

pub fn disconnect_notes(
    connection: &mut Connection,
    source_id: &str,
    target_id: &str,
) -> Result<Vec<NoteRelation>, rusqlite::Error> {
    let source_id = source_id.trim();
    let target_id = target_id.trim();
    if source_id.is_empty() || target_id.is_empty() || source_id == target_id {
        return Ok(Vec::new());
    }

    let tx = connection.transaction()?;
    let mut removed = Vec::new();

    let affected_forward = tx.execute(
        "DELETE FROM note_relations WHERE source_id = ?1 AND target_id = ?2",
        params![source_id, target_id],
    )?;
    if affected_forward > 0 {
        removed.push(NoteRelation {
            source_id: source_id.to_string(),
            target_id: target_id.to_string(),
        });
    }

    let affected_reverse = tx.execute(
        "DELETE FROM note_relations WHERE source_id = ?1 AND target_id = ?2",
        params![target_id, source_id],
    )?;
    if affected_reverse > 0 {
        removed.push(NoteRelation {
            source_id: target_id.to_string(),
            target_id: source_id.to_string(),
        });
    }

    tx.commit()?;
    Ok(removed)
}

fn map_node_row(row: &rusqlite::Row<'_>) -> Result<Node, rusqlite::Error> {
    let node_type_raw: String = row.get(2)?;
    let node_type = match node_type_raw.as_str() {
        "workspace" => NodeType::Workspace,
        "folder" => NodeType::Folder,
        _ => NodeType::Note,
    };
    let tags_json: String = row.get(6)?;
    let inbox: i64 = row.get(7)?;

    Ok(Node {
        id: row.get(0)?,
        title: row.get(1)?,
        node_type,
        parent_id: row.get(3)?,
        content: row.get(4)?,
        icon: row.get(5)?,
        tags: parse_tags(&tags_json),
        inbox: inbox != 0,
        position: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

fn next_position_for_parent(
    connection: &Connection,
    parent_id: Option<&str>,
) -> Result<i64, rusqlite::Error> {
    let max_position: Option<i64> = match parent_id {
        Some(parent_id) => connection.query_row(
            "SELECT MAX(position) FROM nodes WHERE parent_id = ?1",
            [parent_id],
            |row| row.get(0),
        )?,
        None => connection.query_row(
            "SELECT MAX(position) FROM nodes WHERE parent_id IS NULL",
            [],
            |row| row.get(0),
        )?,
    };

    Ok(max_position.unwrap_or(-1) + 1)
}

fn normalize_title(title: Option<&str>) -> String {
    let title = title.map(str::trim).unwrap_or_default();
    if title.is_empty() {
        DEFAULT_NOTE_TITLE.to_string()
    } else {
        title.to_string()
    }
}

fn sanitize_content(content: Option<&str>) -> String {
    let Some(content) = content.map(str::trim).filter(|value| !value.is_empty()) else {
        return EMPTY_NOTE_CONTENT.to_string();
    };

    match serde_json::from_str::<Value>(content) {
        Ok(Value::Array(_)) => content.to_string(),
        _ => EMPTY_NOTE_CONTENT.to_string(),
    }
}

fn normalize_tags(tags: Vec<String>) -> Vec<String> {
    let mut tags = tags
        .into_iter()
        .map(|tag| tag.trim().trim_start_matches('#').to_lowercase())
        .filter(|tag| !tag.is_empty())
        .collect::<Vec<_>>();
    tags.sort();
    tags.dedup();
    tags
}

fn parse_tags(tags_json: &str) -> Vec<String> {
    serde_json::from_str::<Vec<String>>(tags_json).unwrap_or_default()
}

fn serialize_tags(tags: &[String]) -> String {
    serde_json::to_string(tags).unwrap_or_else(|_| "[]".to_string())
}

fn normalize_targets<'a>(source_id: &str, target_ids: &'a [String]) -> Vec<&'a str> {
    let mut targets = target_ids
        .iter()
        .map(|target| target.trim())
        .filter(|target| !target.is_empty() && *target != source_id)
        .collect::<Vec<_>>();
    targets.sort_unstable();
    targets.dedup();
    targets
}

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::ensure_trace_schema;

    #[test]
    fn create_update_delete_note_roundtrip() {
        let mut connection = Connection::open_in_memory().expect("sqlite opens");
        ensure_trace_schema(&connection).expect("schema exists");

        let note = create_note(
            &connection,
            CreateNoteInput {
                title: Some("  My Note  ".to_string()),
                parent_id: None,
                content: Some(r#"[{"type":"paragraph","content":"Hello"}]"#.to_string()),
                tags: vec![
                    " Rust ".to_string(),
                    "#rust".to_string(),
                    "Trace".to_string(),
                ],
                inbox: true,
            },
        )
        .expect("note is created");

        assert_eq!(note.title, "My Note");
        assert_eq!(note.node_type, NodeType::Note);
        assert_eq!(note.tags, vec!["rust", "trace"]);
        assert!(note.inbox);

        let updated = update_note(
            &connection,
            &note.id,
            UpdateNoteInput {
                title: Some("Updated".to_string()),
                content: Some("not json".to_string()),
                parent_id: None,
                tags: Some(vec!["pkm".to_string()]),
                inbox: Some(false),
            },
        )
        .expect("update succeeds")
        .expect("note exists");

        assert_eq!(updated.title, "Updated");
        assert_eq!(updated.content.as_deref(), Some(EMPTY_NOTE_CONTENT));
        assert_eq!(updated.tags, vec!["pkm"]);
        assert!(!updated.inbox);

        let target = create_note(
            &connection,
            CreateNoteInput {
                title: Some("Target".to_string()),
                parent_id: None,
                content: None,
                tags: Vec::new(),
                inbox: false,
            },
        )
        .expect("target is created");

        let created = connect_notes(
            &mut connection,
            &updated.id,
            &[target.id.clone(), target.id.clone()],
        )
        .expect("relations insert");
        assert_eq!(created.len(), 2);

        let removed = disconnect_notes(&mut connection, &updated.id, &target.id)
            .expect("relations delete");
        assert_eq!(removed.len(), 2);
        assert!(
            list_relations(&connection)
                .expect("relations list")
                .is_empty()
        );

        assert!(delete_note(&connection, &note.id).expect("delete succeeds"));
        assert!(get_note(&connection, &note.id)
            .expect("get succeeds")
            .is_none());
    }
}
