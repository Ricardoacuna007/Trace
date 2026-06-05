use std::{
    collections::HashMap,
    fs::File,
    io::{Cursor, Read, Write},
    net::SocketAddr,
    path::{Path as StdPath, PathBuf},
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

use anyhow::{Context, Result};
use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    body::{Body, Bytes},
    extract::{DefaultBodyLimit, Path, State},
    http::{header, HeaderValue, Request, StatusCode, Uri},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use clap::Parser;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use rand_core::OsRng;
use rusqlite::{params, Connection, OptionalExtension};
use rust_embed::RustEmbed;
use serde::{Deserialize, Serialize};
use tower_http::trace::TraceLayer;
use trace_core::{
    auth::Claims,
    graph,
    notes::{self, CreateNoteInput, DeletedResponse, UpdateNoteInput},
    schema,
};
use uuid::Uuid;
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};

#[derive(Parser, Debug)]
#[command(name = "trace-server")]
#[command(about = "Trace self-hosted all-in-one server")]
struct Args {
    #[arg(long, env = "TRACE_DATA_DIR", default_value = "./trace-data")]
    data_dir: PathBuf,

    #[arg(long, env = "TRACE_BIND", default_value = "127.0.0.1:8080")]
    bind: SocketAddr,
}

#[derive(Clone)]
struct AppState {
    db_path: Arc<PathBuf>,
    jwt_secret: Arc<String>,
    auth_attempts: Arc<Mutex<HashMap<String, Vec<i64>>>>,
}

#[derive(RustEmbed)]
#[folder = "web-dist"]
struct WebAssets;

const FALLBACK_INDEX_HTML: &str = include_str!("../web/index.html");
const MAX_REQUEST_BODY_BYTES: usize = 256 * 1024 * 1024;
const MAX_RESTORE_DB_BYTES: u64 = 256 * 1024 * 1024;
const AUTH_RATE_LIMIT_MAX_ATTEMPTS: usize = 8;
const AUTH_RATE_LIMIT_WINDOW_SECONDS: i64 = 15 * 60;
const CONTENT_SECURITY_POLICY: &str = concat!(
    "default-src 'self'; ",
    "script-src 'self'; ",
    "style-src 'self' 'unsafe-inline'; ",
    "img-src 'self' data: blob:; ",
    "font-src 'self' data:; ",
    "connect-src 'self'; ",
    "object-src 'none'; ",
    "base-uri 'self'; ",
    "frame-ancestors 'none'"
);

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    version: &'static str,
}

#[derive(Serialize)]
struct SetupStatusResponse {
    setup_required: bool,
}

#[derive(Deserialize)]
struct SetupRequest {
    workspace_name: String,
    email: String,
    password: String,
}

#[derive(Deserialize)]
struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Serialize)]
struct AuthResponse {
    token: String,
    user_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConnectNotesRequest {
    source_id: String,
    target_ids: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RestoreResponse {
    restored: bool,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "trace_server=info,tower_http=info".into()),
        )
        .init();

    let args = Args::parse();
    let state = initialize_state(args.data_dir)?;

    let app = build_router(state);

    let listener = tokio::net::TcpListener::bind(args.bind)
        .await
        .with_context(|| format!("No se pudo abrir servidor en {}", args.bind))?;

    tracing::info!("trace-server listening on http://{}", args.bind);
    axum::serve(listener, app)
        .await
        .context("trace-server se detuvo inesperadamente")?;

    Ok(())
}

fn build_router(state: AppState) -> Router {
    let protected_api = Router::new()
        .route("/api/notes", get(api_list_notes).post(api_create_note))
        .route(
            "/api/notes/:id",
            get(api_get_note)
                .put(api_update_note)
                .delete(api_delete_note),
        )
        .route("/api/relations", get(api_list_relations))
        .route("/api/relations/connect", post(api_connect_notes))
        .route("/api/graph", get(api_graph))
        .route("/api/backup", post(api_backup))
        .route("/api/restore", post(api_restore))
        .route_layer(middleware::from_fn_with_state(state.clone(), require_auth));

    Router::new()
        .route("/", get(index))
        .route("/setup", get(setup_page).post(setup))
        .route("/health", get(health))
        .route("/api/setup/status", get(setup_status))
        .route("/api/auth/login", post(login))
        .merge(protected_api)
        .fallback(static_asset)
        .with_state(state)
        .layer(middleware::from_fn(security_headers))
        .layer(DefaultBodyLimit::max(MAX_REQUEST_BODY_BYTES))
        .layer(TraceLayer::new_for_http())
}

