use crate::billing::{Room, Settings};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZaloMessagePayload {
    pub phone: String,
    pub message: String,
    #[serde(rename = "vietqrUrl", default)]
    pub vietqr_url: Option<String>,
    #[serde(rename = "receiptImageBase64", default)]
    pub receipt_image_base64: Option<String>,
    #[serde(rename = "excelPath", default)]
    pub excel_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZaloSendResult {
    pub success: bool,
    pub status: String,
    pub message: String,
    pub timestamp: String,
    pub detail: Option<String>,
}

pub fn clean_phone_number(raw: &str) -> String {
    let mut cleaned: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
    if cleaned.starts_with("84") && cleaned.len() >= 10 {
        cleaned = format!("0{}", &cleaned[2..]);
    }
    cleaned
}

pub async fn send_zalo_webhook(
    webhook_url: &str,
    payload: &ZaloMessagePayload,
) -> Result<ZaloSendResult, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Lỗi khởi tạo HTTP client: {}", e))?;

    let response = client
        .post(webhook_url)
        .json(payload)
        .send()
        .await
        .map_err(|e| format!("Lỗi kết nối Webhook Zalo: {}", e))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .unwrap_or_else(|_| "Không thể đọc phản hồi".to_string());

    let now = chrono::Local::now().format("%d/%m/%Y %H:%M:%S").to_string();

    if status.is_success() {
        Ok(ZaloSendResult {
            success: true,
            status: "SENT".to_string(),
            message: format!("Gửi qua Webhook Zalo thành công ({})", status),
            timestamp: now,
            detail: Some(body),
        })
    } else {
        Err(format!(
            "Webhook Zalo trả về mã lỗi HTTP {}: {}",
            status, body
        ))
    }
}

pub async fn send_zalo_oa(
    access_token: &str,
    phone: &str,
    message_text: &str,
) -> Result<ZaloSendResult, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Lỗi khởi tạo HTTP client: {}", e))?;

    let clean_phone = clean_phone_number(phone);
    let oa_url = "https://openapi.zalo.me/v3.0/oa/message/cs";

    let body = serde_json::json!({
        "recipient": {
            "user_id": clean_phone
        },
        "message": {
            "text": message_text
        }
    });

    let response = client
        .post(oa_url)
        .header("access_token", access_token)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Lỗi gọi Zalo OA API: {}", e))?;

    let status = response.status();
    let resp_text = response
        .text()
        .await
        .unwrap_or_else(|_| "{}".to_string());

    let now = chrono::Local::now().format("%d/%m/%Y %H:%M:%S").to_string();

    if status.is_success() {
        Ok(ZaloSendResult {
            success: true,
            status: "SENT".to_string(),
            message: "Gửi qua Zalo OA API thành công".to_string(),
            timestamp: now,
            detail: Some(resp_text),
        })
    } else {
        Err(format!(
            "Zalo OA API trả về mã lỗi HTTP {}: {}",
            status, resp_text
        ))
    }
}

pub async fn dispatch_room_invoice_notification(
    room: &Room,
    settings: &Settings,
    payload: &ZaloMessagePayload,
) -> Result<ZaloSendResult, String> {
    match settings.zalo_method.as_str() {
        "webhook" => {
            if let Some(url) = &settings.zalo_webhook_url {
                if !url.trim().is_empty() {
                    return send_zalo_webhook(url, payload).await;
                }
            }
            Err("Chưa cấu hình URL Webhook Zalo trong cài đặt".to_string())
        }
        "zalo_oa" => {
            if let Some(token) = &settings.zalo_access_token {
                if !token.trim().is_empty() {
                    return send_zalo_oa(token, &room.phone, &payload.message).await;
                }
            }
            Err("Chưa cấu hình Access Token Zalo OA trong cài đặt".to_string())
        }
        _ => {
            // Simulated / Mock or Desktop RPA relay
            let now = chrono::Local::now().format("%d/%m/%Y %H:%M:%S").to_string();
            Ok(ZaloSendResult {
                success: true,
                status: "SENT_SIMULATED".to_string(),
                message: format!(
                    "Đã mô phỏng gửi thành công gói hóa đơn 4-trong-1 tới SĐT {}",
                    room.phone
                ),
                timestamp: now,
                detail: Some(format!(
                    "Phòng: {} | VietQR: {} | Excel: {}",
                    room.id,
                    payload.vietqr_url.is_some(),
                    payload.excel_path.is_some()
                )),
            })
        }
    }
}
