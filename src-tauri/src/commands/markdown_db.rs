use super::{
    schema::{ensure_markdown_index_schema, ensure_trace_schema},
    vault::{resolve_active_vault_db_path, resolve_active_vault_path},
};
use rusqlite::{params, Connection, OpenFlags};
use serde::Serialize;
use serde_json::{Map, Value};
use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontmatterColumnDto {
    pub key: String,
    pub value_type: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontmatterRowDto {
    pub id: String,
    pub file_path: String,
    pub relative_path: String,
    pub title: String,
    pub properties: Value,
    pub modified_at: String,
    pub indexed_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontmatterSnapshotDto {
    pub vault_path: String,
    pub indexed_files: u32,
    pub columns: Vec<FrontmatterColumnDto>,
    pub rows: Vec<FrontmatterRowDto>,
    pub generated_at: String,
}

#[derive(Debug, Clone)]
struct ParsedMarkdown {
    properties: Map<String, Value>,
    body: String,
}

#[tauri::command]
pub fn scan_markdown_database(app_handle: AppHandle) -> Result<FrontmatterSnapshotDto, String> {
    let vault_path = resolve_active_vault_path(&app_handle)?
        .ok_or_else(|| "No hay una boveda activa.".to_string())?;
    let db_path = resolve_active_vault_db_path(&app_handle)?
        .ok_or_else(|| "No se encontro trace.db para indexar Markdown.".to_string())?;

    let connection = open_db_rw(db_path)?;
    ensure_trace_schema(&connection)?;
    ensure_markdown_index_schema(&connection)?;

    let files = collect_markdown_files(&vault_path)?;
    for file in &files {
        index_markdown_file(&connection, &vault_path, file)?;
    }

    let rows = load_index_rows(&connection)?;
    let columns = infer_columns(&rows);

    Ok(FrontmatterSnapshotDto {
        vault_path: to_utf8_string(vault_path)?,
        indexed_files: rows.len() as u32,
        columns,
        rows,
        generated_at: now_millis_string(),
    })
}

#[tauri::command]
pub fn update_markdown_frontmatter_property(
    app_handle: AppHandle,
    file_path: String,
    key: String,
    value: Value,
) -> Result<FrontmatterRowDto, String> {
    let vault_path = resolve_active_vault_path(&app_handle)?
        .ok_or_else(|| "No hay una boveda activa.".to_string())?;
    let db_path = resolve_active_vault_db_path(&app_handle)?
        .ok_or_else(|| "No se encontro trace.db para actualizar Markdown.".to_string())?;

    let target_file = resolve_target_markdown_path(&vault_path, file_path.trim())?;
    if !target_file.exists() || !target_file.is_file() {
        return Err("El archivo Markdown no existe.".to_string());
    }

    let raw = fs::read_to_string(&target_file)
        .map_err(|error| format!("No se pudo leer el archivo Markdown: {error}"))?;
    let mut parsed = parse_markdown_with_frontmatter(&raw);
    let normalized_key = key.trim();
    if normalized_key.is_empty() {
        return Err("La propiedad a actualizar no puede estar vacia.".to_string());
    }

    if value.is_null() {
        parsed.properties.remove(normalized_key);
    } else {
        parsed.properties.insert(normalized_key.to_string(), value);
    }

    if !parsed.properties.contains_key("title") {
        let fallback_title = target_file
            .file_stem()
            .and_then(|stem| stem.to_str())
            .map(std::string::ToString::to_string)
            .unwrap_or_else(|| "Untitled".to_string());
        parsed
            .properties
            .insert("title".to_string(), Value::String(fallback_title));
    }

    let rebuilt = compose_markdown_with_frontmatter(&parsed.properties, &parsed.body);
    fs::write(&target_file, rebuilt.as_bytes())
        .map_err(|error| format!("No se pudo escribir el archivo Markdown: {error}"))?;

    let connection = open_db_rw(db_path)?;
    ensure_trace_schema(&connection)?;
    ensure_markdown_index_schema(&connection)?;
    index_markdown_file(&connection, &vault_path, &target_file)?;

    let canonical_target = fs::canonicalize(&target_file).unwrap_or(target_file);
    let row = load_index_row_by_path(&connection, &canonical_target)?;
    Ok(row)
}

fn open_db_rw(db_path: PathBuf) -> Result<Connection, String> {
    let connection = Connection::open_with_flags(
        db_path,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE,
    )
    .map_err(|error| format!("No se pudo abrir SQLite para index Markdown: {error}"))?;
    let _ = connection.busy_timeout(Duration::from_millis(1400));
    Ok(connection)
}

fn collect_markdown_files(vault_path: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    collect_markdown_files_recursive(vault_path, vault_path, &mut files)?;
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
            entry.map_err(|error| format!("No se pudo leer entrada del directorio: {error}"))?;
        let path = entry.path();

        if path.is_dir() {
            if path
                .file_name()
                .and_then(|name| name.to_str())
                .map(|name| name.eq_ignore_ascii_case(".trace"))
                .unwrap_or(false)
            {
                continue;
            }
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

        let canonical = fs::canonicalize(&path).unwrap_or(path.clone());
        if canonical.starts_with(root) {
            output.push(canonical);
        }
    }

    Ok(())
}

fn index_markdown_file(
    connection: &Connection,
    vault_path: &Path,
    file_path: &Path,
) -> Result<(), String> {
    let raw = fs::read_to_string(file_path)
        .map_err(|error| format!("No se pudo leer {}: {error}", file_path.display()))?;
    let mut parsed = parse_markdown_with_frontmatter(&raw);

    let title = parsed
        .properties
        .get("title")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(std::string::ToString::to_string)
        .unwrap_or_else(|| {
            file_path
                .file_stem()
                .and_then(|stem| stem.to_str())
                .map(std::string::ToString::to_string)
                .unwrap_or_else(|| "Untitled".to_string())
        });
    parsed
        .properties
        .insert("title".to_string(), Value::String(title.clone()));

    let relative_path = file_path
        .strip_prefix(vault_path)
        .map_err(|error| format!("No se pudo obtener ruta relativa para indexado: {error}"))?
        .to_string_lossy()
        .replace('\\', "/");
    let canonical_file = fs::canonicalize(file_path).unwrap_or_else(|_| file_path.to_path_buf());
    let canonical_file_str = to_utf8_string(canonical_file)?;
    let modified_at = fs::metadata(file_path)
        .and_then(|meta| meta.modified())
        .map(system_time_to_millis_string)
        .unwrap_or_else(|_| now_millis_string());
    let indexed_at = now_millis_string();
    let properties_json = Value::Object(parsed.properties.clone()).to_string();
    let id = relative_path.clone();

    connection
    .execute(
      "INSERT INTO markdown_index (id, file_path, relative_path, title, properties_json, modified_at, indexed_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       ON CONFLICT(file_path) DO UPDATE SET
         id = excluded.id,
         relative_path = excluded.relative_path,
         title = excluded.title,
         properties_json = excluded.properties_json,
         modified_at = excluded.modified_at,
         indexed_at = excluded.indexed_at",
      params![
        id,
        canonical_file_str,
        relative_path,
        title,
        properties_json,
        modified_at,
        indexed_at
      ],
    )
    .map_err(|error| format!("No se pudo indexar archivo Markdown: {error}"))?;

    Ok(())
}

fn load_index_rows(connection: &Connection) -> Result<Vec<FrontmatterRowDto>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, file_path, relative_path, title, properties_json, modified_at, indexed_at
       FROM markdown_index
       ORDER BY indexed_at DESC, relative_path ASC",
        )
        .map_err(|error| format!("No se pudo preparar lectura de markdown_index: {error}"))?;

    let rows = statement
        .query_map([], |row| {
            let raw_properties: String = row.get(4)?;
            let properties = serde_json::from_str::<Value>(&raw_properties)
                .unwrap_or_else(|_| Value::Object(Map::new()));

            Ok(FrontmatterRowDto {
                id: row.get(0)?,
                file_path: row.get(1)?,
                relative_path: row.get(2)?,
                title: row.get(3)?,
                properties,
                modified_at: row.get(5)?,
                indexed_at: row.get(6)?,
            })
        })
        .map_err(|error| format!("No se pudo ejecutar lectura de markdown_index: {error}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("No se pudo convertir filas de markdown_index: {error}"))
}

fn load_index_row_by_path(
    connection: &Connection,
    file_path: &Path,
) -> Result<FrontmatterRowDto, String> {
    let normalized = to_utf8_string(file_path.to_path_buf())?;
    connection
        .query_row(
            "SELECT id, file_path, relative_path, title, properties_json, modified_at, indexed_at
       FROM markdown_index
       WHERE file_path = ?1",
            params![normalized],
            |row| {
                let raw_properties: String = row.get(4)?;
                let properties = serde_json::from_str::<Value>(&raw_properties)
                    .unwrap_or_else(|_| Value::Object(Map::new()));

                Ok(FrontmatterRowDto {
                    id: row.get(0)?,
                    file_path: row.get(1)?,
                    relative_path: row.get(2)?,
                    title: row.get(3)?,
                    properties,
                    modified_at: row.get(5)?,
                    indexed_at: row.get(6)?,
                })
            },
        )
        .map_err(|error| format!("No se pudo recuperar fila Markdown indexada: {error}"))
}

fn infer_columns(rows: &[FrontmatterRowDto]) -> Vec<FrontmatterColumnDto> {
    let mut keys = BTreeSet::new();
    for row in rows {
        if let Some(properties) = row.properties.as_object() {
            for key in properties.keys() {
                keys.insert(key.clone());
            }
        }
    }

    keys.into_iter()
        .map(|key| {
            let value_type = rows
                .iter()
                .filter_map(|row| row.properties.get(&key))
                .find(|value| !value.is_null())
                .map(infer_value_type)
                .unwrap_or_else(|| "text".to_string());
            FrontmatterColumnDto { key, value_type }
        })
        .collect()
}

fn infer_value_type(value: &Value) -> String {
    match value {
        Value::Bool(_) => "checkbox".to_string(),
        Value::Number(_) => "number".to_string(),
        Value::Array(_) => "multi".to_string(),
        Value::Object(_) => "json".to_string(),
        Value::String(text) => {
            if looks_like_date(text) {
                "date".to_string()
            } else {
                "text".to_string()
            }
        }
        Value::Null => "text".to_string(),
    }
}

fn looks_like_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 10 {
        return false;
    }
    bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| matches!(index, 4 | 7) || byte.is_ascii_digit())
}

