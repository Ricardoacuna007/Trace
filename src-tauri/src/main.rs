// Hide the extra console window on Windows for both debug and release.
#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

fn main() {
    trace_lib::run();
}
