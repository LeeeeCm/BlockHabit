use std::sync::atomic::{AtomicBool, Ordering};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, PhysicalPosition};
use tauri_plugin_autostart::MacosLauncher;

mod credentials;

/// 退出握手等待上限：远小于 Windows 关机的宽限时间（通常 5s），也足够覆盖一次落盘
const QUIT_HANDSHAKE_TIMEOUT: std::time::Duration = std::time::Duration::from_millis(1500);

/// 托盘退出握手门闩：前端 flush 完存档后置 true，Rust 侧等到置位或超时再退出
struct QuitGate(AtomicBool);

/// 退出握手去重：关机 / 注销 / 关闭最后一个窗口 / 托盘退出可能同时触发，
/// 用 swap 保证「只 emit 一次、只起一个等待线程」，否则会重复握手并互相抢退出
struct QuitHandshake(AtomicBool);

/// 本次退出请求是否应该走存档握手（纯函数，便于单测）。
///
/// - code 为 None：用户/系统发起的退出（关闭最后一个窗口、注销、关机等）→ 必须先 flush；
/// - code 为 Some：由 AppHandle::exit() / restart() 显式发起（托盘退出、updater 安装器）
///   —— 这些路径要么已经走完握手，要么由安装器直接接管进程，再拦截会把自己锁死。
fn should_handshake(code: Option<i32>, confirmed: bool) -> bool {
    code.is_none() && !confirmed
}

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
    let w = 240.0 * scale;
    let h = 172.0 * scale;
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
        "quit" => begin_quit(app),
        _ => {}
    }
}

/// 退出握手：先通知前端 flush 存档，等待确认（上限 QUIT_HANDSHAKE_TIMEOUT）后真正退出。
///
/// 幂等：同一进程生命周期内只发起一次；重复调用直接返回，不再开第二个等待线程。
fn begin_quit(app: AppHandle) {
    use tauri::Emitter;
    if app.state::<QuitHandshake>().0.swap(true, Ordering::SeqCst) {
        return;
    }
    let _ = app.emit("app-quit-requested", ());
    std::thread::spawn(move || {
        let gate = app.state::<QuitGate>();
        let deadline = std::time::Instant::now() + QUIT_HANDSHAKE_TIMEOUT;
        while std::time::Instant::now() < deadline {
            if gate.0.load(Ordering::SeqCst) {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
        app.exit(0);
    });
}

/// 前端存档 flush 完成后调用，放行退出
#[tauri::command]
fn confirm_quit(app: AppHandle) {
    app.state::<QuitGate>().0.store(true, Ordering::SeqCst);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 单实例保护：二次启动聚焦已有窗口，杜绝双实例并发写同一存档（必须最先注册）
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main(app)
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        // D-20261111-069：手动检查更新（默认构建不发起请求；发布链路由人类配置）
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(QuitGate(AtomicBool::new(false)))
        .manage(QuitHandshake(AtomicBool::new(false)))
        .invoke_handler(tauri::generate_handler![
            update_tray,
            tray_menu,
            confirm_quit,
            credentials::credential_available,
            credentials::credential_set,
            credentials::credential_get,
            credentials::credential_delete
        ])
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
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // A10 / on_before_exit 存档握手：系统发起的退出（关闭最后一个窗口、注销、关机）
            // 默认会让进程直接消失，最后一次异步写盘来不及完成。这里拦下来，走与托盘退出
            // 完全相同的握手：emit → 前端 forceFlush() → confirm_quit → 放行退出（超时兜底）。
            if let tauri::RunEvent::ExitRequested { api, code, .. } = event {
                let confirmed = app.state::<QuitGate>().0.load(Ordering::SeqCst);
                if should_handshake(code, confirmed) {
                    api.prevent_exit();
                    begin_quit(app.clone());
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::should_handshake;

    #[test]
    fn user_requested_exit_needs_handshake() {
        assert!(should_handshake(None, false));
    }

    #[test]
    fn confirmed_flush_lets_exit_through() {
        assert!(!should_handshake(None, true));
    }

    #[test]
    fn programmatic_exit_is_never_blocked() {
        // 托盘退出 / updater 安装器走 AppHandle::exit()，code 为 Some：
        // 若在这里 prevent_exit，进程会永远退不出去。
        assert!(!should_handshake(Some(0), false));
        assert!(!should_handshake(Some(0), true));
    }
}
