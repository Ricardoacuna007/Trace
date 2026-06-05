use super::vault::{resolve_active_vault_path, trace_dir_path};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

const TRACE_CONFIG_FILENAME: &str = "trace.config.json";
const CUSTOM_CSS_FILENAME: &str = "custom.css";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultCustomizationDto {
    pub trace_dir: String,
    pub config_json: String,
    pub custom_css: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCustomizationPayload {
    pub config_json: String,
    pub custom_css: String,
}

#[tauri::command]
pub fn read_vault_customization(app_handle: AppHandle) -> Result<VaultCustomizationDto, String> {
    let Some(vault_path) = resolve_active_vault_path(&app_handle)? else {
        return Err("No hay una boveda activa.".to_string());
    };

    let trace_dir = ensure_trace_dir(&vault_path)?;
    let config_path = trace_dir.join(TRACE_CONFIG_FILENAME);
    let css_path = trace_dir.join(CUSTOM_CSS_FILENAME);

    let default_config = default_config_json_pretty()?;
    if !config_path.exists() {
        fs::write(&config_path, &default_config)
            .map_err(|error| format!("No se pudo crear trace.config.json: {error}"))?;
    }
    if !css_path.exists() {
        fs::write(&css_path, default_custom_css())
            .map_err(|error| format!("No se pudo crear custom.css: {error}"))?;
    }

    let config_json = fs::read_to_string(&config_path)
        .map_err(|error| format!("No se pudo leer trace.config.json: {error}"))?;
    let custom_css = fs::read_to_string(&css_path)
        .map_err(|error| format!("No se pudo leer custom.css: {error}"))?;

    validate_config_json(&config_json)?;

    Ok(VaultCustomizationDto {
        trace_dir: normalize_path_for_response(trace_dir)?,
        config_json,
        custom_css,
    })
}

#[tauri::command]
pub fn save_vault_customization(
    app_handle: AppHandle,
    payload: SaveCustomizationPayload,
) -> Result<VaultCustomizationDto, String> {
    let Some(vault_path) = resolve_active_vault_path(&app_handle)? else {
        return Err("No hay una boveda activa.".to_string());
    };

    validate_config_json(&payload.config_json)?;

    let trace_dir = ensure_trace_dir(&vault_path)?;
    let config_path = trace_dir.join(TRACE_CONFIG_FILENAME);
    let css_path = trace_dir.join(CUSTOM_CSS_FILENAME);

    fs::write(&config_path, payload.config_json.as_bytes())
        .map_err(|error| format!("No se pudo guardar trace.config.json: {error}"))?;
    fs::write(&css_path, payload.custom_css.as_bytes())
        .map_err(|error| format!("No se pudo guardar custom.css: {error}"))?;

    Ok(VaultCustomizationDto {
        trace_dir: normalize_path_for_response(trace_dir)?,
        config_json: payload.config_json,
        custom_css: payload.custom_css,
    })
}

fn ensure_trace_dir(vault_path: &Path) -> Result<PathBuf, String> {
    let trace_dir = trace_dir_path(vault_path);
    fs::create_dir_all(&trace_dir)
        .map_err(|error| format!("No se pudo crear carpeta .trace: {error}"))?;
    Ok(trace_dir)
}

fn default_config_json_pretty() -> Result<String, String> {
    let config = json!({
      "theme": "dark",
      "accent_color": "#8db4ff",
      "font_family": "Space Grotesk",
      "editor_width": "980px",
      "vim_mode": false
    });

    serde_json::to_string_pretty(&config)
        .map_err(|error| format!("No se pudo serializar configuracion por defecto: {error}"))
}

fn default_custom_css() -> &'static str {
    "/* Trace custom.css\n   Este archivo sobreescribe estilos globales de la app.\n   Ejemplo: body { background: #101418 !important; }\n*/\n"
}

fn validate_config_json(value: &str) -> Result<(), String> {
    let parsed: Value = serde_json::from_str(value)
        .map_err(|error| format!("JSON invalido en trace.config.json: {error}"))?;
    if !parsed.is_object() {
        return Err("trace.config.json debe contener un objeto JSON.".to_string());
    }
    Ok(())
}

fn normalize_path_for_response(path: PathBuf) -> Result<String, String> {
    path.to_str()
        .map(std::string::ToString::to_string)
        .ok_or_else(|| "Ruta no valida para UTF-8.".to_string())
}
