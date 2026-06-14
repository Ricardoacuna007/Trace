use serde::Serialize;
use std::{
    collections::{BTreeMap, HashSet},
    env,
    ffi::OsString,
    fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{Mutex, OnceLock},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

const DEFAULT_TIMEOUT_MS: u64 = 30_000;
const MAX_OUTPUT_CHARS: usize = 10_000;
const MIN_OUTPUT_CHARS: usize = 1_000;
const HARD_MAX_OUTPUT_CHARS: usize = 50_000;
static CANCELLED_RUNS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeInfo {
    language: String,
    command: String,
    path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeOutput {
    stdout: String,
    stderr: String,
    status: Option<i32>,
    timed_out: bool,
    cancelled: bool,
    duration_ms: u128,
    truncated: bool,
}

#[derive(Clone, Copy)]
enum RuntimeKind {
    File,
    Shell,
    Rust,
}

struct RuntimeSpec {
    language: &'static str,
    aliases: &'static [&'static str],
    commands: &'static [&'static str],
    extension: &'static str,
    kind: RuntimeKind,
}

const RUNTIMES: &[RuntimeSpec] = &[
    RuntimeSpec {
        language: "python",
        aliases: &["py", "python3"],
        commands: &["python3", "python"],
        extension: "py",
        kind: RuntimeKind::File,
    },
    RuntimeSpec {
        language: "javascript",
        aliases: &["js", "node"],
        commands: &["node"],
        extension: "js",
        kind: RuntimeKind::File,
    },
    RuntimeSpec {
        language: "bash",
        aliases: &["sh", "shell"],
        commands: &["bash", "sh"],
        extension: "sh",
        kind: RuntimeKind::Shell,
    },
    RuntimeSpec {
        language: "powershell",
        aliases: &["ps1", "pwsh"],
        commands: &["pwsh", "powershell"],
        extension: "ps1",
        kind: RuntimeKind::Shell,
    },
    RuntimeSpec {
        language: "rust",
        aliases: &["rs"],
        commands: &["rustc"],
        extension: "rs",
        kind: RuntimeKind::Rust,
    },
];

#[tauri::command]
pub fn detect_runtimes() -> Vec<RuntimeInfo> {
    let mut detected = Vec::new();

    for runtime in RUNTIMES {
        if let Some((command, path)) = runtime
            .commands
            .iter()
            .find_map(|command| find_executable(command).map(|path| (*command, path)))
        {
            detected.push(RuntimeInfo {
                language: runtime.language.to_string(),
                command: command.to_string(),
                path: path.to_string_lossy().to_string(),
            });
        }
    }

    detected
}

#[tauri::command]
pub fn run_code_block(
    language: String,
    code: String,
    timeout_ms: Option<u64>,
    max_output_chars: Option<usize>,
    run_id: Option<String>,
) -> Result<CodeOutput, String> {
    let runtime = runtime_for_language(&language)
        .ok_or_else(|| format!("No hay runtime configurado para '{language}'."))?;
    let command_path = runtime
        .commands
        .iter()
        .find_map(|command| find_executable(command))
        .ok_or_else(|| format!("{} no esta instalado o no esta en PATH.", runtime.language))?;

    if code.trim().is_empty() {
        return Err("El bloque de codigo esta vacio.".to_string());
    }

    let timeout = Duration::from_millis(timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS).max(500));
    let output_limit = max_output_chars
        .unwrap_or(MAX_OUTPUT_CHARS)
        .clamp(MIN_OUTPUT_CHARS, HARD_MAX_OUTPUT_CHARS);
    let run_id = run_id.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    });
    match runtime.kind {
        RuntimeKind::File => run_file_runtime(
            runtime,
            &command_path,
            &code,
            timeout,
            output_limit,
            run_id.as_deref(),
        ),
        RuntimeKind::Shell => run_shell_runtime(
            runtime,
            &command_path,
            &code,
            timeout,
            output_limit,
            run_id.as_deref(),
        ),
        RuntimeKind::Rust => run_rust_runtime(
            runtime,
            &command_path,
            &code,
            timeout,
            output_limit,
            run_id.as_deref(),
        ),
    }
}

#[tauri::command]
pub fn cancel_code_block(run_id: String) -> Result<bool, String> {
    let run_id = run_id.trim();
    if run_id.is_empty() {
        return Err("run_id vacio.".to_string());
    }

    let mut cancelled = cancelled_runs()
        .lock()
        .map_err(|_| "No se pudo marcar la ejecucion como cancelada.".to_string())?;
    Ok(cancelled.insert(run_id.to_string()))
}

fn runtime_for_language(language: &str) -> Option<&'static RuntimeSpec> {
    let normalized = language.trim().to_lowercase();
    RUNTIMES.iter().find(|runtime| {
        runtime.language == normalized || runtime.aliases.iter().any(|alias| *alias == normalized)
    })
}

fn run_file_runtime(
    runtime: &RuntimeSpec,
    command_path: &Path,
    code: &str,
    timeout: Duration,
    output_limit: usize,
    run_id: Option<&str>,
) -> Result<CodeOutput, String> {
    let script_path = write_temp_file(runtime.extension, code)?;
    let mut command = Command::new(command_path);
    command.arg(&script_path);
    let output = run_with_timeout(command, timeout, output_limit, run_id);
    let _ = fs::remove_file(script_path);
    output
}

fn run_shell_runtime(
    runtime: &RuntimeSpec,
    command_path: &Path,
    code: &str,
    timeout: Duration,
    output_limit: usize,
    run_id: Option<&str>,
) -> Result<CodeOutput, String> {
    let mut command = Command::new(command_path);
    if runtime.language == "powershell" {
        command.args(["-NoProfile", "-NonInteractive", "-Command", code]);
    } else {
        command.args(["-c", code]);
    }
    run_with_timeout(command, timeout, output_limit, run_id)
}

