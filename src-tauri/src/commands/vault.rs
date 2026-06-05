use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

pub(crate) const TRACE_DIRNAME: &str = ".trace";
pub(crate) const TRACE_DB_FILENAME: &str = "trace.db";
const VAULT_PREFS_FILENAME: &str = "vault-preferences.json";
const WRITE_TEST_FILENAME: &str = ".write-test.tmp";

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VaultPrefs {
    active_vault_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveVaultDto {
    pub vault_path: String,
    pub db_path: String,
    pub db_url: String,
}

#[tauri::command]
pub fn get_active_vault(app_handle: AppHandle) -> Result<Option<ActiveVaultDto>, String> {
    let prefs = read_prefs(&app_handle)?;
    let Some(vault_path) = prefs.active_vault_path else {
        return Ok(None);
    };

    let candidate = PathBuf::from(vault_path);
    if !candidate.exists() || !candidate.is_dir() {
        write_prefs(
            &app_handle,
            VaultPrefs {
                active_vault_path: None,
            },
        )?;
        return Ok(None);
    }

    let resolved = prepare_vault(candidate)?;
    Ok(Some(resolved))
}

#[tauri::command]
pub fn set_active_vault(
    app_handle: AppHandle,
    vault_path: String,
) -> Result<ActiveVaultDto, String> {
    let selected = PathBuf::from(vault_path.trim());
    let prepared = prepare_vault(selected)?;

    write_prefs(
        &app_handle,
        VaultPrefs {
            active_vault_path: Some(prepared.vault_path.clone()),
        },
    )?;

    Ok(prepared)
}

pub(crate) fn resolve_active_vault_db_path(
    app_handle: &AppHandle,
) -> Result<Option<PathBuf>, String> {
    let Some(candidate) = resolve_active_vault_path(app_handle)? else {
        return Ok(None);
    };

    let db_path = trace_db_path(&candidate);
    if db_path.exists() {
        return Ok(Some(db_path));
    }

    Ok(None)
}

pub(crate) fn resolve_active_vault_path(app_handle: &AppHandle) -> Result<Option<PathBuf>, String> {
    let prefs = read_prefs(app_handle)?;
    let Some(vault_path) = prefs.active_vault_path else {
        return Ok(None);
    };

    let candidate = PathBuf::from(vault_path);
    if !candidate.exists() || !candidate.is_dir() {
        return Ok(None);
    }
    Ok(Some(candidate))
}

fn prepare_vault(selected: PathBuf) -> Result<ActiveVaultDto, String> {
    if !selected.exists() {
        return Err("La carpeta seleccionada no existe.".to_string());
    }
    if !selected.is_dir() {
        return Err("Debes seleccionar una carpeta valida.".to_string());
    }

    let trace_dir = selected.join(TRACE_DIRNAME);
    fs::create_dir_all(&trace_dir)
        .map_err(|error| format!("No se pudo crear el directorio .trace: {error}"))?;

    let probe_file = trace_dir.join(WRITE_TEST_FILENAME);
    fs::write(&probe_file, b"trace")
        .map_err(|error| format!("La carpeta no tiene permisos de escritura: {error}"))?;
    let _ = fs::remove_file(probe_file);

    let db_path = trace_dir.join(TRACE_DB_FILENAME);
    if !db_path.exists() {
        fs::write(&db_path, []).map_err(|error| format!("No se pudo crear trace.db: {error}"))?;
    }

    let normalized_vault = normalize_path_for_storage(&selected)?;
    let normalized_db = normalize_path_for_storage(&db_path)?;

    Ok(ActiveVaultDto {
        vault_path: normalized_vault,
        db_path: normalized_db.clone(),
        db_url: build_sqlite_url(&normalized_db),
    })
}

fn normalize_path_for_storage(path: &Path) -> Result<String, String> {
    let resolved = match fs::canonicalize(path) {
        Ok(value) => value,
        Err(_) => path.to_path_buf(),
    };

    let raw = resolved
        .to_str()
        .map(std::string::ToString::to_string)
        .ok_or_else(|| "Ruta de vault no valida para UTF-8.".to_string())?;

    Ok(strip_windows_verbatim_prefix(&raw))
}

fn strip_windows_verbatim_prefix(path: &str) -> String {
    if let Some(rest) = path.strip_prefix(r"\\?\UNC\") {
        return format!(r"\\{rest}");
    }
    if let Some(rest) = path.strip_prefix(r"\\?\") {
        return rest.to_string();
    }
    path.to_string()
}

fn build_sqlite_url(db_path: &str) -> String {
    let normalized = strip_windows_verbatim_prefix(db_path);
    let slash_path = normalized.replace('\\', "/");
    format!("sqlite:{slash_path}")
}

fn prefs_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|error| format!("No se pudo resolver app config dir: {error}"))?;

    fs::create_dir_all(&app_dir)
        .map_err(|error| format!("No se pudo crear app config dir: {error}"))?;

    Ok(app_dir.join(VAULT_PREFS_FILENAME))
}

fn read_prefs(app_handle: &AppHandle) -> Result<VaultPrefs, String> {
    let path = prefs_path(app_handle)?;
    if !path.exists() {
        return Ok(VaultPrefs::default());
    }

    let contents = fs::read_to_string(path)
        .map_err(|error| format!("No se pudo leer preferencias de vault: {error}"))?;
    serde_json::from_str::<VaultPrefs>(&contents)
        .map_err(|error| format!("No se pudo parsear preferencias de vault: {error}"))
}

fn write_prefs(app_handle: &AppHandle, prefs: VaultPrefs) -> Result<(), String> {
    let path = prefs_path(app_handle)?;
    let json = serde_json::to_string_pretty(&prefs)
        .map_err(|error| format!("No se pudo serializar preferencias de vault: {error}"))?;

    fs::write(path, json)
        .map_err(|error| format!("No se pudo guardar preferencias de vault: {error}"))
}

fn trace_db_path(vault_path: &Path) -> PathBuf {
    vault_path.join(TRACE_DIRNAME).join(TRACE_DB_FILENAME)
}

pub(crate) fn trace_dir_path(vault_path: &Path) -> PathBuf {
    vault_path.join(TRACE_DIRNAME)
}