fn initialize_state(data_dir: PathBuf) -> Result<AppState> {
    std::fs::create_dir_all(&data_dir)
        .with_context(|| format!("No se pudo crear data-dir {}", data_dir.display()))?;

    let db_path = data_dir.join("trace.db");
    let connection = open_connection(&db_path)?;
    schema::ensure_trace_schema(&connection).map_err(anyhow::Error::msg)?;
    schema::ensure_markdown_index_schema(&connection).map_err(anyhow::Error::msg)?;
    ensure_server_schema(&connection)?;
    let jwt_secret = get_or_create_jwt_secret(&connection)?;

    Ok(AppState {
        db_path: Arc::new(db_path),
        jwt_secret: Arc::new(jwt_secret),
        auth_attempts: Arc::new(Mutex::new(HashMap::new())),
    })
}

fn open_connection(db_path: &PathBuf) -> Result<Connection> {
    let connection = Connection::open(db_path)
        .with_context(|| format!("No se pudo abrir SQLite en {}", db_path.display()))?;
    connection
        .execute_batch(
            "
            PRAGMA foreign_keys=ON;
            PRAGMA journal_mode=WAL;
            PRAGMA synchronous=NORMAL;
            ",
        )
        .context("No se pudieron aplicar pragmas SQLite")?;
    Ok(connection)
}

fn ensure_server_schema(connection: &Connection) -> Result<()> {
    connection
        .execute_batch(
            "
            CREATE TABLE IF NOT EXISTS server_settings (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS server_users (
              id TEXT PRIMARY KEY,
              email TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL,
              role TEXT NOT NULL,
              created_at TEXT NOT NULL
            );
            ",
        )
        .context("No se pudo asegurar schema del servidor")
}

fn get_or_create_jwt_secret(connection: &Connection) -> Result<String> {
    if let Some(secret) = connection
        .query_row(
            "SELECT value FROM server_settings WHERE key = 'jwt_secret'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .context("No se pudo leer jwt_secret")?
    {
        return Ok(secret);
    }

    let secret = format!("{}{}", Uuid::new_v4(), Uuid::new_v4());
    connection
        .execute(
            "INSERT INTO server_settings (key, value) VALUES ('jwt_secret', ?1)",
            [secret.as_str()],
        )
        .context("No se pudo guardar jwt_secret")?;
    Ok(secret)
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        version: env!("CARGO_PKG_VERSION"),
    })
}

async fn index() -> Response {
    serve_index()
}

async fn setup_page(State(state): State<AppState>) -> Response {
    match admin_exists(&state) {
        Ok(false) => serve_index(),
        Ok(true) => StatusCode::NOT_FOUND.into_response(),
        Err(error) => server_error(error),
    }
}

async fn static_asset(uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');

    if path.starts_with("api/") {
        return StatusCode::NOT_FOUND.into_response();
    }

    if path.is_empty() {
        return serve_index();
    }

    embedded_asset(path).unwrap_or_else(serve_index)
}

async fn setup_status(State(state): State<AppState>) -> Response {
    match admin_exists(&state) {
        Ok(admin_exists) => Json(SetupStatusResponse {
            setup_required: !admin_exists,
        })
        .into_response(),
        Err(error) => server_error(error),
    }
}

async fn setup(State(state): State<AppState>, Json(payload): Json<SetupRequest>) -> Response {
    let rate_limit_key = auth_rate_limit_key("setup", &payload.email);
    match allow_auth_attempt(&state, &rate_limit_key) {
        Ok(true) => {}
        Ok(false) => return too_many_requests("Demasiados intentos de setup"),
        Err(error) => return server_error(error),
    }

    match create_admin(&state, payload) {
        Ok(auth) => {
            clear_auth_attempts(&state, &rate_limit_key);
            (StatusCode::CREATED, Json(auth)).into_response()
        }
        Err(SetupError::AlreadyConfigured) => StatusCode::NOT_FOUND.into_response(),
        Err(SetupError::BadRequest(message)) => {
            (StatusCode::BAD_REQUEST, Json(error_body(&message))).into_response()
        }
        Err(SetupError::Internal(error)) => server_error(error),
    }
}

