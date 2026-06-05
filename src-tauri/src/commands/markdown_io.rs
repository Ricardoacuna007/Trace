use super::{schema::ensure_trace_schema, vault::resolve_active_vault_db_path};
use deunicode::deunicode;
use regex::Regex;
use rusqlite::{params, Connection, OpenFlags};
use serde::Serialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummaryDto {
    pub workspace_id: String,
    pub workspace_title: String,
    pub imported_notes: u32,
    pub created_relations: u32,
}

#[derive(Debug, Clone)]
struct NoteRecord {
    id: String,
    title: String,
    content: String,
    tags: Vec<String>,
    updated_at: String,
    parent_id: Option<String>,
}

#[derive(Debug, Clone)]
struct PendingRelation {
    source_id: String,
    target_ref: String,
}

#[tauri::command]
pub fn export_note_markdown(
    app_handle: AppHandle,
    note_id: String,
    output_dir: String,
) -> Result<String, String> {
    let connection = open_active_db_rw(&app_handle)?;
    ensure_trace_schema(&connection)?;

    let record = load_note_by_id(&connection, note_id.trim())?;
    let related_ids = load_note_relation_targets(&connection, &record.id)?;
    let markdown = compose_markdown(&record, &related_ids)?;

    let output = PathBuf::from(output_dir.trim());
    if output.as_os_str().is_empty() {
        return Err("Debes seleccionar una carpeta de salida.".to_string());
    }
    fs::create_dir_all(&output)
        .map_err(|error| format!("No se pudo crear carpeta de salida: {error}"))?;

    let file_name = format!("{}.md", sanitize_file_name(&record.title));
    let file_path = output.join(file_name);
    fs::write(&file_path, markdown.as_bytes())
        .map_err(|error| format!("No se pudo escribir archivo Markdown: {error}"))?;

    to_utf8_path(file_path)
}

#[tauri::command]
pub fn export_vault_markdown(app_handle: AppHandle, output_dir: String) -> Result<u32, String> {
    let connection = open_active_db_rw(&app_handle)?;
    ensure_trace_schema(&connection)?;

    let output_root = PathBuf::from(output_dir.trim());
    if output_root.as_os_str().is_empty() {
        return Err("Debes seleccionar una carpeta de salida.".to_string());
    }
    fs::create_dir_all(&output_root)
        .map_err(|error| format!("No se pudo crear carpeta de salida: {error}"))?;

    let notes = load_all_notes(&connection)?;
    let parent_map = load_parent_map(&connection)?;
    let relations_map = load_relations_by_source(&connection)?;

    let mut exported = 0_u32;
    for note in &notes {
        let related_ids = relations_map.get(&note.id).cloned().unwrap_or_default();
        let markdown = compose_markdown(note, &related_ids)?;

        let mut directory = output_root.clone();
        for segment in resolve_parent_segments(note, &parent_map) {
            directory = directory.join(sanitize_file_name(&segment));
        }
        fs::create_dir_all(&directory)
            .map_err(|error| format!("No se pudo crear directorio de exportacion: {error}"))?;

        let file_path = directory.join(format!("{}.md", sanitize_file_name(&note.title)));
        fs::write(&file_path, markdown.as_bytes()).map_err(|error| {
            format!(
                "No se pudo escribir archivo {}: {error}",
                file_path.display()
            )
        })?;
        exported = exported.saturating_add(1);
    }

    Ok(exported)
}