fn run_rust_runtime(
    runtime: &RuntimeSpec,
    command_path: &Path,
    code: &str,
    timeout: Duration,
    output_limit: usize,
    run_id: Option<&str>,
) -> Result<CodeOutput, String> {
    let source_path = write_temp_file(runtime.extension, code)?;
    let binary_path = source_path.with_extension(if cfg!(windows) { "exe" } else { "bin" });

    let mut compile = Command::new(command_path);
    compile.arg(&source_path).arg("-o").arg(&binary_path);
    let compile_output = run_with_timeout(compile, timeout, output_limit, run_id)?;
    if compile_output.timed_out || compile_output.status != Some(0) {
        let _ = fs::remove_file(source_path);
        let _ = fs::remove_file(binary_path);
        return Ok(compile_output);
    }

    let output = run_with_timeout(Command::new(&binary_path), timeout, output_limit, run_id);
    let _ = fs::remove_file(source_path);
    let _ = fs::remove_file(binary_path);
    output
}

fn run_with_timeout(
    mut command: Command,
    timeout: Duration,
    output_limit: usize,
    run_id: Option<&str>,
) -> Result<CodeOutput, String> {
    let start = Instant::now();
    let mut child = command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("No se pudo ejecutar el bloque: {error}"))?;

    let mut timed_out = false;
    let mut cancelled = false;
    loop {
        if child
            .try_wait()
            .map_err(|error| format!("No se pudo leer el estado del proceso: {error}"))?
            .is_some()
        {
            break;
        }

        if start.elapsed() >= timeout {
            timed_out = true;
            let _ = child.kill();
            break;
        }

        if run_id.is_some_and(is_cancelled) {
            cancelled = true;
            let _ = child.kill();
            break;
        }

        thread::sleep(Duration::from_millis(25));
    }

    let output = child
        .wait_with_output()
        .map_err(|error| format!("No se pudo leer la salida del proceso: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let mut stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if cancelled && stderr.trim().is_empty() {
        stderr = "[trace: ejecucion cancelada]".to_string();
    }
    let (stdout, stdout_truncated) = truncate_output(stdout, output_limit);
    let (stderr, stderr_truncated) = truncate_output(stderr, output_limit);
    clear_cancelled(run_id);

    Ok(CodeOutput {
        stdout,
        stderr,
        status: output.status.code(),
        timed_out,
        cancelled,
        duration_ms: start.elapsed().as_millis(),
        truncated: stdout_truncated || stderr_truncated,
    })
}

fn cancelled_runs() -> &'static Mutex<HashSet<String>> {
    CANCELLED_RUNS.get_or_init(|| Mutex::new(HashSet::new()))
}

fn is_cancelled(run_id: &str) -> bool {
    cancelled_runs()
        .lock()
        .map(|cancelled| cancelled.contains(run_id))
        .unwrap_or(false)
}

fn clear_cancelled(run_id: Option<&str>) {
    if let Some(run_id) = run_id {
        if let Ok(mut cancelled) = cancelled_runs().lock() {
            cancelled.remove(run_id);
        }
    }
}

fn truncate_output(value: String, output_limit: usize) -> (String, bool) {
    if value.chars().count() <= output_limit {
        return (value, false);
    }

    let truncated = value.chars().take(output_limit).collect::<String>();
    (format!("{truncated}\n[trace: salida truncada]"), true)
}

fn write_temp_file(extension: &str, content: &str) -> Result<PathBuf, String> {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("Reloj del sistema invalido: {error}"))?
        .as_millis();
    let path = env::temp_dir().join(format!("trace-code-{millis}.{extension}"));
    fs::write(&path, content)
        .map_err(|error| format!("No se pudo crear archivo temporal: {error}"))?;
    Ok(path)
}

fn find_executable(command: &str) -> Option<PathBuf> {
    let path_value = env::var_os("PATH")?;
    let candidates = command_candidates(command);

    env::split_paths(&path_value).find_map(|directory| {
        candidates
            .iter()
            .map(|candidate| directory.join(candidate))
            .find(|path| path.is_file())
    })
}

fn command_candidates(command: &str) -> Vec<OsString> {
    if cfg!(windows) && Path::new(command).extension().is_none() {
        let extensions = env::var_os("PATHEXT").unwrap_or_else(|| ".EXE;.BAT;.CMD".into());
        let mut candidates = BTreeMap::new();
        for extension in extensions.to_string_lossy().split(';') {
            candidates.insert(
                format!("{command}{extension}").to_lowercase(),
                OsString::from(format!("{command}{extension}")),
            );
        }
        candidates.into_values().collect()
    } else {
        vec![OsString::from(command)]
    }
}

#[cfg(test)]
mod tests {
    use super::{runtime_for_language, truncate_output, MAX_OUTPUT_CHARS};

    #[test]
    fn resolves_runtime_aliases() {
        assert_eq!(
            runtime_for_language("py").map(|runtime| runtime.language),
            Some("python")
        );
        assert_eq!(
            runtime_for_language("js").map(|runtime| runtime.language),
            Some("javascript")
        );
        assert_eq!(
            runtime_for_language("rs").map(|runtime| runtime.language),
            Some("rust")
        );
        assert!(runtime_for_language("unknown").is_none());
    }

    #[test]
    fn truncates_long_output() {
        let value = "x".repeat(MAX_OUTPUT_CHARS + 10);
        let (output, truncated) = truncate_output(value, MAX_OUTPUT_CHARS);

        assert!(truncated);
        assert!(output.ends_with("[trace: salida truncada]"));
    }
}
