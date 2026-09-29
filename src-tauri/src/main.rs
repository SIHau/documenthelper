// 在 Windows 正式版中不顯示額外的命令列視窗
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    documenthelper_lib::run()
}
