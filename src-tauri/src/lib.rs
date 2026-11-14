#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![native_smoke_report])
        .on_page_load(|webview, payload| {
            if payload.event() == tauri::webview::PageLoadEvent::Finished
                && std::env::var_os("SPACE_INTRUDERS_NATIVE_SMOKE_OUTPUT").is_some()
            {
                if let Some(path) = std::env::var_os("SPACE_INTRUDERS_NATIVE_SMOKE_OUTPUT") {
                    let _ = std::fs::write(path, format!("{{\"stage\":\"page_loaded\",\"url\":\"{}\"}}", payload.url()));
                }
                if let Err(error) = webview.eval(include_str!("native-smoke.js")) {
                    eprintln!("native smoke injection failed: {error}");
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to run Space Intruders");
}

#[tauri::command]
fn native_smoke_report(payload: String) -> Result<(), String> {
    let path = std::env::var_os("SPACE_INTRUDERS_NATIVE_SMOKE_OUTPUT")
        .ok_or("native smoke mode is disabled")?;
    if payload.len() > 2_000_000 {
        return Err("native smoke report exceeds size limit".into());
    }
    std::fs::write(path, payload).map_err(|error| error.to_string())
}
