use std::collections::{HashMap, HashSet};

use rusqlite::Connection;
use serde::Serialize;
use serde_json::Value;

const MIN_SCORE: f64 = 0.10;
const DEFAULT_LIMIT: usize = 5;
const MAX_LIMIT: usize = 20;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestedConnection {
    pub target_id: String,
    pub title: String,
    pub fragment: String,
    pub score: f64,
    pub score_percent: u32,
}

#[derive(Debug, Clone)]
struct NoteDocument {
    id: String,
    title: String,
    content: String,
    tags: Vec<String>,
}

pub fn suggest_connections(
    connection: &Connection,
    note_id: &str,
    limit: Option<usize>,
) -> Result<Vec<SuggestedConnection>, rusqlite::Error> {
    let Some(source) = load_note_document(connection, note_id)? else {
        return Ok(Vec::new());
    };

    let limit = limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    let blocked_targets = load_blocked_targets(connection, &source.id)?;
    let candidates = load_candidate_documents(connection, &source.id)?
        .into_iter()
        .filter(|candidate| !blocked_targets.contains(&candidate.id))
        .collect::<Vec<_>>();

    if candidates.is_empty() {
        return Ok(Vec::new());
    }

    let mut corpus_tokens = Vec::with_capacity(candidates.len() + 1);
    corpus_tokens.push(tokenize_document(&source));
    corpus_tokens.extend(candidates.iter().map(tokenize_document));

    let idf = compute_idf(&corpus_tokens);
    let source_tokens = corpus_tokens.first().cloned().unwrap_or_default();
    let source_token_set = source_tokens.iter().cloned().collect::<HashSet<_>>();
    let source_vector = vectorize(&source_tokens, &idf);
    let source_text = normalize_text(&document_text(&source));

    let mut suggestions = candidates
        .iter()
        .enumerate()
        .map(|(index, candidate)| {
            let candidate_tokens = corpus_tokens.get(index + 1).cloned().unwrap_or_default();
            let candidate_vector = vectorize(&candidate_tokens, &idf);
            let score = score_candidate(
                &source_vector,
                &candidate_vector,
                &source_token_set,
                &candidate_tokens,
                &source_text,
                &candidate.title,
            );
            SuggestedConnection {
                target_id: candidate.id.clone(),
                title: candidate.title.clone(),
                fragment: relevant_fragment(candidate, &source_token_set),
                score,
                score_percent: score_percent(score),
            }
        })
        .filter(|suggestion| suggestion.score >= MIN_SCORE)
        .collect::<Vec<_>>();

    suggestions.sort_by(|left, right| {
        right
            .score
            .partial_cmp(&left.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| left.title.cmp(&right.title))
    });
    suggestions.truncate(limit);
    Ok(suggestions)
}

fn load_note_document(
    connection: &Connection,
    note_id: &str,
) -> Result<Option<NoteDocument>, rusqlite::Error> {
    let mut statement = connection.prepare(
        "SELECT id, title, COALESCE(content, ''), COALESCE(tags, '[]')
         FROM nodes
         WHERE id = ?1 AND type = 'note'",
    )?;
    let mut rows = statement.query_map([note_id], map_document_row)?;
    rows.next().transpose()
}

fn load_candidate_documents(
    connection: &Connection,
    source_id: &str,
) -> Result<Vec<NoteDocument>, rusqlite::Error> {
    let mut statement = connection.prepare(
        "SELECT n.id, n.title, COALESCE(n.content, ''), COALESCE(n.tags, '[]')
         FROM nodes_fts
         JOIN nodes n ON n.id = nodes_fts.note_id
         WHERE n.type = 'note'
           AND n.id != ?1
           AND COALESCE(n.inbox, 0) = 0
         ORDER BY n.updated_at DESC, n.position ASC",
    )?;
    let rows = statement.query_map([source_id], map_document_row)?;
    rows.collect()
}

fn map_document_row(row: &rusqlite::Row<'_>) -> Result<NoteDocument, rusqlite::Error> {
    let tags_json: String = row.get(3)?;
    Ok(NoteDocument {
        id: row.get(0)?,
        title: row.get(1)?,
        content: row.get(2)?,
        tags: parse_tags(&tags_json),
    })
}

