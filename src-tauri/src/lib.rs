pub mod billing;
pub mod excel;
pub mod zalo_service;

use billing::{
    calculate_building_summary as calc_building_summary,
    calculate_room_bill as calc_room_bill,
    generate_vietqr_emvco,
    BuildingSummary, Room, RoomBillCalculation, Settings,
};
use excel::{
    generate_building_summary_excel_native, generate_room_invoice_excel_native,
};
use serde::{Deserialize, Serialize};
use zalo_service::{
    dispatch_room_invoice_notification, ZaloMessagePayload, ZaloSendResult,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeHealthStatus {
    pub engine: String,
    pub version: String,
    pub arch: String,
    pub os: String,
    pub rustc: String,
    pub tauri: String,
    pub active_modules: Vec<String>,
}

pub mod commands {
    use super::*;

    #[tauri::command]
    pub fn calculate_room_billing(
        room: Room,
        settings: Settings,
    ) -> Result<RoomBillCalculation, String> {
        Ok(calc_room_bill(&room, &settings))
    }

    #[tauri::command]
    pub fn calculate_building_summary(
        rooms: Vec<Room>,
        settings: Settings,
    ) -> Result<BuildingSummary, String> {
        Ok(calc_building_summary(&rooms, &settings))
    }

    #[tauri::command]
    pub fn generate_vietqr_payload(
        room: Room,
        settings: Settings,
    ) -> Result<String, String> {
        Ok(generate_vietqr_emvco(&room, &settings))
    }

    #[tauri::command]
    pub fn generate_room_invoice_excel(
        room: Room,
        settings: Settings,
        output_dir: Option<String>,
    ) -> Result<String, String> {
        generate_room_invoice_excel_native(&room, &settings, output_dir)
    }

    #[tauri::command]
    pub fn generate_building_excel(
        rooms: Vec<Room>,
        settings: Settings,
        output_dir: Option<String>,
    ) -> Result<String, String> {
        generate_building_summary_excel_native(&rooms, &settings, output_dir)
    }

    #[tauri::command]
    pub async fn send_zalo_notification(
        room: Room,
        settings: Settings,
        payload: ZaloMessagePayload,
    ) -> Result<ZaloSendResult, String> {
        dispatch_room_invoice_notification(&room, &settings, &payload).await
    }

    #[tauri::command]
    pub fn check_native_health() -> Result<NativeHealthStatus, String> {
        Ok(NativeHealthStatus {
            engine: "Tauri v2 + Pure Rust".to_string(),
            version: "1.0.0".to_string(),
            arch: std::env::consts::ARCH.to_string(),
            os: std::env::consts::OS.to_string(),
            rustc: "1.100.0".to_string(),
            tauri: "2.12.5".to_string(),
            active_modules: vec![
                "billing_engine".to_string(),
                "vietqr_emvco_generator".to_string(),
                "rust_xlsxwriter_invoicing".to_string(),
                "zalo_async_dispatcher".to_string(),
            ],
        })
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            commands::calculate_room_billing,
            commands::calculate_building_summary,
            commands::generate_vietqr_payload,
            commands::generate_room_invoice_excel,
            commands::generate_building_excel,
            commands::send_zalo_notification,
            commands::check_native_health
        ])
        .run(tauri::generate_context!())
        .expect("error while running an gia smart home 3d tauri application");
}