fn parse_markdown_with_frontmatter(raw: &str) -> ParsedMarkdown {
    let normalized = raw.replace("\r\n", "\n");
    if !normalized.starts_with("---\n") {
        return ParsedMarkdown {
            properties: Map::new(),
            body: normalized,
        };
    }

    let rest = &normalized[4..];
    if let Some(end_index) = rest.find("\n---\n") {
        let header = &rest[..end_index];
        let body = rest[(end_index + 5)..].to_string();
        let properties = parse_frontmatter_block(header);
        return ParsedMarkdown { properties, body };
    }

    ParsedMarkdown {
        properties: Map::new(),
        body: normalized,
    }
}

fn parse_frontmatter_block(block: &str) -> Map<String, Value> {
    let trimmed = block.trim();
    if trimmed.starts_with('{') && trimmed.ends_with('}') {
        if let Ok(Value::Object(map)) = serde_json::from_str::<Value>(trimmed) {
            return map;
        }
    }

    let mut map = Map::new();
    let mut current_array_key: Option<String> = None;

    for line in block.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if let Some(item) = trimmed.strip_prefix('-') {
            if let Some(key) = &current_array_key {
                if let Some(Value::Array(items)) = map.get_mut(key) {
                    items.push(parse_scalar(item.trim()));
                    continue;
                }
            }
        }

        if let Some((key_raw, value_raw)) = trimmed.split_once(':') {
            let key = key_raw.trim().to_string();
            let value_text = value_raw.trim();
            if key.is_empty() {
                current_array_key = None;
                continue;
            }

            if value_text.is_empty() {
                map.insert(key.clone(), Value::Array(Vec::new()));
                current_array_key = Some(key);
            } else {
                map.insert(key, parse_scalar(value_text));
                current_array_key = None;
            }
        } else {
            current_array_key = None;
        }
    }

    map
}