fn load_blocked_targets(
    connection: &Connection,
    source_id: &str,
) -> Result<HashSet<String>, rusqlite::Error> {
    let mut blocked = HashSet::new();

    let mut relations = connection.prepare(
        "SELECT source_id, target_id
         FROM note_relations
         WHERE source_id = ?1 OR target_id = ?1",
    )?;
    let relation_rows = relations.query_map([source_id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    for row in relation_rows {
        let (source, target) = row?;
        if source == source_id {
            blocked.insert(target);
        } else {
            blocked.insert(source);
        }
    }

    let mut ignored = connection.prepare(
        "SELECT target_id
         FROM ignored_suggestions
         WHERE source_id = ?1",
    )?;
    let ignored_rows = ignored.query_map([source_id], |row| row.get::<_, String>(0))?;
    for row in ignored_rows {
        blocked.insert(row?);
    }

    Ok(blocked)
}

fn score_candidate(
    source_vector: &HashMap<String, f64>,
    candidate_vector: &HashMap<String, f64>,
    source_tokens: &HashSet<String>,
    candidate_tokens: &[String],
    source_text: &str,
    candidate_title: &str,
) -> f64 {
    let cosine = cosine_similarity(source_vector, candidate_vector);
    let overlap = overlap_score(source_tokens, candidate_tokens);
    let title = normalize_text(candidate_title);
    let title_mention_boost =
        (!title.is_empty() && source_text.contains(&title)) as u8 as f64 * 0.24;

    cosine + overlap + title_mention_boost
}

fn compute_idf(documents: &[Vec<String>]) -> HashMap<String, f64> {
    let mut document_frequency = HashMap::<String, usize>::new();
    for tokens in documents {
        for token in tokens.iter().collect::<HashSet<_>>() {
            *document_frequency.entry(token.clone()).or_default() += 1;
        }
    }

    let total = documents.len() as f64;
    document_frequency
        .into_iter()
        .map(|(token, frequency)| {
            let idf = ((total + 1.0) / (frequency as f64 + 1.0)).ln() + 1.0;
            (token, idf)
        })
        .collect()
}

fn vectorize(tokens: &[String], idf: &HashMap<String, f64>) -> HashMap<String, f64> {
    let mut counts = HashMap::<String, usize>::new();
    for token in tokens {
        *counts.entry(token.clone()).or_default() += 1;
    }

    let total = tokens.len().max(1) as f64;
    counts
        .into_iter()
        .map(|(token, count)| {
            let weight = (count as f64 / total) * idf.get(&token).copied().unwrap_or(1.0);
            (token, weight)
        })
        .collect()
}

fn cosine_similarity(a: &HashMap<String, f64>, b: &HashMap<String, f64>) -> f64 {
    let a_magnitude = a.values().map(|value| value * value).sum::<f64>();
    let b_magnitude = b.values().map(|value| value * value).sum::<f64>();
    if a_magnitude == 0.0 || b_magnitude == 0.0 {
        return 0.0;
    }

    let dot = a
        .iter()
        .map(|(token, value)| value * b.get(token).copied().unwrap_or_default())
        .sum::<f64>();
    dot / (a_magnitude.sqrt() * b_magnitude.sqrt())
}

fn overlap_score(source_tokens: &HashSet<String>, candidate_tokens: &[String]) -> f64 {
    let overlap = candidate_tokens
        .iter()
        .collect::<HashSet<_>>()
        .into_iter()
        .filter(|token| source_tokens.contains(*token))
        .count();
    (overlap as f64 * 0.035).min(0.24)
}

fn score_percent(score: f64) -> u32 {
    ((score * 130.0).round() as u32).clamp(10, 100)
}

fn relevant_fragment(candidate: &NoteDocument, source_tokens: &HashSet<String>) -> String {
    let text = plain_text_from_content(&candidate.content);
    let matching = text.lines().map(str::trim).find(|line| {
        tokenize(line)
            .iter()
            .any(|token| source_tokens.contains(token))
    });

    matching
        .filter(|line| !line.is_empty())
        .unwrap_or_else(|| {
            text.lines()
                .map(str::trim)
                .find(|line| !line.is_empty())
                .unwrap_or("")
        })
        .chars()
        .take(150)
        .collect()
}

fn tokenize_document(document: &NoteDocument) -> Vec<String> {
    tokenize(&document_text(document))
}

fn document_text(document: &NoteDocument) -> String {
    format!(
        "{}\n{}\n{}",
        document.title,
        plain_text_from_content(&document.content),
        document.tags.join(" ")
    )
}

fn tokenize(value: &str) -> Vec<String> {
    normalize_text(value)
        .split_whitespace()
        .filter(|token| token.len() >= 3 && !is_stopword(token))
        .map(str::to_string)
        .collect()
}

fn normalize_text(value: &str) -> String {
    let mut normalized = String::new();
    for character in value.chars().flat_map(char::to_lowercase) {
        if character.is_alphanumeric() {
            normalized.push(character);
        } else {
            normalized.push(' ');
        }
    }
    normalized.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn plain_text_from_content(content: &str) -> String {
    let Ok(value) = serde_json::from_str::<Value>(content) else {
        return content.to_string();
    };

    let mut lines = Vec::new();
    collect_value_text(&value, &mut lines);
    lines
        .into_iter()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

fn collect_value_text(value: &Value, output: &mut Vec<String>) {
    match value {
        Value::String(text) => output.push(text.clone()),
        Value::Array(items) => {
            let inline_text = items
                .iter()
                .filter_map(inline_text)
                .collect::<Vec<_>>()
                .join("");
            if !inline_text.trim().is_empty() {
                output.push(inline_text);
                return;
            }
            for item in items {
                collect_value_text(item, output);
            }
        }
        Value::Object(map) => {
            if let Some(content) = map.get("content") {
                collect_value_text(content, output);
            }
            if let Some(children) = map.get("children") {
                collect_value_text(children, output);
            }
        }
        _ => {}
    }
}

fn inline_text(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => Some(text.clone()),
        Value::Object(map) => map
            .get("text")
            .and_then(Value::as_str)
            .map(str::to_string)
            .or_else(|| map.get("content").and_then(inline_text)),
        _ => None,
    }
}

fn parse_tags(raw: &str) -> Vec<String> {
    serde_json::from_str::<Vec<String>>(raw).unwrap_or_default()
}

fn is_stopword(token: &str) -> bool {
    matches!(
        token,
        "the"
            | "and"
            | "for"
            | "with"
            | "from"
            | "this"
            | "that"
            | "are"
            | "was"
            | "were"
            | "una"
            | "uno"
            | "unos"
            | "unas"
            | "para"
            | "con"
            | "por"
            | "del"
            | "las"
            | "los"
            | "que"
            | "como"
            | "esta"
            | "este"
            | "esto"
            | "pero"
            | "mas"
            | "muy"
            | "sin"
            | "sobre"
            | "entre"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        notes::{self, CreateNoteInput},
        schema::ensure_trace_schema,
    };

    #[test]
    fn ranks_similar_notes_from_fts_corpus() {
        let connection = Connection::open_in_memory().expect("sqlite opens");
        ensure_trace_schema(&connection).expect("schema exists");

        let source = create_note(
            &connection,
            "Trace server",
            "Docker self host sqlite backup restore",
            false,
        );
        let related = create_note(
            &connection,
            "Self host backups",
            "Docker compose backup restore sqlite vault",
            false,
        );
        let unrelated = create_note(&connection, "Cooking", "Pasta tomato basil", false);

        let suggestions =
            suggest_connections(&connection, &source.id, Some(5)).expect("suggestions work");

        assert_eq!(
            suggestions.first().map(|item| item.target_id.as_str()),
            Some(related.id.as_str())
        );
        assert!(!suggestions
            .iter()
            .any(|suggestion| suggestion.target_id == unrelated.id));
    }

    #[test]
    fn skips_connected_ignored_and_inbox_candidates() {
        let mut connection = Connection::open_in_memory().expect("sqlite opens");
        ensure_trace_schema(&connection).expect("schema exists");

        let source = create_note(&connection, "Graph", "local graph cluster bridge", false);
        let connected = create_note(&connection, "Cluster bridge", "graph bridge cluster", false);
        let ignored = create_note(&connection, "Local graph", "graph local", false);
        let inbox = create_note(&connection, "Inbox graph", "graph cluster", true);

        notes::connect_notes(
            &mut connection,
            &source.id,
            std::slice::from_ref(&connected.id),
        )
        .expect("connected");
        notes::ignore_suggestion(&mut connection, &source.id, &ignored.id).expect("ignored");

        let suggestions =
            suggest_connections(&connection, &source.id, Some(5)).expect("suggestions work");

        assert!(suggestions
            .iter()
            .all(|suggestion| suggestion.target_id != connected.id
                && suggestion.target_id != ignored.id
                && suggestion.target_id != inbox.id));
    }

    fn create_note(
        connection: &Connection,
        title: &str,
        text: &str,
        inbox: bool,
    ) -> crate::models::Node {
        notes::create_note(
            connection,
            CreateNoteInput {
                title: Some(title.to_string()),
                parent_id: None,
                content: Some(format!(r#"[{{"type":"paragraph","content":"{text}"}}]"#)),
                tags: Vec::new(),
                inbox,
            },
        )
        .expect("note created")
    }
}
