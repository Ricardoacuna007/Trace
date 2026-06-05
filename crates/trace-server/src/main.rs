use std::{
    net::SocketAddr,
    path::PathBuf,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};

use anyhow::{Context, Result};
use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    extract::State,
    http::{header, HeaderValue, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use clap::Parser;
use jsonwebtoken::{encode, EncodingKey, Header};
use rand_core::OsRng;
use rusqlite::{params, Connection, OptionalExtension};
use rust_embed::RustEmbed;
use serde::{Deserialize, Serialize};
use tower_http::trace::TraceLayer;
use trace_core::{auth::Claims, schema};
use uuid::Uuid;

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
}

#[derive(RustEmbed)]
#[folder = "web-dist"]
struct WebAssets;

const FALLBACK_INDEX_HTML: &str = include_str!("../web/index.html");

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

    let app = Router::new()
        .route("/", get(index))
        .route("/setup", get(setup_page).post(setup))
        .route("/health", get(health))
        .route("/api/setup/status", get(setup_status))
        .route("/api/auth/login", post(login))
        .fallback(static_asset)
        .with_state(state)
        .layer(TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind(args.bind)
        .await
        .with_context(|| format!("No se pudo abrir servidor en {}", args.bind))?;

    tracing::info!("trace-server listening on http://{}", args.bind);
    axum::serve(listener, app)
        .await
        .context("trace-server se detuvo inesperadamente")?;

    Ok(())
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
    match create_admin(&state, payload) {
        Ok(auth) => (StatusCode::CREATED, Json(auth)).into_response(),
        Err(SetupError::AlreadyConfigured) => StatusCode::NOT_FOUND.into_response(),
        Err(SetupError::BadRequest(message)) => {
            (StatusCode::BAD_REQUEST, Json(error_body(&message))).into_response()
        }
        Err(SetupError::Internal(error)) => server_error(error),
    }
}

async fn login(State(state): State<AppState>, Json(payload): Json<LoginRequest>) -> Response {
    match login_user(&state, payload) {
        Ok(Some(auth)) => Json(auth).into_response(),
        Ok(None) => (StatusCode::UNAUTHORIZED, Json(error_body("Credenciales invalidas"))).into_response(),
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
    response.headers_mut().insert(header::CONTENT_TYPE, content_type);
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
        return Err(SetupError::BadRequest("workspace_name es requerido".to_string()));
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

fn build_auth_response(jwt_secret: &str, user_id: String, vault_id: String) -> Result<AuthResponse> {
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

fn unix_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or_default()
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
