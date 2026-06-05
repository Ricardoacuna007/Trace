use rusqlite::Connection;

pub fn ensure_trace_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "
      PRAGMA foreign_keys=ON;
      PRAGMA journal_mode=WAL;
      PRAGMA synchronous=NORMAL;

      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('workspace', 'folder', 'note')),
        parent_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
        content TEXT,
        icon TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        position INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS note_relations (
        source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        PRIMARY KEY (source_id, target_id)
      );

      CREATE INDEX IF NOT EXISTS idx_nodes_parent_position ON nodes(parent_id, position);
      CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
      CREATE INDEX IF NOT EXISTS idx_note_relations_source ON note_relations(source_id);
      CREATE INDEX IF NOT EXISTS idx_note_relations_target ON note_relations(target_id);
      ",
        )
        .map_err(|error| format!("No se pudo asegurar el esquema Trace: {error}"))?;

    ensure_column(
        connection,
        "nodes",
        "tags",
        "ALTER TABLE nodes ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'",
    )?;

    let _ = ensure_nodes_fts_schema(connection);
    Ok(())
}

pub fn ensure_markdown_index_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "
      CREATE TABLE IF NOT EXISTS markdown_index (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL UNIQUE,
        relative_path TEXT NOT NULL,
        title TEXT NOT NULL,
        properties_json TEXT NOT NULL,
        modified_at TEXT NOT NULL,
        indexed_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_markdown_index_relative_path ON markdown_index(relative_path);
      CREATE INDEX IF NOT EXISTS idx_markdown_index_indexed_at ON markdown_index(indexed_at);
      ",
        )
        .map_err(|error| format!("No se pudo crear el esquema markdown_index: {error}"))
}

fn ensure_column(
    connection: &Connection,
    table: &str,
    column: &str,
    alter_sql: &str,
) -> Result<(), String> {
    if has_column(connection, table, column)? {
        return Ok(());
    }

    connection
        .execute(alter_sql, [])
        .map_err(|error| format!("No se pudo agregar columna {column} en {table}: {error}"))?;
    Ok(())
}

fn has_column(connection: &Connection, table: &str, column: &str) -> Result<bool, String> {
    let mut statement = connection
        .prepare(&format!("PRAGMA table_info({table})"))
        .map_err(|error| format!("No se pudo leer columnas de {table}: {error}"))?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("No se pudo consultar columnas de {table}: {error}"))?;

    for row in rows {
        if row.map_err(|error| format!("No se pudo leer columna de {table}: {error}"))? == column {
            return Ok(true);
        }
    }

    Ok(false)
}

fn ensure_nodes_fts_schema(connection: &Connection) -> Result<(), rusqlite::Error> {
    connection.execute_batch(
        "
      CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
        note_id UNINDEXED,
        title,
        content,
        tags,
        tokenize='unicode61 remove_diacritics 2'
      );

      CREATE TRIGGER IF NOT EXISTS nodes_ai_fts
      AFTER INSERT ON nodes
      WHEN NEW.type = 'note'
      BEGIN
        INSERT INTO nodes_fts (note_id, title, content, tags)
        VALUES (NEW.id, NEW.title, COALESCE(NEW.content, ''), COALESCE(NEW.tags, '[]'));
      END;

      CREATE TRIGGER IF NOT EXISTS nodes_au_fts
      AFTER UPDATE ON nodes
      BEGIN
        DELETE FROM nodes_fts WHERE note_id = OLD.id;
        INSERT INTO nodes_fts (note_id, title, content, tags)
        SELECT NEW.id, NEW.title, COALESCE(NEW.content, ''), COALESCE(NEW.tags, '[]')
        WHERE NEW.type = 'note';
      END;

      CREATE TRIGGER IF NOT EXISTS nodes_ad_fts
      AFTER DELETE ON nodes
      WHEN OLD.type = 'note'
      BEGIN
        DELETE FROM nodes_fts WHERE note_id = OLD.id;
      END;
      ",
    )?;

    connection.execute("DELETE FROM nodes_fts", [])?;
    connection.execute(
        "
      INSERT INTO nodes_fts (note_id, title, content, tags)
      SELECT id, title, COALESCE(content, ''), COALESCE(tags, '[]')
      FROM nodes
      WHERE type = 'note'
      ",
        [],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ensure_trace_schema_creates_core_tables_and_indexes() {
        let connection = Connection::open_in_memory().expect("in-memory sqlite opens");

        ensure_trace_schema(&connection).expect("trace schema is created");

        assert!(table_exists(&connection, "nodes"));
        assert!(table_exists(&connection, "note_relations"));
        assert!(index_exists(&connection, "idx_nodes_parent_position"));
        assert!(has_column(&connection, "nodes", "tags").expect("tags column check works"));
    }

    #[test]
    fn ensure_trace_schema_adds_tags_column_to_existing_nodes_table() {
        let connection = Connection::open_in_memory().expect("in-memory sqlite opens");
        connection
            .execute_batch(
                "
        CREATE TABLE nodes (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('workspace', 'folder', 'note')),
          parent_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
          content TEXT,
          icon TEXT,
          position INTEGER NOT NULL,
          updated_at TEXT NOT NULL
        );
        ",
            )
            .expect("legacy nodes table is created");

        ensure_trace_schema(&connection).expect("legacy schema migrates");

        assert!(has_column(&connection, "nodes", "tags").expect("tags column check works"));
    }

    #[test]
    fn ensure_markdown_index_schema_creates_index_table() {
        let connection = Connection::open_in_memory().expect("in-memory sqlite opens");

        ensure_markdown_index_schema(&connection).expect("markdown index schema is created");

        assert!(table_exists(&connection, "markdown_index"));
        assert!(index_exists(
            &connection,
            "idx_markdown_index_relative_path"
        ));
    }

    fn table_exists(connection: &Connection, name: &str) -> bool {
        connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
                [name],
                |row| row.get::<_, i64>(0),
            )
            .unwrap_or_default()
            > 0
    }

    fn index_exists(connection: &Connection, name: &str) -> bool {
        connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = ?1",
                [name],
                |row| row.get::<_, i64>(0),
            )
            .unwrap_or_default()
            > 0
    }
}
