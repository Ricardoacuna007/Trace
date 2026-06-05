use super::vault::resolve_active_vault_db_path;
use deunicode::deunicode;
use regex::Regex;
use rusqlite::{Connection, OpenFlags};
use serde::Serialize;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::time::Duration;
use tauri::AppHandle;

const GENERIC_TITLES: [&str; 1] = ["untitled"];

#[derive(Debug, Clone)]
struct NoteRecord {
    id: String,
    title: String,
    content: String,
}

#[derive(Debug, Clone)]
struct RelationRecord {
    source_id: String,
    target_id: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GraphNodeDto {
    pub id: String,
    pub note_id: String,
    pub label: String,
    pub degree: u32,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct GraphLinkDto {
    pub id: String,
    pub source: String,
    pub target: String,
    pub weight: u32,
}

#[derive(Debug, Clone, Serialize, PartialEq, Default)]
pub struct GraphDataDto {
    pub nodes: Vec<GraphNodeDto>,
    pub links: Vec<GraphLinkDto>,
}

#[tauri::command]
pub async fn generate_graph_data(app_handle: AppHandle) -> Result<GraphDataDto, String> {
    let notes = load_notes_from_db(&app_handle)?;
    let relations = load_relations_from_db(&app_handle)?;
    Ok(build_note_graph(&notes, &relations))
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

fn load_notes_from_db(app_handle: &AppHandle) -> Result<Vec<NoteRecord>, String> {
    let Some(connection) = open_active_db_readonly(app_handle)? else {
        return Ok(Vec::new());
    };

    let mut statement = match connection
    .prepare("SELECT id, title, content FROM nodes WHERE type = 'note' ORDER BY updated_at DESC, position ASC")
  {
    Ok(statement) => statement,
    Err(error) => {
      if error.to_string().contains("no such table") {
        return Ok(Vec::new());
      }
      return Err(format!("failed to prepare notes query: {error}"));
    }
  };

    let rows = statement
        .query_map([], |row| {
            Ok(NoteRecord {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
            })
        })
        .map_err(|error| format!("failed to execute notes query: {error}"))?;

    let notes = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("failed to decode notes rows: {error}"))?;
    Ok(notes)
}

fn load_relations_from_db(app_handle: &AppHandle) -> Result<Vec<RelationRecord>, String> {
    let Some(connection) = open_active_db_readonly(app_handle)? else {
        return Ok(Vec::new());
    };

    let mut statement = match connection.prepare("SELECT source_id, target_id FROM note_relations")
    {
        Ok(statement) => statement,
        Err(error) => {
            if error.to_string().contains("no such table") {
                return Ok(Vec::new());
            }
            return Err(format!("failed to prepare relations query: {error}"));
        }
    };

    let rows = statement
        .query_map([], |row| {
            Ok(RelationRecord {
                source_id: row.get(0)?,
                target_id: row.get(1)?,
            })
        })
        .map_err(|error| format!("failed to execute relations query: {error}"))?;

    let relations = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("failed to decode relations rows: {error}"))?;
    Ok(relations)
}

fn build_note_graph(notes: &[NoteRecord], explicit_relations: &[RelationRecord]) -> GraphDataDto {
    if notes.is_empty() {
        return GraphDataDto::default();
    }

    let mut nodes: Vec<GraphNodeDto> = notes
        .iter()
        .map(|note| GraphNodeDto {
            id: format!("note-{}", note.id),
            note_id: note.id.clone(),
            label: note.title.clone(),
            degree: 0,
        })
        .collect();

    let node_ids: HashSet<String> = notes.iter().map(|note| note.id.clone()).collect();
    let normalized_titles: HashMap<String, String> = notes
        .iter()
        .map(|note| (note.id.clone(), normalize_text(&note.title)))
        .collect();
    let note_text: HashMap<String, String> = notes
        .iter()
        .map(|note| (note.id.clone(), extract_note_text(&note.content)))
        .collect();

    let mut weight_by_pair: HashMap<(String, String), u32> = HashMap::new();

    for source in notes {
        let source_text = note_text
            .get(&source.id)
            .map_or_else(String::new, Clone::clone);
        if source_text.is_empty() {
            continue;
        }

        for target in notes {
            if source.id == target.id {
                continue;
            }

            let target_title = normalized_titles
                .get(&target.id)
                .map_or_else(String::new, Clone::clone);
            if target_title.len() < 2 || GENERIC_TITLES.contains(&target_title.as_str()) {
                continue;
            }

            let pattern = format!(r"\b{}\b", regex::escape(&target_title));
            let regex = match Regex::new(&pattern) {
                Ok(regex) => regex,
                Err(_) => continue,
            };

            let weight = regex.find_iter(&source_text).count() as u32;
            if weight == 0 {
                continue;
            }

            let key = (source.id.clone(), target.id.clone());
            let current = weight_by_pair.entry(key).or_insert(0);
            *current = current.saturating_add(weight);
        }
    }

    for relation in explicit_relations {
        if relation.source_id == relation.target_id {
            continue;
        }
        if !node_ids.contains(&relation.source_id) || !node_ids.contains(&relation.target_id) {
            continue;
        }
        let key = (relation.source_id.clone(), relation.target_id.clone());
        let current = weight_by_pair.entry(key).or_insert(0);
        *current = current.saturating_add(1);
    }

    let mut links: Vec<GraphLinkDto> = weight_by_pair
        .into_iter()
        .map(|((source_note_id, target_note_id), weight)| GraphLinkDto {
            id: format!("{source_note_id}-{target_note_id}"),
            source: format!("note-{source_note_id}"),
            target: format!("note-{target_note_id}"),
            weight,
        })
        .collect();

    links.sort_by(|a, b| a.id.cmp(&b.id));

    let node_positions: HashMap<String, usize> = nodes
        .iter()
        .enumerate()
        .map(|(index, node)| (node.note_id.clone(), index))
        .collect();

    for link in &links {
        let source_note_id = link.source.replace("note-", "");
        let target_note_id = link.target.replace("note-", "");

        if let Some(position) = node_positions.get(&source_note_id) {
            nodes[*position].degree = nodes[*position].degree.saturating_add(link.weight);
        }
        if let Some(position) = node_positions.get(&target_note_id) {
            nodes[*position].degree = nodes[*position].degree.saturating_add(link.weight);
        }
    }

    GraphDataDto { nodes, links }
}

fn extract_note_text(content: &str) -> String {
    let parsed = match serde_json::from_str::<Value>(content) {
        Ok(value) => value,
        Err(_) => return String::new(),
    };

    let mut collector = String::new();
    collect_text_deep(&parsed, &mut collector);
    normalize_text(&collector)
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

fn normalize_text(value: &str) -> String {
    let ascii = deunicode(value).to_lowercase();
    let spaced: String = ascii
        .chars()
        .map(|char| {
            if char.is_ascii_alphanumeric() {
                char
            } else {
                ' '
            }
        })
        .collect();

    spaced.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_text_removes_accents_and_symbols() {
        let normalized = normalize_text("Crème brûlée + Café!");
        assert_eq!(normalized, "creme brulee cafe");
    }

    #[test]
    fn graph_detects_mentions_and_explicit_relations() {
        let notes = vec![
      NoteRecord {
        id: "a".to_string(),
        title: "Alpha".to_string(),
        content: r#"[{"type":"paragraph","content":[{"type":"text","text":"referencia beta beta"}]}]"#
          .to_string(),
      },
      NoteRecord {
        id: "b".to_string(),
        title: "Beta".to_string(),
        content: r#"[{"type":"paragraph","content":[{"type":"text","text":"sin enlaces"}]}]"#
          .to_string(),
      },
      NoteRecord {
        id: "c".to_string(),
        title: "Gamma".to_string(),
        content: r#"[]"#.to_string(),
      },
    ];

        let relations = vec![RelationRecord {
            source_id: "c".to_string(),
            target_id: "a".to_string(),
        }];

        let graph = build_note_graph(&notes, &relations);
        assert_eq!(graph.nodes.len(), 3);
        assert_eq!(graph.links.len(), 2);
        assert!(graph
            .links
            .iter()
            .any(|link| link.id == "a-b" && link.weight == 2));
        assert!(graph
            .links
            .iter()
            .any(|link| link.id == "c-a" && link.weight == 1));
    }
}
