use std::collections::{HashMap, HashSet};

use serde::Serialize;
use serde_json::Value;

use crate::models::{Node, NodeType, NoteRelation};

const GENERIC_TITLES: [&str; 1] = ["untitled"];

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    pub id: String,
    pub note_id: String,
    pub label: String,
    pub degree: u32,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct GraphLink {
    pub id: String,
    pub source: String,
    pub target: String,
    pub weight: u32,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq, Default)]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub links: Vec<GraphLink>,
}

pub fn build_note_graph(nodes_input: &[Node], explicit_relations: &[NoteRelation]) -> GraphData {
    let notes = nodes_input
        .iter()
        .filter(|node| node.node_type == NodeType::Note)
        .collect::<Vec<_>>();

    if notes.is_empty() {
        return GraphData::default();
    }

    let mut nodes = notes
        .iter()
        .map(|note| GraphNode {
            id: format!("note-{}", note.id),
            note_id: note.id.clone(),
            label: note.title.clone(),
            degree: 0,
        })
        .collect::<Vec<_>>();

    let node_ids = notes
        .iter()
        .map(|note| note.id.clone())
        .collect::<HashSet<_>>();
    let normalized_titles = notes
        .iter()
        .map(|note| (note.id.clone(), normalize_text(&note.title)))
        .collect::<HashMap<_, _>>();
    let note_text = notes
        .iter()
        .map(|note| {
            (
                note.id.clone(),
                extract_note_text(note.content.as_deref().unwrap_or_default()),
            )
        })
        .collect::<HashMap<_, _>>();

    let mut weight_by_pair: HashMap<(String, String), u32> = HashMap::new();

    for source in &notes {
        let source_text = note_text.get(&source.id).cloned().unwrap_or_default();
        if source_text.is_empty() {
            continue;
        }

        for target in &notes {
            if source.id == target.id {
                continue;
            }

            let target_title = normalized_titles
                .get(&target.id)
                .cloned()
                .unwrap_or_default();
            if target_title.len() < 2 || GENERIC_TITLES.contains(&target_title.as_str()) {
                continue;
            }

            let weight = source_text
                .split_whitespace()
                .collect::<Vec<_>>()
                .windows(target_title.split_whitespace().count())
                .filter(|window| window.join(" ") == target_title)
                .count() as u32;

            if weight > 0 {
                let current = weight_by_pair
                    .entry((source.id.clone(), target.id.clone()))
                    .or_insert(0);
                *current = current.saturating_add(weight);
            }
        }
    }

    for relation in explicit_relations {
        if relation.source_id == relation.target_id {
            continue;
        }
        if !node_ids.contains(&relation.source_id) || !node_ids.contains(&relation.target_id) {
            continue;
        }
        let current = weight_by_pair
            .entry((relation.source_id.clone(), relation.target_id.clone()))
            .or_insert(0);
        *current = current.saturating_add(1);
    }

    let mut links = weight_by_pair
        .into_iter()
        .map(|((source_note_id, target_note_id), weight)| GraphLink {
            id: format!("{source_note_id}-{target_note_id}"),
            source: format!("note-{source_note_id}"),
            target: format!("note-{target_note_id}"),
            weight,
        })
        .collect::<Vec<_>>();

    links.sort_by(|a, b| a.id.cmp(&b.id));

    let node_positions = nodes
        .iter()
        .enumerate()
        .map(|(index, node)| (node.note_id.clone(), index))
        .collect::<HashMap<_, _>>();

    for link in &links {
        let source_note_id = link.source.trim_start_matches("note-");
        let target_note_id = link.target.trim_start_matches("note-");

        if let Some(position) = node_positions.get(source_note_id) {
            nodes[*position].degree = nodes[*position].degree.saturating_add(link.weight);
        }
        if let Some(position) = node_positions.get(target_note_id) {
            nodes[*position].degree = nodes[*position].degree.saturating_add(link.weight);
        }
    }

    GraphData { nodes, links }
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
    value
        .chars()
        .flat_map(char::to_lowercase)
        .map(|character| {
            if character.is_ascii_alphanumeric() || character.is_whitespace() {
                character
            } else {
                ' '
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn graph_uses_content_mentions_and_explicit_relations() {
        let notes = vec![
            note(
                "a",
                "Alpha",
                r#"[{"type":"paragraph","content":[{"type":"text","text":"Beta"}]}]"#,
            ),
            note("b", "Beta", r#"[{"type":"paragraph","content":"No refs"}]"#),
            note("c", "Gamma", r#"[{"type":"paragraph","content":"No refs"}]"#),
        ];
        let relations = vec![NoteRelation {
            source_id: "b".to_string(),
            target_id: "c".to_string(),
        }];

        let graph = build_note_graph(&notes, &relations);

        assert_eq!(graph.nodes.len(), 3);
        assert_eq!(graph.links.len(), 2);
        assert!(graph.links.iter().any(|link| link.id == "a-b"));
        assert!(graph.links.iter().any(|link| link.id == "b-c"));
    }

    fn note(id: &str, title: &str, content: &str) -> Node {
        Node {
            id: id.to_string(),
            title: title.to_string(),
            node_type: NodeType::Note,
            parent_id: None,
            content: Some(content.to_string()),
            icon: None,
            tags: Vec::new(),
            position: 0,
            updated_at: "now".to_string(),
        }
    }
}