fn parse_scalar(raw: &str) -> Value {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Value::String(String::new());
    }

    if (trimmed.starts_with('"') && trimmed.ends_with('"'))
        || (trimmed.starts_with('\'') && trimmed.ends_with('\''))
    {
        return Value::String(trimmed[1..trimmed.len() - 1].to_string());
    }

    if trimmed.eq_ignore_ascii_case("true") {
        return Value::Bool(true);
    }
    if trimmed.eq_ignore_ascii_case("false") {
        return Value::Bool(false);
    }
    if trimmed.eq_ignore_ascii_case("null") {
        return Value::Null;
    }

    if (trimmed.starts_with('{') && trimmed.ends_with('}'))
        || (trimmed.starts_with('[') && trimmed.ends_with(']'))
    {
        if let Ok(parsed) = serde_json::from_str::<Value>(trimmed) {
            return parsed;
        }
    }

    if let Ok(number) = trimmed.parse::<i64>() {
        return Value::Number(number.into());
    }
    if let Ok(number) = trimmed.parse::<f64>() {
        if let Some(serialized) = serde_json::Number::from_f64(number) {
            return Value::Number(serialized);
        }
    }

    Value::String(trimmed.to_string())
}

fn compose_markdown_with_frontmatter(properties: &Map<String, Value>, body: &str) -> String {
    let mut keys = properties.keys().cloned().collect::<Vec<_>>();
    keys.sort();

    let mut output = String::new();
    output.push_str("---\n");

    for key in keys {
        if let Some(value) = properties.get(&key) {
            match value {
                Value::Array(items) => {
                    output.push_str(&format!("{key}:\n"));
                    for item in items {
                        output.push_str(&format!("  - {}\n", serialize_scalar(item)));
                    }
                }
                Value::Object(object) => {
                    output.push_str(&format!("{key}: {}\n", Value::Object(object.clone())));
                }
                _ => {
                    output.push_str(&format!("{key}: {}\n", serialize_scalar(value)));
                }
            }
        }
    }

    output.push_str("---\n");
    if !body.is_empty() {
        output.push_str(body);
        if !output.ends_with('\n') {
            output.push('\n');
        }
    }
    output
}