async fn login(State(state): State<AppState>, Json(payload): Json<LoginRequest>) -> Response {
    let rate_limit_key = auth_rate_limit_key("login", &payload.email);
    match allow_auth_attempt(&state, &rate_limit_key) {
        Ok(true) => {}
        Ok(false) => return too_many_requests("Demasiados intentos de login"),
        Err(error) => return server_error(error),
    }

    match login_user(&state, payload) {
        Ok(Some(auth)) => {
            clear_auth_attempts(&state, &rate_limit_key);
            Json(auth).into_response()
        }
        Ok(None) => (
            StatusCode::UNAUTHORIZED,
            Json(error_body("Credenciales invalidas")),
        )
            .into_response(),
        Err(error) => server_error(error),
    }
}

async fn require_auth(
    State(state): State<AppState>,
    mut request: Request<Body>,
    next: Next,
) -> Response {
    let Some(token) = bearer_token(&request) else {
        return unauthorized();
    };

    let validation = Validation::default();
    let claims = match decode::<Claims>(
        token,
        &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
        &validation,
    ) {
        Ok(token_data) => token_data.claims,
        Err(error) => {
            tracing::warn!("JWT invalido: {error}");
            return unauthorized();
        }
    };

    request.extensions_mut().insert(claims);
    next.run(request).await
}

async fn security_headers(request: Request<Body>, next: Next) -> Response {
    let mut response = next.run(request).await;
    let headers = response.headers_mut();

    headers.insert(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_static(CONTENT_SECURITY_POLICY),
    );
    headers.insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    headers.insert("x-frame-options", HeaderValue::from_static("DENY"));
    headers.insert("referrer-policy", HeaderValue::from_static("no-referrer"));
    headers.insert(
        "permissions-policy",
        HeaderValue::from_static("camera=(), microphone=(), geolocation=()"),
    );

    response
}

async fn api_list_notes(State(state): State<AppState>) -> Response {
    match open_connection(&state.db_path).and_then(|connection| {
        notes::list_notes(&connection).context("No se pudieron listar notas")
    }) {
        Ok(notes) => Json(notes).into_response(),
        Err(error) => server_error(error),
    }
}

async fn api_get_note(State(state): State<AppState>, Path(id): Path<String>) -> Response {
    match open_connection(&state.db_path)
        .and_then(|connection| notes::get_note(&connection, &id).context("No se pudo leer nota"))
    {
        Ok(Some(note)) => Json(note).into_response(),
        Ok(None) => not_found("Nota no encontrada"),
        Err(error) => server_error(error),
    }
}

async fn api_create_note(
    State(state): State<AppState>,
    Json(payload): Json<CreateNoteInput>,
) -> Response {
    match open_connection(&state.db_path).and_then(|connection| {
        notes::create_note(&connection, payload).context("No se pudo crear nota")
    }) {
        Ok(note) => (StatusCode::CREATED, Json(note)).into_response(),
        Err(error) => server_error(error),
    }
}

async fn api_update_note(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateNoteInput>,
) -> Response {
    match open_connection(&state.db_path).and_then(|connection| {
        notes::update_note(&connection, &id, payload).context("No se pudo actualizar nota")
    }) {
        Ok(Some(note)) => Json(note).into_response(),
        Ok(None) => not_found("Nota no encontrada"),
        Err(error) => server_error(error),
    }
}

async fn api_delete_note(State(state): State<AppState>, Path(id): Path<String>) -> Response {
    match open_connection(&state.db_path).and_then(|connection| {
        notes::delete_note(&connection, &id).context("No se pudo eliminar nota")
    }) {
        Ok(true) => Json(DeletedResponse { deleted: true }).into_response(),
        Ok(false) => not_found("Nota no encontrada"),
        Err(error) => server_error(error),
    }
}

