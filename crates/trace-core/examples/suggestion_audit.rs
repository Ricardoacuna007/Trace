use std::{env, path::PathBuf, process};

use rusqlite::{Connection, OpenFlags};
use trace_core::suggestions::suggest_connections;

#[derive(Debug)]
struct NoteSummary {
    id: String,
    title: String,
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let args = env::args().skip(1).collect::<Vec<_>>();
    if args.is_empty() || args.iter().any(|arg| arg == "-h" || arg == "--help") {
        print_usage();
        return Ok(());
    }

    let db_path = PathBuf::from(&args[0]);
    let notes_limit = parse_optional_usize(args.get(1), 30)?;
    let suggestions_limit = parse_optional_usize(args.get(2), 5)?;

    let connection = Connection::open_with_flags(db_path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    require_table(&connection, "nodes")?;
    require_table(&connection, "nodes_fts")?;
    require_table(&connection, "ignored_suggestions")?;

    let notes = load_recent_notes(&connection, notes_limit)?;
    if notes.is_empty() {
        println!("No hay notas para auditar.");
        return Ok(());
    }

    println!("# Trace suggestion audit");
    println!();
    println!("- Notas auditadas: {}", notes.len());
    println!("- Sugerencias por nota: {suggestions_limit}");
    if notes.len() < 20 {
        println!("- Aviso: para calibrar v0.3 usa idealmente 20-30 notas reales.");
    }
    println!();

    let mut notes_with_suggestions = 0usize;
    let mut suggestions_total = 0usize;

    for note in &notes {
        let suggestions = suggest_connections(&connection, &note.id, Some(suggestions_limit))?;
        if !suggestions.is_empty() {
            notes_with_suggestions += 1;
            suggestions_total += suggestions.len();
        }

        println!("## {}", note.title);
        if suggestions.is_empty() {
            println!("- Sin sugerencias nuevas.");
            println!();
            continue;
        }

        for (index, suggestion) in suggestions.iter().enumerate() {
            let fragment = if suggestion.fragment.is_empty() {
                "(sin fragmento)"
            } else {
                suggestion.fragment.as_str()
            };
            println!(
                "{}. {} [{}%] - {}",
                index + 1,
                suggestion.title,
                suggestion.score_percent,
                fragment.replace('\n', " ")
            );
        }
        println!();
    }

    println!("# Summary");
    println!();
    println!(
        "- Notas con al menos una sugerencia: {}/{}",
        notes_with_suggestions,
        notes.len()
    );
    println!("- Sugerencias totales revisables: {suggestions_total}");
    println!(
        "- Calibracion manual: marca cada top-3 como util, ruido o faltante en docs/v0.3-release-qa.md."
    );

    Ok(())
}

fn print_usage() {
    println!("Usage:");
    println!(
        "  cargo run -p trace-core --example suggestion_audit -- <trace.db> [notes] [suggestions]"
    );
    println!();
    println!("Examples:");
    println!("  cargo run -p trace-core --example suggestion_audit -- ./trace-data/trace.db 30 5");
    println!("  cargo run -p trace-core --example suggestion_audit -- C:\\\\Users\\\\you\\\\vault\\\\.trace\\\\trace.db");
}

fn parse_optional_usize(value: Option<&String>, fallback: usize) -> Result<usize, String> {
    match value {
        Some(raw) => raw
            .parse::<usize>()
            .map(|parsed| parsed.max(1))
            .map_err(|_| format!("Parametro numerico invalido: {raw}")),
        None => Ok(fallback),
    }
}

fn require_table(connection: &Connection, table: &str) -> Result<(), String> {
    let exists: i64 = connection
        .query_row(
            "SELECT COUNT(*)
             FROM sqlite_master
             WHERE type IN ('table', 'view')
               AND name = ?1",
            [table],
            |row| row.get(0),
        )
        .map_err(|error| format!("No se pudo inspeccionar SQLite: {error}"))?;

    if exists == 0 {
        return Err(format!(
            "La tabla {table} no existe. Abre la boveda una vez con Trace v0.3 antes de auditar."
        ));
    }

    Ok(())
}

fn load_recent_notes(
    connection: &Connection,
    limit: usize,
) -> Result<Vec<NoteSummary>, rusqlite::Error> {
    let mut statement = connection.prepare(
        "SELECT id, title
         FROM nodes
         WHERE type = 'note'
           AND COALESCE(inbox, 0) = 0
         ORDER BY updated_at DESC, position ASC
         LIMIT ?1",
    )?;
    let rows = statement.query_map([limit as i64], |row| {
        Ok(NoteSummary {
            id: row.get(0)?,
            title: row.get(1)?,
        })
    })?;
    rows.collect()
}