#[tauri::command]
pub fn import_markdown_directory(
    app_handle: AppHandle,
    source_dir: String,
) -> Result<ImportSummaryDto, String> {
    let connection = open_active_db_rw(&app_handle)?;
    ensure_trace_schema(&connection)?;

    let source_root = PathBuf::from(source_dir.trim());
    if !source_root.exists() || !source_root.is_dir() {
        return Err("La carpeta de importacion no existe o no es valida.".to_string());
    }

    let markdown_files = collect_markdown_files(&source_root)?;
    if markdown_files.is_empty() {
        return Err(
            "No se encontraron archivos .md dentro de la carpeta seleccionada.".to_string(),
        );
    }

    let workspace_title = source_root
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|value| !value.trim().is_empty())
        .map(|value| format!("{value} (Importado)"))
        .unwrap_or_else(|| "Importado".to_string());

    let workspace_id = create_node_id("workspace");
    let now = now_iso();
    let workspace_position = next_position_for_parent(&connection, None)?;
    connection
    .execute(
      "INSERT INTO nodes (id, title, type, parent_id, content, icon, tags, position, updated_at)
       VALUES (?1, ?2, 'workspace', NULL, NULL, 'workspace', '[]', ?3, ?4)",
      params![workspace_id, workspace_title, workspace_position, now],
    )
    .map_err(|error| format!("No se pudo crear workspace de importacion: {error}"))?;

    let mut folder_cache: HashMap<PathBuf, String> = HashMap::new();
    folder_cache.insert(PathBuf::new(), workspace_id.clone());

    let mut lookup: HashMap<String, String> = HashMap::new();
    let mut pending_relations: Vec<PendingRelation> = Vec::new();
    let wiki_link_regex = Regex::new(r"\[\[([^\[\]]+)\]\]")
        .map_err(|error| format!("No se pudo compilar regex de enlaces wiki: {error}"))?;

    let mut imported_notes = 0_u32;

    for relative_file in &markdown_files {
        let absolute = source_root.join(relative_file);
        let raw = fs::read_to_string(&absolute)
            .map_err(|error| format!("No se pudo leer {}: {error}", absolute.display()))?;
        let parsed = parse_markdown_file(&raw);

        let parent_relative = relative_file.parent().unwrap_or_else(|| Path::new(""));
        let parent_id = ensure_folder_hierarchy(
            &connection,
            &workspace_id,
            &source_root,
            parent_relative,
            &mut folder_cache,
        )?;

        let file_stem = relative_file
            .file_stem()
            .and_then(|name| name.to_str())
            .unwrap_or("nota")
            .to_string();
        let title = parsed
            .title
            .clone()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| prettify_file_stem(&file_stem));

        let note_id = create_node_id("note");
        let updated_at = now_iso();
        let position = next_position_for_parent(&connection, Some(parent_id.as_str()))?;
        let tags_json = serde_json::to_string(&parsed.tags)
            .map_err(|error| format!("No se pudo serializar tags: {error}"))?;
        let content_json = markdown_to_blocknote_json(&parsed.body)?;

        connection
      .execute(
        "INSERT INTO nodes (id, title, type, parent_id, content, icon, tags, position, updated_at)
         VALUES (?1, ?2, 'note', ?3, ?4, 'note', ?5, ?6, ?7)",
        params![note_id, title, parent_id, content_json, tags_json, position, updated_at],
      )
      .map_err(|error| format!("No se pudo insertar nota importada: {error}"))?;

        lookup.insert(normalize_lookup_key(&note_id), note_id.clone());
        lookup.insert(normalize_lookup_key(&title), note_id.clone());
        lookup.insert(normalize_lookup_key(&file_stem), note_id.clone());
        lookup.insert(
            normalize_lookup_key(
                relative_file
                    .to_string_lossy()
                    .replace('\\', "/")
                    .trim_end_matches(".md"),
            ),
            note_id.clone(),
        );

        for relation in parsed.related {
            pending_relations.push(PendingRelation {
                source_id: note_id.clone(),
                target_ref: relation,
            });
        }
        for capture in wiki_link_regex.captures_iter(&parsed.body) {
            let target = capture
                .get(1)
                .map(|value| value.as_str().trim())
                .unwrap_or_default();
            if !target.is_empty() {
                pending_relations.push(PendingRelation {
                    source_id: note_id.clone(),
                    target_ref: target.to_string(),
                });
            }
        }

        imported_notes = imported_notes.saturating_add(1);
    }

    let mut created_relations = 0_u32;
    for relation in pending_relations {
        let key = normalize_lookup_key(&relation.target_ref);
        let Some(target_id) = lookup.get(&key) else {
            continue;
        };
        if target_id == &relation.source_id {
            continue;
        }
        let changed = connection
            .execute(
                "INSERT OR IGNORE INTO note_relations (source_id, target_id) VALUES (?1, ?2)",
                params![relation.source_id, target_id],
            )
            .map_err(|error| format!("No se pudo crear relacion importada: {error}"))?;
        if changed > 0 {
            created_relations = created_relations.saturating_add(1);
        }
    }

    Ok(ImportSummaryDto {
        workspace_id,
        workspace_title,
        imported_notes,
        created_relations,
    })
}

