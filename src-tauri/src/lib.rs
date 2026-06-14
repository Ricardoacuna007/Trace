mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::graph::generate_graph_data,
            commands::code_runner::cancel_code_block,
            commands::code_runner::detect_runtimes,
            commands::code_runner::run_code_block,
            commands::customization::read_vault_customization,
            commands::customization::save_vault_customization,
            commands::markdown_db::scan_markdown_database,
            commands::markdown_db::update_markdown_frontmatter_property,
            commands::markdown_io::export_note_markdown,
            commands::markdown_io::export_vault_markdown,
            commands::markdown_io::import_markdown_directory,
            commands::quick_capture::create_inbox_note,
            commands::search::search_notes,
            commands::search::get_backlinks,
            commands::suggestions::suggest_note_connections,
            commands::vault::get_active_vault,
            commands::vault::set_active_vault
        ])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{
                    Code, GlobalShortcutExt, Modifiers, ShortcutState,
                };

                app.handle()
                    .plugin(tauri_plugin_global_shortcut::Builder::new().build())?;

                if let Err(error) =
                    app.global_shortcut()
                        .on_shortcut("ctrl+space", |app, shortcut, event| {
                            if event.state == ShortcutState::Pressed
                                && shortcut.matches(Modifiers::CONTROL, Code::Space)
                            {
                                if let Err(error) =
                                    commands::quick_capture::show_quick_capture_window(app)
                                {
                                    log::error!("quick capture shortcut failed: {error}");
                                }
                            }
                        })
                {
                    log::warn!("quick capture shortcut unavailable: {error}");
                }
            }

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