async fn api_list_relations(State(state): State<AppState>) -> Response {
    match open_connection(&state.db_path).and_then(|connection| {
        notes::list_relations(&connection).context("No se pudieron listar relaciones")
    }) {
        Ok(relations) => Json(relations).into_response(),
        Err(error) => server_error(error),
    }
}

async fn api_connect_notes(
    State(state): State<AppState>,
    Json(payload): Json<ConnectNotesRequest>,
) -> Response {
    match open_connection(&state.db_path).and_then(|mut connection| {
        notes::connect_notes(&mut connection, &payload.source_id, &payload.target_ids)
            .context("No se pudieron conectar notas")
    }) {
        Ok(relations) => Json(relations).into_response(),
        Err(error) => server_error(error),
    }
}

async fn api_graph(State(state): State<AppState>) -> Response {
    match open_connection(&state.db_path).and_then(|connection| {
        let nodes = notes::list_notes(&connection).context("No se pudieron listar notas")?;
        let relations =
            notes::list_relations(&connection).context("No se pudieron listar relaciones")?;
        Ok::<_, anyhow::Error>(graph::build_note_graph(&nodes, &relations))
    }) {
        Ok(graph) => Json(graph).into_response(),
        Err(error) => server_error(error),
    }
}

async fn api_backup(State(state): State<AppState>) -> Response {
    match build_backup_zip(&state) {
        Ok(zip_bytes) => {
            let filename = format!("trace-backup-{}.zip", Utc::now().format("%Y%m%d%H%M%S"));
            let mut response = zip_bytes.into_response();
            response.headers_mut().insert(
                header::CONTENT_TYPE,
                HeaderValue::from_static("application/zip"),
            );
            if let Ok(value) =
                HeaderValue::from_str(&format!("attachment; filename=\"{filename}\""))
            {
                response
                    .headers_mut()
                    .insert(header::CONTENT_DISPOSITION, value);
            }
            response
        }
        Err(error) => server_error(error),
    }
}

async fn api_restore(State(state): State<AppState>, body: Bytes) -> Response {
    match restore_backup_zip(&state, &body) {
        Ok(()) => Json(RestoreResponse { restored: true }).into_response(),
        Err(error) => server_error(error),
    }
}

