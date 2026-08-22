use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, PhysicalPosition};
use tauri_plugin_autostart::MacosLauncher;

fn show_main(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

fn hide_tray_menu(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("tray-menu") {
        let _ = win.hide();
    }
}

/// 在托盘点击位置弹出自定义菜单窗口（风格由前端渲染）
fn show_tray_menu(app: &AppHandle, x: f64, y: f64) {
    let Some(win) = app.get_webview_window("tray-menu") else {
        return
    };
    let scale = win.scale_factor().unwrap_or(1.0);
    let w = 216.0 * scale;
    let h = 148.0 * scale;
    let menu_x = (x - w / 2.0).max(8.0);
    // 底部任务栏：菜单出现在点击点上方
    let menu_y = (y - h - 10.0 * scale).max(8.0);
    let _ = win.set_position(PhysicalPosition::new(menu_x as i32, menu_y as i32));
    let _ = win.show();
    let _ = win.set_focus();
}

/// JS 侧更新托盘状态文案（图标恒定不变，杜绝托盘图标缓存/状态粘滞问题）
#[tauri::command]
fn update_tray(app: AppHandle, status: String) {
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_tooltip(Some(format!("BlockHabit · {status}")));
    }
}

/// 托盘菜单窗口的动作
#[tauri::command]
fn tray_menu(app: AppHandle, action: String) {
    hide_tray_menu(&app);
    match action.as_str() {
        "open" => show_main(&app),
        "quit" => app.exit(0),
        _ => {}
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![update_tray, tray_menu])
        .setup(|app| {
            // 托盘菜单窗口：失焦即隐藏
            if let Some(win) = app.get_webview_window("tray-menu") {
                let w = win.clone();
                win.on_window_event(move |e| {
                    if let tauri::WindowEvent::Focused(false) = e {
                        let _ = w.hide();
                    }
                });
            }

            TrayIconBuilder::with_id("main")
                .icon(
                    tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))
                        .expect("invalid tray icon"),
                )
                .tooltip("BlockHabit")
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button,
                        button_state: MouseButtonState::Up,
                        position,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        match button {
                            MouseButton::Left => show_main(app),
                            MouseButton::Right => {
                                show_tray_menu(app, position.x, position.y)
                            }
                            _ => {}
                        }
                    }
                })
                .build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