fn open_active_db_rw(app_handle: &AppHandle) -> Result<Connection, String> {
    let Some(db_path) = resolve_active_vault_db_path(app_handle)? else {
        return Err("No hay base de datos activa para esta boveda.".to_string());
    };
    if !db_path.exists() {
        return Err("No se encontro trace.db en la boveda activa.".to_string());
    }

    let connection = Connection::open_with_flags(
        db_path,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE,
    )
    .map_err(|error| format!("No se pudo abrir SQLite en modo escritura: {error}"))?;
    let _ = connection.busy_timeout(Duration::from_millis(1400));
    Ok(connection)
}

fn load_note_by_id(connection: &Connection, note_id: &str) -> Result<NoteRecord, String> {
    connection
    .query_row(
      "SELECT id, title, content, tags, updated_at, parent_id FROM nodes WHERE id = ?1 AND type = 'note'",
      params![note_id],
      |row| {
        Ok(NoteRecord {
          id: row.get(0)?,
          title: row.get(1)?,
          content: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
          tags: parse_tags(row.get::<_, Option<String>>(3)?.unwrap_or_else(|| "[]".to_string())),
          updated_at: row.get(4)?,
          parent_id: row.get::<_, Option<String>>(5)?,
        })
      },
    )
    .map_err(|error| format!("No se encontro la nota solicitada: {error}"))
}

fn load_all_notes(connection: &Connection) -> Result<Vec<NoteRecord>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, title, content, tags, updated_at, parent_id FROM nodes WHERE type = 'note'",
        )
        .map_err(|error| format!("No se pudo preparar consulta de notas: {error}"))?;

    let rows = statement
        .query_map([], |row| {
            Ok(NoteRecord {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                tags: parse_tags(
                    row.get::<_, Option<String>>(3)?
                        .unwrap_or_else(|| "[]".to_string()),
                ),
                updated_at: row.get(4)?,
                parent_id: row.get::<_, Option<String>>(5)?,
            })
        })
        .map_err(|error| format!("No se pudo ejecutar consulta de notas: {error}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("No se pudieron leer notas: {error}"))
}

fn load_parent_map(
    connection: &Connection,
) -> Result<HashMap<String, (String, Option<String>)>, String> {
    let mut statement = connection
        .prepare("SELECT id, title, parent_id FROM nodes")
        .map_err(|error| format!("No se pudo preparar consulta de padres: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                (row.get::<_, String>(1)?, row.get::<_, Option<String>>(2)?),
            ))
        })
        .map_err(|error| format!("No se pudo ejecutar consulta de padres: {error}"))?;

    rows.collect::<Result<HashMap<_, _>, _>>()
        .map_err(|error| format!("No se pudo construir mapa de padres: {error}"))
}