fn serve_index() -> Response {
    embedded_asset("index.html").unwrap_or_else(|| {
        (
            [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
            FALLBACK_INDEX_HTML,
        )
            .into_response()
    })
}

fn embedded_asset(path: &str) -> Option<Response> {
    let asset = WebAssets::get(path)?;

    let mime = mime_guess::from_path(path).first_or_octet_stream();
    let content_type = HeaderValue::from_str(mime.as_ref())
        .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream"));
    let mut response = asset.data.into_owned().into_response();
    response
        .headers_mut()
        .insert(header::CONTENT_TYPE, content_type);
    Some(response)
}

fn admin_exists(state: &AppState) -> Result<bool> {
    let connection = open_connection(&state.db_path)?;
    let count = connection
        .query_row(
            "SELECT COUNT(*) FROM server_users WHERE role = 'admin'",
            [],
            |row| row.get::<_, i64>(0),
        )
        .context("No se pudo consultar admin")?;
    Ok(count > 0)
}

enum SetupError {
    AlreadyConfigured,
    BadRequest(String),
    Internal(anyhow::Error),
}

fn create_admin(state: &AppState, payload: SetupRequest) -> Result<AuthResponse, SetupError> {
    let workspace_name = payload.workspace_name.trim();
    let email = payload.email.trim().to_lowercase();
    let password = payload.password;

    if workspace_name.is_empty() {
        return Err(SetupError::BadRequest(
            "workspace_name es requerido".to_string(),
        ));
    }
    if !email.contains('@') {
        return Err(SetupError::BadRequest("email invalido".to_string()));
    }
    if password.len() < 8 {
        return Err(SetupError::BadRequest(
            "password debe tener al menos 8 caracteres".to_string(),
        ));
    }

    let connection = open_connection(&state.db_path).map_err(SetupError::Internal)?;
    if admin_count(&connection).map_err(SetupError::Internal)? > 0 {
        return Err(SetupError::AlreadyConfigured);
    }

    let now = Utc::now().to_rfc3339();
    let user_id = Uuid::new_v4().to_string();
    let workspace_id = format!("workspace-{}", Uuid::new_v4());
    let password_hash = hash_password(&password).map_err(SetupError::Internal)?;

    connection
        .execute(
            "INSERT INTO server_users (id, email, password_hash, role, created_at)
             VALUES (?1, ?2, ?3, 'admin', ?4)",
            params![user_id, email, password_hash, now],
        )
        .map_err(|error| SetupError::Internal(anyhow::Error::new(error)))?;

    connection
        .execute(
            "INSERT INTO nodes (id, title, type, parent_id, content, icon, tags, position, updated_at)
             VALUES (?1, ?2, 'workspace', NULL, NULL, 'workspace', '[]', 0, ?3)",
            params![workspace_id, workspace_name, now],
        )
        .map_err(|error| SetupError::Internal(anyhow::Error::new(error)))?;

    build_auth_response(&state.jwt_secret, user_id, workspace_id).map_err(SetupError::Internal)
}

fn login_user(state: &AppState, payload: LoginRequest) -> Result<Option<AuthResponse>> {
    let email = payload.email.trim().to_lowercase();
    let connection = open_connection(&state.db_path)?;
    let user = connection
        .query_row(
            "SELECT id, password_hash FROM server_users WHERE email = ?1",
            [email],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .optional()
        .context("No se pudo leer usuario")?;

    let Some((user_id, password_hash)) = user else {
        return Ok(None);
    };

    if !verify_password(&payload.password, &password_hash)? {
        return Ok(None);
    }

    let vault_id = default_workspace_id(&connection)?.unwrap_or_else(|| "default".to_string());
    Ok(Some(build_auth_response(
        &state.jwt_secret,
        user_id,
        vault_id,
    )?))
}

fn admin_count(connection: &Connection) -> Result<i64> {
    connection
        .query_row(
            "SELECT COUNT(*) FROM server_users WHERE role = 'admin'",
            [],
            |row| row.get::<_, i64>(0),
        )
        .context("No se pudo contar admins")
}

fn default_workspace_id(connection: &Connection) -> Result<Option<String>> {
    connection
        .query_row(
            "SELECT id FROM nodes WHERE type = 'workspace' ORDER BY position, updated_at LIMIT 1",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .context("No se pudo leer workspace por defecto")
}

fn hash_password(password: &str) -> Result<String> {
    let salt = SaltString::generate(&mut OsRng);
    Ok(Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|error| anyhow::anyhow!("No se pudo hashear password: {error}"))?
        .to_string())
}

fn verify_password(password: &str, password_hash: &str) -> Result<bool> {
    let parsed_hash = PasswordHash::new(password_hash)
        .map_err(|error| anyhow::anyhow!("Hash de password invalido: {error}"))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

fn build_auth_response(
    jwt_secret: &str,
    user_id: String,
    vault_id: String,
) -> Result<AuthResponse> {
    let claims = Claims {
        sub: user_id.clone(),
        exp: unix_timestamp() + 60 * 60 * 24 * 7,
        vault_id,
    };
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret.as_bytes()),
    )
    .context("No se pudo firmar JWT")?;
    Ok(AuthResponse { token, user_id })
}

fn auth_rate_limit_key(kind: &str, email: &str) -> String {
    format!("{kind}:{}", email.trim().to_lowercase())
}

fn allow_auth_attempt(state: &AppState, key: &str) -> Result<bool> {
    let now = unix_timestamp();
    let cutoff = now - AUTH_RATE_LIMIT_WINDOW_SECONDS;
    let mut attempts = state
        .auth_attempts
        .lock()
        .map_err(|_| anyhow::anyhow!("Rate limiter no disponible"))?;
    let entries = attempts.entry(key.to_string()).or_default();
    entries.retain(|attempt| *attempt >= cutoff);

    if entries.len() >= AUTH_RATE_LIMIT_MAX_ATTEMPTS {
        return Ok(false);
    }

    entries.push(now);
    Ok(true)
}

fn clear_auth_attempts(state: &AppState, key: &str) {
    if let Ok(mut attempts) = state.auth_attempts.lock() {
        attempts.remove(key);
    }
}

fn build_backup_zip(state: &AppState) -> Result<Vec<u8>> {
    let connection = open_connection(&state.db_path)?;
    connection
        .execute_batch("PRAGMA wal_checkpoint(FULL);")
        .context("No se pudo consolidar WAL antes del backup")?;
    drop(connection);

    let db_bytes = std::fs::read(&*state.db_path)
        .with_context(|| format!("No se pudo leer {}", state.db_path.display()))?;

    let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    writer
        .start_file("trace.db", options)
        .context("No se pudo iniciar archivo trace.db en ZIP")?;
    writer
        .write_all(&db_bytes)
        .context("No se pudo escribir trace.db en ZIP")?;
    let cursor = writer.finish().context("No se pudo cerrar ZIP de backup")?;
    Ok(cursor.into_inner())
}

fn restore_backup_zip(state: &AppState, body: &[u8]) -> Result<()> {
    if body.is_empty() {
        anyhow::bail!("Backup vacio");
    }

    let mut archive =
        ZipArchive::new(Cursor::new(body)).context("El backup no es un ZIP valido")?;
    let mut db_entry = archive
        .by_name("trace.db")
        .context("El backup no contiene trace.db")?;

    if db_entry.size() > MAX_RESTORE_DB_BYTES {
        anyhow::bail!("trace.db excede el tamano maximo permitido");
    }

    let restore_path = state.db_path.with_extension("db.restore");
    let backup_path = state.db_path.with_extension("db.before-restore");
    let mut restored_db = File::create(&restore_path)
        .with_context(|| format!("No se pudo crear {}", restore_path.display()))?;
    let mut buffer = Vec::new();
    db_entry
        .read_to_end(&mut buffer)
        .context("No se pudo leer trace.db del ZIP")?;
    if buffer.len() as u64 > MAX_RESTORE_DB_BYTES {
        anyhow::bail!("trace.db excede el tamano maximo permitido");
    }
    restored_db
        .write_all(&buffer)
        .context("No se pudo escribir DB restaurada")?;
    drop(restored_db);
    drop(db_entry);
    drop(archive);

    let validation = open_connection(&restore_path)?;
    schema::ensure_trace_schema(&validation).map_err(anyhow::Error::msg)?;
    schema::ensure_markdown_index_schema(&validation).map_err(anyhow::Error::msg)?;
    ensure_server_schema(&validation)?;
    drop(validation);

    remove_sqlite_sidecars(&state.db_path)?;
    let _ = std::fs::remove_file(&backup_path);
    if state.db_path.exists() {
        std::fs::rename(&*state.db_path, &backup_path).with_context(|| {
            format!(
                "No se pudo preparar backup previo {}",
                backup_path.display()
            )
        })?;
    }

    std::fs::rename(&restore_path, &*state.db_path).with_context(|| {
        format!(
            "No se pudo mover DB restaurada a {}",
            state.db_path.display()
        )
    })?;

    let _ = std::fs::remove_file(&backup_path);
    Ok(())
}

fn remove_sqlite_sidecars(db_path: &StdPath) -> Result<()> {
    for suffix in ["-wal", "-shm"] {
        let path = PathBuf::from(format!("{}{}", db_path.display(), suffix));
        if path.exists() {
            std::fs::remove_file(&path)
                .with_context(|| format!("No se pudo eliminar {}", path.display()))?;
        }
    }
    Ok(())
}

fn unix_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or_default()
}