fn serialize_scalar(value: &Value) -> String {
    match value {
        Value::Null => "null".to_string(),
        Value::Bool(boolean) => boolean.to_string(),
        Value::Number(number) => number.to_string(),
        Value::String(text) => {
            let is_plain = text
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '.' | '/' | ' '));
            if is_plain && !text.contains(':') && !text.starts_with(' ') && !text.ends_with(' ') {
                text.to_string()
            } else {
                serde_json::to_string(text).unwrap_or_else(|_| "\"\"".to_string())
            }
        }
        Value::Array(_) | Value::Object(_) => value.to_string(),
    }
}

fn resolve_target_markdown_path(vault_path: &Path, candidate: &str) -> Result<PathBuf, String> {
    let candidate_path = PathBuf::from(candidate);
    let absolute = if candidate_path.is_absolute() {
        candidate_path
    } else {
        vault_path.join(candidate_path)
    };

    let canonical_vault = fs::canonicalize(vault_path).unwrap_or_else(|_| vault_path.to_path_buf());
    let canonical_target = fs::canonicalize(&absolute).unwrap_or(absolute.clone());
    if !canonical_target.starts_with(&canonical_vault) {
        return Err("La ruta de archivo esta fuera de la boveda activa.".to_string());
    }

    Ok(canonical_target)
}

fn now_millis_string() -> String {
    system_time_to_millis_string(SystemTime::now())
}

fn system_time_to_millis_string(value: SystemTime) -> String {
    value
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .to_string()
}

fn to_utf8_string(path: PathBuf) -> Result<String, String> {
    path.to_str()
        .map(std::string::ToString::to_string)
        .ok_or_else(|| "Ruta de archivo no valida para UTF-8.".to_string())
}