fn load_note_relation_targets(
    connection: &Connection,
    note_id: &str,
) -> Result<Vec<String>, String> {
    let mut statement = connection
        .prepare("SELECT target_id FROM note_relations WHERE source_id = ?1 ORDER BY target_id")
        .map_err(|error| format!("No se pudo preparar consulta de relaciones: {error}"))?;
    let rows = statement
        .query_map(params![note_id], |row| row.get::<_, String>(0))
        .map_err(|error| format!("No se pudo ejecutar consulta de relaciones: {error}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("No se pudieron leer relaciones: {error}"))
}

fn load_relations_by_source(
    connection: &Connection,
) -> Result<HashMap<String, Vec<String>>, String> {
    let mut statement = connection
        .prepare("SELECT source_id, target_id FROM note_relations ORDER BY source_id, target_id")
        .map_err(|error| format!("No se pudo preparar consulta global de relaciones: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| format!("No se pudo ejecutar consulta global de relaciones: {error}"))?;

    let mut map: HashMap<String, Vec<String>> = HashMap::new();
    for row in rows {
        let (source, target) =
            row.map_err(|error| format!("No se pudo leer fila de relacion: {error}"))?;
        map.entry(source).or_default().push(target);
    }
    Ok(map)
}

fn compose_markdown(record: &NoteRecord, related_ids: &[String]) -> Result<String, String> {
    let mut output = String::new();
    output.push_str("---\n");
    output.push_str(&format!("id: {}\n", record.id));
    output.push_str(&format!(
        "title: {}\n",
        escape_frontmatter_scalar(&record.title)
    ));
    output.push_str("tags:\n");
    if record.tags.is_empty() {
        output.push_str("  -\n");
    } else {
        for tag in &record.tags {
            output.push_str(&format!("  - {}\n", escape_frontmatter_scalar(tag)));
        }
    }
    output.push_str("related:\n");
    if related_ids.is_empty() {
        output.push_str("  -\n");
    } else {
        for related in related_ids {
            output.push_str(&format!("  - {}\n", escape_frontmatter_scalar(related)));
        }
    }
    output.push_str(&format!("updated_at: {}\n", record.updated_at));
    output.push_str("---\n\n");

    output.push_str(&blocks_json_to_markdown(&record.content)?);
    if !output.ends_with('\n') {
        output.push('\n');
    }
    Ok(output)
}

fn blocks_json_to_markdown(content: &str) -> Result<String, String> {
    if content.trim().is_empty() {
        return Ok(String::new());
    }
    let value: Value = serde_json::from_str(content)
        .map_err(|error| format!("Contenido de nota no es JSON valido: {error}"))?;
    let blocks = value.as_array().cloned().unwrap_or_default();
    let mut output = String::new();
    render_blocks(&blocks, 0, &mut output);
    Ok(output.trim().to_string())
}

fn render_blocks(blocks: &[Value], indent: usize, output: &mut String) {
    for block in blocks {
        let block_type = block
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or("paragraph");
        let text = extract_text_from_content(block.get("content"));
        let padding = "  ".repeat(indent);

        match block_type {
            "heading" => {
                let level = block
                    .get("props")
                    .and_then(|props| props.get("level"))
                    .and_then(Value::as_u64)
                    .unwrap_or(1)
                    .clamp(1, 6);
                output.push_str(&format!(
                    "{}{} {}\n\n",
                    padding,
                    "#".repeat(level as usize),
                    text
                ));
            }
            "bulletListItem" => {
                output.push_str(&format!("{padding}- {text}\n"));
            }
            "numberedListItem" => {
                output.push_str(&format!("{padding}1. {text}\n"));
            }
            "checkListItem" => {
                let checked = block
                    .get("props")
                    .and_then(|props| props.get("checked"))
                    .and_then(Value::as_bool)
                    .unwrap_or(false);
                output.push_str(&format!(
                    "{padding}- [{}] {}\n",
                    if checked { "x" } else { " " },
                    text
                ));
            }
            "quote" => {
                output.push_str(&format!("{padding}> {text}\n\n"));
            }
            "codeBlock" => {
                let language = block
                    .get("props")
                    .and_then(|props| props.get("language"))
                    .and_then(Value::as_str)
                    .unwrap_or("");
                output.push_str(&format!("{padding}```{language}\n{text}\n{padding}```\n\n"));
            }
            "divider" => {
                output.push_str(&format!("{padding}---\n\n"));
            }
            _ => {
                output.push_str(&format!("{padding}{text}\n\n"));
            }
        }

        if let Some(children) = block.get("children").and_then(Value::as_array) {
            render_blocks(children, indent + 1, output);
            if !output.ends_with('\n') {
                output.push('\n');
            }
        }
    }
}

fn extract_text_from_content(content: Option<&Value>) -> String {
    match content {
        None => String::new(),
        Some(Value::String(value)) => value.trim().to_string(),
        Some(Value::Array(items)) => items
            .iter()
            .map(|item| match item {
                Value::String(value) => value.clone(),
                Value::Object(map) => map
                    .get("text")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                _ => String::new(),
            })
            .collect::<Vec<_>>()
            .join(" ")
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" "),
        _ => String::new(),
    }
}

fn collect_markdown_files(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    collect_markdown_files_recursive(root, root, &mut files)?;
    files.sort();
    Ok(files)
}

fn collect_markdown_files_recursive(
    root: &Path,
    current: &Path,
    output: &mut Vec<PathBuf>,
) -> Result<(), String> {
    let entries = fs::read_dir(current)
        .map_err(|error| format!("No se pudo leer directorio {}: {error}", current.display()))?;

    for entry in entries {
        let entry =
            entry.map_err(|error| format!("No se pudo leer entrada de directorio: {error}"))?;
        let path = entry.path();
        if path.is_dir() {
            collect_markdown_files_recursive(root, &path, output)?;
            continue;
        }

        let is_markdown = path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.eq_ignore_ascii_case("md") || ext.eq_ignore_ascii_case("markdown"))
            .unwrap_or(false);
        if !is_markdown {
            continue;
        }

        let relative = path
            .strip_prefix(root)
            .map_err(|error| format!("No se pudo resolver ruta relativa: {error}"))?
            .to_path_buf();
        output.push(relative);
    }

    Ok(())
}

fn ensure_folder_hierarchy(
    connection: &Connection,
    workspace_id: &str,
    source_root: &Path,
    relative_parent: &Path,
    folder_cache: &mut HashMap<PathBuf, String>,
) -> Result<String, String> {
    if relative_parent.as_os_str().is_empty() {
        return Ok(workspace_id.to_string());
    }

    let mut current_parent_id = workspace_id.to_string();
    let mut partial = PathBuf::new();

    for segment in relative_parent.components() {
        partial.push(segment.as_os_str());
        if let Some(existing) = folder_cache.get(&partial) {
            current_parent_id = existing.clone();
            continue;
        }

        let folder_name = segment.as_os_str().to_string_lossy().to_string();
        let folder_id = create_node_id("folder");
        let position = next_position_for_parent(connection, Some(&current_parent_id))?;
        let now = now_iso();

        connection
      .execute(
        "INSERT INTO nodes (id, title, type, parent_id, content, icon, tags, position, updated_at)
         VALUES (?1, ?2, 'folder', ?3, NULL, 'folder', '[]', ?4, ?5)",
        params![folder_id, folder_name, current_parent_id, position, now],
      )
      .map_err(|error| {
        format!(
          "No se pudo crear carpeta importada {} en {}: {error}",
          folder_name,
          source_root.display()
        )
      })?;

        folder_cache.insert(partial.clone(), folder_id.clone());
        current_parent_id = folder_id;
    }

    Ok(current_parent_id)
}

fn next_position_for_parent(
    connection: &Connection,
    parent_id: Option<&str>,
) -> Result<i64, String> {
    let max_position = if let Some(parent) = parent_id {
        connection
            .query_row(
                "SELECT MAX(position) FROM nodes WHERE parent_id = ?1",
                params![parent],
                |row| row.get::<_, Option<i64>>(0),
            )
            .map_err(|error| format!("No se pudo leer posicion maxima: {error}"))?
    } else {
        connection
            .query_row(
                "SELECT MAX(position) FROM nodes WHERE parent_id IS NULL",
                [],
                |row| row.get::<_, Option<i64>>(0),
            )
            .map_err(|error| format!("No se pudo leer posicion maxima en raiz: {error}"))?
    };

    Ok(max_position.unwrap_or(-1) + 1)
}

#[derive(Debug, Clone)]
struct ParsedMarkdownFile {
    title: Option<String>,
    tags: Vec<String>,
    related: Vec<String>,
    body: String,
}

fn parse_markdown_file(raw: &str) -> ParsedMarkdownFile {
    if !raw.starts_with("---") {
        return ParsedMarkdownFile {
            title: None,
            tags: Vec::new(),
            related: Vec::new(),
            body: raw.to_string(),
        };
    }

    let mut lines = raw.lines();
    let first = lines.next().unwrap_or_default();
    if first.trim() != "---" {
        return ParsedMarkdownFile {
            title: None,
            tags: Vec::new(),
            related: Vec::new(),
            body: raw.to_string(),
        };
    }

    let mut frontmatter_lines: Vec<String> = Vec::new();
    let mut body_lines: Vec<String> = Vec::new();
    let mut in_frontmatter = true;

    for line in lines {
        if in_frontmatter && line.trim() == "---" {
            in_frontmatter = false;
            continue;
        }
        if in_frontmatter {
            frontmatter_lines.push(line.to_string());
        } else {
            body_lines.push(line.to_string());
        }
    }

    if in_frontmatter {
        return ParsedMarkdownFile {
            title: None,
            tags: Vec::new(),
            related: Vec::new(),
            body: raw.to_string(),
        };
    }

    let mut title: Option<String> = None;
    let mut tags: Vec<String> = Vec::new();
    let mut related: Vec<String> = Vec::new();
    let mut current_list: Option<&str> = None;

    for line in &frontmatter_lines {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        if let Some(rest) = trimmed.strip_prefix("title:") {
            title = Some(rest.trim().trim_matches('"').trim_matches('\'').to_string());
            current_list = None;
            continue;
        }
        if trimmed == "tags:" {
            current_list = Some("tags");
            continue;
        }
        if trimmed == "related:" {
            current_list = Some("related");
            continue;
        }
        if let Some(item) = trimmed.strip_prefix('-') {
            let value = item.trim().trim_matches('"').trim_matches('\'').to_string();
            if value.is_empty() {
                continue;
            }
            match current_list {
                Some("tags") => tags.push(value),
                Some("related") => related.push(value),
                _ => {}
            }
            continue;
        }
        current_list = None;
    }

    ParsedMarkdownFile {
        title,
        tags,
        related,
        body: body_lines.join("\n"),
    }
}

fn markdown_to_blocknote_json(markdown: &str) -> Result<String, String> {
    let mut blocks: Vec<Value> = Vec::new();
    let lines: Vec<&str> = markdown.lines().collect();
    let mut index = 0usize;

    while index < lines.len() {
        let line = lines[index].trim_end();
        let trimmed = line.trim();
        if trimmed.is_empty() {
            index += 1;
            continue;
        }

        if trimmed.starts_with("```") {
            let language = trimmed.trim_start_matches("```").trim().to_string();
            index += 1;
            let mut code_lines: Vec<String> = Vec::new();
            while index < lines.len() {
                let current = lines[index].trim_end();
                if current.trim().starts_with("```") {
                    index += 1;
                    break;
                }
                code_lines.push(current.to_string());
                index += 1;
            }
            blocks.push(json!({
              "type": "codeBlock",
              "props": { "language": language },
              "content": code_lines.join("\n")
            }));
            continue;
        }

        if trimmed.starts_with('#') {
            let level = trimmed
                .chars()
                .take_while(|char| *char == '#')
                .count()
                .clamp(1, 6);
            let text = trimmed[level..].trim();
            blocks.push(json!({
              "type": "heading",
              "props": { "level": level },
              "content": text
            }));
            index += 1;
            continue;
        }

        if trimmed == "---" || trimmed == "***" {
            blocks.push(json!({ "type": "divider" }));
            index += 1;
            continue;
        }

        if let Some(text) = trimmed.strip_prefix("- [ ] ") {
            blocks.push(json!({
              "type": "checkListItem",
              "props": { "checked": false },
              "content": text.trim()
            }));
            index += 1;
            continue;
        }

        if let Some(text) = trimmed
            .strip_prefix("- [x] ")
            .or_else(|| trimmed.strip_prefix("- [X] "))
        {
            blocks.push(json!({
              "type": "checkListItem",
              "props": { "checked": true },
              "content": text.trim()
            }));
            index += 1;
            continue;
        }

        if let Some(text) = trimmed
            .strip_prefix("- ")
            .or_else(|| trimmed.strip_prefix("* "))
        {
            blocks.push(json!({
              "type": "bulletListItem",
              "content": text.trim()
            }));
            index += 1;
            continue;
        }

        if let Some((_, item_text)) = split_numbered_list_item(trimmed) {
            blocks.push(json!({
              "type": "numberedListItem",
              "content": item_text
            }));
            index += 1;
            continue;
        }

        if let Some(text) = trimmed.strip_prefix("> ") {
            blocks.push(json!({
              "type": "quote",
              "content": text.trim()
            }));
            index += 1;
            continue;
        }

        let mut paragraph_lines = vec![trimmed.to_string()];
        index += 1;
        while index < lines.len() {
            let lookahead = lines[index].trim();
            if lookahead.is_empty() || looks_like_new_block(lookahead) {
                break;
            }
            paragraph_lines.push(lookahead.to_string());
            index += 1;
        }
        blocks.push(json!({
          "type": "paragraph",
          "content": paragraph_lines.join(" ")
        }));
    }

    serde_json::to_string(&blocks)
        .map_err(|error| format!("No se pudo serializar bloques BlockNote: {error}"))
}

fn split_numbered_list_item(value: &str) -> Option<(usize, String)> {
    let mut digits = String::new();
    for char in value.chars() {
        if char.is_ascii_digit() {
            digits.push(char);
            continue;
        }
        break;
    }
    if digits.is_empty() {
        return None;
    }
    let rest = value[digits.len()..].trim_start();
    if !rest.starts_with('.') {
        return None;
    }
    let item = rest[1..].trim_start();
    if item.is_empty() {
        return None;
    }
    Some((digits.parse::<usize>().ok()?, item.to_string()))
}

fn looks_like_new_block(value: &str) -> bool {
    value.starts_with('#')
        || value.starts_with("- ")
        || value.starts_with("* ")
        || value.starts_with("- [ ] ")
        || value.starts_with("- [x] ")
        || value.starts_with("- [X] ")
        || value.starts_with("> ")
        || value.starts_with("```")
        || value == "---"
        || value == "***"
        || split_numbered_list_item(value).is_some()
}

fn parse_tags(raw: String) -> Vec<String> {
    match serde_json::from_str::<Value>(&raw) {
        Ok(Value::Array(items)) => items
            .iter()
            .filter_map(Value::as_str)
            .map(str::trim)
            .filter(|tag| !tag.is_empty())
            .map(std::string::ToString::to_string)
            .collect(),
        _ => Vec::new(),
    }
}

fn resolve_parent_segments(
    note: &NoteRecord,
    parent_map: &HashMap<String, (String, Option<String>)>,
) -> Vec<String> {
    let mut segments: Vec<String> = Vec::new();
    let mut cursor = note.parent_id.clone();
    let mut safe_guard = 0;
    while let Some(parent_id) = cursor {
        if safe_guard > 256 {
            break;
        }
        safe_guard += 1;
        let Some((title, parent_parent)) = parent_map.get(&parent_id) else {
            break;
        };
        segments.push(title.clone());
        cursor = parent_parent.clone();
    }
    segments.reverse();
    segments
}

fn sanitize_file_name(value: &str) -> String {
    let trimmed = value.trim();
    let fallback = if trimmed.is_empty() {
        "untitled"
    } else {
        trimmed
    };
    let mut out = String::new();
    for char in fallback.chars() {
        let invalid = matches!(char, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*');
        if invalid || char.is_control() {
            out.push('_');
        } else {
            out.push(char);
        }
    }
    let cleaned = out.trim_matches('.').trim();
    if cleaned.is_empty() {
        "untitled".to_string()
    } else {
        cleaned.to_string()
    }
}

fn escape_frontmatter_scalar(value: &str) -> String {
    if value.contains(':') || value.contains('#') || value.contains('"') || value.contains('\'') {
        format!("\"{}\"", value.replace('"', "\\\""))
    } else {
        value.to_string()
    }
}

fn normalize_lookup_key(value: &str) -> String {
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
    normalized.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn prettify_file_stem(value: &str) -> String {
    let replaced = value.replace(['_', '-'], " ").trim().to_string();
    if replaced.is_empty() {
        "Untitled".to_string()
    } else {
        replaced
    }
}

fn now_iso() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{now}")
}

fn create_node_id(prefix: &str) -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("{prefix}-{nanos:x}")
}

fn to_utf8_path(path: PathBuf) -> Result<String, String> {
    path.to_str()
        .map(std::string::ToString::to_string)
        .ok_or_else(|| "Ruta de archivo no valida para UTF-8.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_markdown_file_reads_frontmatter_lists() {
        let parsed = parse_markdown_file(
            "---\n\
             title: Knowledge Map\n\
             tags:\n\
               - rust\n\
               - trace\n\
             related:\n\
               - Other Note\n\
             ---\n\
             \n\
             # Body\n",
        );

        assert_eq!(parsed.title, Some("Knowledge Map".to_string()));
        assert_eq!(parsed.tags, vec!["rust".to_string(), "trace".to_string()]);
        assert_eq!(parsed.related, vec!["Other Note".to_string()]);
        assert_eq!(parsed.body.trim(), "# Body");
    }

    #[test]
    fn markdown_to_blocknote_json_handles_common_blocks() {
        let json = markdown_to_blocknote_json(
            "# Heading\n\n\
             - Bullet\n\
             1. Numbered\n\
             - [x] Done\n\n\
             ```rs\n\
             fn main() {}\n\
             ```",
        )
        .expect("markdown converts to blocknote json");

        let value: Value = serde_json::from_str(&json).expect("valid json");
        let blocks = value.as_array().expect("top-level block array");

        assert_eq!(blocks[0]["type"], "heading");
        assert_eq!(blocks[0]["props"]["level"], 1);
        assert_eq!(blocks[1]["type"], "bulletListItem");
        assert_eq!(blocks[2]["type"], "numberedListItem");
        assert_eq!(blocks[3]["type"], "checkListItem");
        assert_eq!(blocks[3]["props"]["checked"], true);
        assert_eq!(blocks[4]["type"], "codeBlock");
        assert_eq!(blocks[4]["props"]["language"], "rs");
    }

    #[test]
    fn blocks_json_to_markdown_renders_basic_blocks() {
        let content = json!([
          {
            "type": "heading",
            "props": { "level": 2 },
            "content": "Plan"
          },
          {
            "type": "bulletListItem",
            "content": "Task"
          },
          {
            "type": "checkListItem",
            "props": { "checked": true },
            "content": "Done"
          }
        ])
        .to_string();

        let markdown = blocks_json_to_markdown(&content).expect("blocks render to markdown");

        assert!(markdown.contains("## Plan"));
        assert!(markdown.contains("- Task"));
        assert!(markdown.contains("- [x] Done"));
    }

    #[test]
    fn sanitize_file_name_removes_invalid_path_characters() {
        assert_eq!(sanitize_file_name("a/b:c*"), "a_b_c_");
        assert_eq!(sanitize_file_name("..."), "untitled");
        assert_eq!(sanitize_file_name(""), "untitled");
    }
}