fn bearer_token(request: &Request<Body>) -> Option<&str> {
    let header = request
        .headers()
        .get(header::AUTHORIZATION)?
        .to_str()
        .ok()?;
    header.strip_prefix("Bearer ")
}

fn unauthorized() -> Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(error_body("Token requerido o invalido")),
    )
        .into_response()
}

fn too_many_requests(message: &str) -> Response {
    (StatusCode::TOO_MANY_REQUESTS, Json(error_body(message))).into_response()
}

fn not_found(message: &str) -> Response {
    (StatusCode::NOT_FOUND, Json(error_body(message))).into_response()
}

fn error_body(message: &str) -> serde_json::Value {
    serde_json::json!({ "error": message })
}

fn server_error(error: anyhow::Error) -> Response {
    tracing::error!("{error:#}");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(error_body("Error interno del servidor")),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::to_bytes;
    use tower::ServiceExt;

    fn test_request(method: &str, uri: &str, body: Option<&str>) -> Request<Body> {
        let builder = Request::builder()
            .method(method)
            .uri(uri)
            .header(header::CONTENT_TYPE, "application/json");
        builder
            .body(Body::from(body.unwrap_or_default().to_string()))
            .expect("request is built")
    }

    async fn response_body_json(response: Response) -> serde_json::Value {
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body is read");
        serde_json::from_slice(&body).expect("body is json")
    }

    fn test_state() -> AppState {
        AppState {
            db_path: Arc::new(PathBuf::from("test.db")),
            jwt_secret: Arc::new("test-secret".to_string()),
            auth_attempts: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    fn initialized_test_state() -> AppState {
        let data_dir = std::env::temp_dir().join(format!("trace-server-test-{}", Uuid::new_v4()));
        initialize_state(data_dir).expect("state is initialized")
    }

    #[test]
    fn rate_limit_blocks_after_max_attempts_and_clears() {
        let state = test_state();
        let key = auth_rate_limit_key("login", "ADMIN@EXAMPLE.COM");

        for _ in 0..AUTH_RATE_LIMIT_MAX_ATTEMPTS {
            assert!(allow_auth_attempt(&state, &key).expect("attempt is recorded"));
        }

        assert!(!allow_auth_attempt(&state, &key).expect("limit is checked"));

        clear_auth_attempts(&state, &key);

        assert!(allow_auth_attempt(&state, &key).expect("attempts are cleared"));
    }

    #[tokio::test]
    async fn app_sets_security_headers_and_requires_auth() {
        let app = build_router(initialized_test_state());

        let health = app
            .clone()
            .oneshot(test_request("GET", "/health", None))
            .await
            .expect("health responds");
        assert_eq!(health.status(), StatusCode::OK);
        assert!(health
            .headers()
            .contains_key(header::CONTENT_SECURITY_POLICY));
        assert_eq!(
            health.headers().get("x-frame-options"),
            Some(&HeaderValue::from_static("DENY"))
        );

        let notes = app
            .oneshot(test_request("GET", "/api/notes", None))
            .await
            .expect("api responds");
        assert_eq!(notes.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn setup_login_and_protected_notes_api_work() {
        let app = build_router(initialized_test_state());
        let setup_body = r#"{
            "workspace_name": "Trace Test",
            "email": "admin@example.com",
            "password": "password123"
        }"#;

        let setup = app
            .clone()
            .oneshot(test_request("POST", "/setup", Some(setup_body)))
            .await
            .expect("setup responds");
        assert_eq!(setup.status(), StatusCode::CREATED);
        let auth = response_body_json(setup).await;
        let token = auth["token"].as_str().expect("token exists");

        let notes = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/api/notes")
                    .header(header::AUTHORIZATION, format!("Bearer {token}"))
                    .body(Body::empty())
                    .expect("request is built"),
            )
            .await
            .expect("notes responds");
        assert_eq!(notes.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn login_is_rate_limited_after_failed_attempts() {
        let app = build_router(initialized_test_state());
        let setup_body = r#"{
            "workspace_name": "Trace Test",
            "email": "admin@example.com",
            "password": "password123"
        }"#;
        let bad_login_body = r#"{
            "email": "admin@example.com",
            "password": "wrong-password"
        }"#;

        let setup = app
            .clone()
            .oneshot(test_request("POST", "/setup", Some(setup_body)))
            .await
            .expect("setup responds");
        assert_eq!(setup.status(), StatusCode::CREATED);

        for _ in 0..AUTH_RATE_LIMIT_MAX_ATTEMPTS {
            let response = app
                .clone()
                .oneshot(test_request(
                    "POST",
                    "/api/auth/login",
                    Some(bad_login_body),
                ))
                .await
                .expect("login responds");
            assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        }

        let limited = app
            .oneshot(test_request(
                "POST",
                "/api/auth/login",
                Some(bad_login_body),
            ))
            .await
            .expect("limited login responds");
        assert_eq!(limited.status(), StatusCode::TOO_MANY_REQUESTS);
    }
}
