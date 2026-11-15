use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Room {
    pub id: String,
    pub floor: i32,
    pub col: i32,
    pub area: f64,
    pub tenant: String,
    pub phone: String,
    #[serde(rename = "roomFee")]
    pub room_fee: f64,
    #[serde(rename = "electricOld")]
    pub electric_old: f64,
    #[serde(rename = "electricNew")]
    pub electric_new: f64,
    #[serde(rename = "waterFee")]
    pub water_fee: f64,
    #[serde(rename = "internetFee")]
    pub internet_fee: f64,
    pub status: String, // "PAID", "PENDING", "OVERDUE", "EMPTY"
    #[serde(rename = "invoiceIssued", default)]
    pub invoice_issued: bool,
    #[serde(rename = "dueDate")]
    pub due_date: String,
    #[serde(rename = "startDate", default)]
    pub start_date: Option<String>,
    #[serde(rename = "zaloName", default)]
    pub zalo_name: Option<String>,
    #[serde(rename = "zaloNote", default)]
    pub zalo_note: Option<String>,
    #[serde(rename = "idCard", default)]
    pub id_card: Option<String>,
    #[serde(rename = "lastZaloSentAt", default)]
    pub last_zalo_sent_at: Option<String>,
    #[serde(rename = "zaloSendStatus", default)]
    pub zalo_send_status: Option<String>,
    #[serde(rename = "reminderCount", default)]
    pub reminder_count: Option<i32>,
    #[serde(rename = "lastAutoSentAt", default)]
    pub last_auto_sent_at: Option<String>,
    #[serde(rename = "hasExcelInvoice", default)]
    pub has_excel_invoice: Option<bool>,
    #[serde(rename = "hasImageInvoice", default)]
    pub has_image_invoice: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    #[serde(rename = "bankCode")]
    pub bank_code: String,
    #[serde(rename = "bankName")]
    pub bank_name: String,
    #[serde(rename = "accountNumber")]
    pub account_number: String,
    #[serde(rename = "accountName")]
    pub account_name: String,
    #[serde(rename = "electricUnitPrice")]
    pub electric_unit_price: f64,
    #[serde(rename = "zaloAutoSend", default)]
    pub zalo_auto_send: bool,
    #[serde(rename = "zaloMethod", default)]
    pub zalo_method: String,
    #[serde(rename = "zaloWebhookUrl", default)]
    pub zalo_webhook_url: Option<String>,
    #[serde(rename = "zaloAccessToken", default)]
    pub zalo_access_token: Option<String>,
    #[serde(rename = "handsFreeMode", default)]
    pub hands_free_mode: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomBillCalculation {
    pub room_id: String,
    pub tenant: String,
    pub phone: String,
    pub status: String,
    pub kwh_used: f64,
    pub electric_amount: f64,
    pub water_fee: f64,
    pub internet_fee: f64,
    pub room_fee: f64,
    pub total_amount: f64,
    pub total_formatted: String,
    pub total_in_words: String,
    pub vietqr_url: String,
    pub vietqr_emvco_payload: String,
    pub reminder_message: String,
    pub is_overdue: bool,
    pub overdue_days: i32,
    pub due_date: String,
    pub cycle_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildingSummary {
    pub total_rooms: usize,
    pub occupied_rooms: usize,
    pub empty_rooms: usize,
    pub paid_rooms: usize,
    pub pending_rooms: usize,
    pub overdue_rooms: usize,
    pub total_revenue: f64,
    pub total_collected: f64,
    pub total_outstanding: f64,
    pub total_electricity_kwh: f64,
    pub total_electricity_amount: f64,
    pub calculations: Vec<RoomBillCalculation>,
}

pub fn calculate_electricity_amount(room: &Room, unit_price: f64) -> f64 {
    let kwh = (room.electric_new - room.electric_old).max(0.0);
    kwh * unit_price
}

pub fn calculate_room_total(room: &Room, settings: &Settings) -> f64 {
    if room.status == "EMPTY" {
        return 0.0;
    }
    room.room_fee
        + calculate_electricity_amount(room, settings.electric_unit_price)
        + room.water_fee
        + room.internet_fee
}

pub fn format_number(val: f64) -> String {
    let rounded = val.round() as i64;
    let s = rounded.abs().to_string();
    let mut result = String::new();
    let chars: Vec<char> = s.chars().collect();
    let len = chars.len();

    for (i, &ch) in chars.iter().enumerate() {
        if i > 0 && (len - i) % 3 == 0 {
            result.push('.');
        }
        result.push(ch);
    }
    if rounded < 0 {
        format!("-{}", result)
    } else {
        result
    }
}

pub fn format_vnd(amount: f64) -> String {
    format!("{} ₫", format_number(amount))
}

pub fn vietnamese_number_to_words(amount: f64) -> String {
    let num = amount.round() as i64;
    if num == 0 {
        return "Không đồng".to_string();
    }
    if num < 0 {
        return format!("Âm {}", vietnamese_number_to_words(-amount));
    }

    fn read_three_digits(n: i64, read_zero_hundred: bool) -> String {
        let digits = [
            "không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín",
        ];
        let h = n / 100;
        let t = (n % 100) / 10;
        let o = n % 10;

        let mut parts = Vec::new();

        if h > 0 || read_zero_hundred {
            parts.push(format!("{} trăm", digits[h as usize]));
        }

        if t > 1 {
            parts.push(format!("{} mươi", digits[t as usize]));
            if o == 1 {
                parts.push("mốt".to_string());
            } else if o == 5 {
                parts.push("lăm".to_string());
            } else if o > 0 {
                parts.push(digits[o as usize].to_string());
            }
        } else if t == 1 {
            parts.push("mười".to_string());
            if o == 5 {
                parts.push("lăm".to_string());
            } else if o > 0 {
                parts.push(digits[o as usize].to_string());
            }
        } else if o > 0 {
            if h > 0 || read_zero_hundred {
                parts.push(format!("lẻ {}", digits[o as usize]));
            } else {
                parts.push(digits[o as usize].to_string());
            }
        }

        parts.join(" ")
    }

    let billions = num / 1_000_000_000;
    let millions = (num % 1_000_000_000) / 1_000_000;
    let thousands = (num % 1_000_000) / 1_000;
    let remainder = num % 1_000;

    let mut result_parts = Vec::new();
    let mut has_previous = false;

    if billions > 0 {
        result_parts.push(format!("{} tỷ", read_three_digits(billions, false)));
        has_previous = true;
    }
    if millions > 0 {
        result_parts.push(format!("{} triệu", read_three_digits(millions, has_previous)));
        has_previous = true;
    }
    if thousands > 0 {
        result_parts.push(format!("{} nghìn", read_three_digits(thousands, has_previous)));
        has_previous = true;
    }
    if remainder > 0 {
        result_parts.push(read_three_digits(remainder, has_previous));
    }

    let raw = result_parts.join(" ");
    let mut chars = raw.chars();
    let first = chars.next().unwrap_or(' ').to_uppercase().to_string();
    let rest: String = chars.collect();

    format!("{}{} đồng chẵn", first, rest)
}

pub fn generate_vietqr_url(room: &Room, settings: &Settings) -> String {
    let total = calculate_room_total(room, settings).round() as i64;
    let add_info = format!("THANHTOAN {}", room.id);
    let info = urlencoding::encode(&add_info);
    format!(
        "https://img.vietqr.io/image/{}-{}-compact2.png?amount={}&addInfo={}",
        settings.bank_code, settings.account_number, total, info
    )
}

/// Tính CRC16-CCITT chuẩn EMVCo QR Code
pub fn crc16_ccitt(data: &[u8]) -> u16 {
    let mut crc: u16 = 0xFFFF;
    for &byte in data {
        crc ^= (byte as u16) << 8;
        for _ in 0..8 {
            if (crc & 0x8000) != 0 {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
    }
    crc
}

/// Tạo chuỗi EMVCo VietQR Payload theo chuẩn Napas 247
pub fn generate_vietqr_emvco(room: &Room, settings: &Settings) -> String {
    let amount = calculate_room_total(room, settings).round() as i64;
    let add_info = format!("THANHTOAN {}", room.id);

    fn make_tlv(tag: &str, value: &str) -> String {
        format!("{}{:02}{}", tag, value.len(), value)
    }

    // Sub-TLV cho Tag 38 (Napas 247)
    let guid = make_tlv("00", "A000000727");
    let bank_info = format!(
        "{}{}",
        make_tlv("00", &settings.bank_code),
        make_tlv("01", &settings.account_number)
    );
    let consumer = make_tlv("01", &bank_info);
    let service = make_tlv("02", "QRIBFTTA");
    let tag_38_val = format!("{}{}{}", guid, consumer, service);

    let tag_62_val = make_tlv("08", &add_info);

    let mut payload_no_crc = format!(
        "{}{}{}{}{}{}{}{}{}",
        make_tlv("00", "01"),
        make_tlv("01", "12"),
        make_tlv("38", &tag_38_val),
        make_tlv("53", "704"),
        make_tlv("54", &amount.to_string()),
        make_tlv("58", "VN"),
        make_tlv("59", &settings.account_name),
        make_tlv("60", "HO CHI MINH"),
        make_tlv("62", &tag_62_val)
    );

    payload_no_crc.push_str("6304");
    let crc = crc16_ccitt(payload_no_crc.as_bytes());
    format!("{}{:04X}", payload_no_crc, crc)
}

pub fn calculate_overdue_info(due_date_str: &str) -> (bool, i32) {
    let parts: Vec<&str> = due_date_str.trim().split('/').collect();
    if parts.len() != 3 {
        return (false, 0);
    }

    let day = parts[0].parse::<u32>().unwrap_or(1);
    let month = parts[1].parse::<u32>().unwrap_or(1);
    let year = parts[2].parse::<i32>().unwrap_or(2026);

    let due_date = match chrono::NaiveDate::from_ymd_opt(year, month, day) {
        Some(d) => d,
        None => return (false, 0),
    };

    let today = chrono::Local::now().date_naive();
    let diff = (due_date - today).num_days();

    if diff < 0 {
        (true, diff.abs() as i32)
    } else {
        (false, 0)
    }
}

pub fn build_reminder_message(room: &Room, settings: &Settings) -> String {
    let total = calculate_room_total(room, settings);
    let qr_url = generate_vietqr_url(room, settings);
    let kwh = (room.electric_new - room.electric_old).max(0.0);
    let elec_fee = calculate_electricity_amount(room, settings.electric_unit_price);

    let cycle_text = match &room.start_date {
        Some(s) if !s.is_empty() => format!("Kỳ tính tiền 1 tháng: Từ {} đến {}", s, room.due_date),
        _ => format!("Hạn thanh toán: {}", room.due_date),
    };

    let zalo_greeting = match &room.zalo_name {
        Some(name) if !name.is_empty() => format!("Chào bạn {} ({})", room.tenant, name),
        _ => format!("Chào bạn {}", room.tenant),
    };

    let total_words = vietnamese_number_to_words(total);

    let mut lines = vec![
        format!("🔔 THÔNG BÁO TIỀN PHÒNG {} - AN GIA SMART HOME", room.id),
        format!("{}, Ban quản lý gửi bạn bảng kê chi phí tháng này:", zalo_greeting),
        format!("🗓 {}", cycle_text),
        "----------------------------------------".to_string(),
        format!("1. Tiền phòng: {}", format_vnd(room.room_fee)),
        format!(
            "2. Tiền điện: {} (Cũ: {} ➔ Mới: {} | Dùng: {} kWh × {}đ)",
            format_vnd(elec_fee),
            format_number(room.electric_old),
            format_number(room.electric_new),
            format_number(kwh),
            format_number(settings.electric_unit_price)
        ),
        format!("3. Tiền nước: {}", format_vnd(room.water_fee)),
        format!("4. Internet: {}", format_vnd(room.internet_fee)),
        "----------------------------------------".to_string(),
        format!("👉 TỔNG CỘNG: {}", format_vnd(total)),
        format!("✍️ Bằng chữ: {}", total_words),
        format!("⏰ Hạn thanh toán: {}", room.due_date),
        "".to_string(),
        "💳 THÔNG TIN CHUYỂN KHOẢN:".to_string(),
        format!("- Ngân hàng: {}", settings.bank_name),
        format!("- Số tài khoản: {}", settings.account_number),
        format!("- Chủ tài khoản: {}", settings.account_name),
        format!("- Cú pháp CK: THANHTOAN {}", room.id),
        "".to_string(),
        "📲 MÃ VIETQR THANH TOÁN TỰ ĐỘNG (Bấm link để mở/lưu QR):".to_string(),
        qr_url,
        "(Mở link trên bằng Zalo để quét mã VietQR tự động điền đúng số tiền và nội dung CK)".to_string(),
    ];

    if let Some(note) = &room.zalo_note {
        if !note.is_empty() {
            lines.push(format!("📌 Ghi chú: {}", note));
        }
    }

    lines.push("".to_string());
    lines.push("Xin cảm ơn bạn! Chúc bạn một ngày tốt lành.".to_string());

    lines.join("\n")
}

pub fn calculate_room_bill(room: &Room, settings: &Settings) -> RoomBillCalculation {
    let total = calculate_room_total(room, settings);
    let kwh = (room.electric_new - room.electric_old).max(0.0);
    let elec_fee = calculate_electricity_amount(room, settings.electric_unit_price);
    let (is_overdue, overdue_days) = calculate_overdue_info(&room.due_date);

    let cycle_text = match &room.start_date {
        Some(s) if !s.is_empty() => format!("Từ {} đến {}", s, room.due_date),
        _ => format!("Hạn {}", room.due_date),
    };

    RoomBillCalculation {
        room_id: room.id.clone(),
        tenant: room.tenant.clone(),
        phone: room.phone.clone(),
        status: room.status.clone(),
        kwh_used: kwh,
        electric_amount: elec_fee,
        water_fee: room.water_fee,
        internet_fee: room.internet_fee,
        room_fee: room.room_fee,
        total_amount: total,
        total_formatted: format_vnd(total),
        total_in_words: vietnamese_number_to_words(total),
        vietqr_url: generate_vietqr_url(room, settings),
        vietqr_emvco_payload: generate_vietqr_emvco(room, settings),
        reminder_message: build_reminder_message(room, settings),
        is_overdue,
        overdue_days,
        due_date: room.due_date.clone(),
        cycle_text,
    }
}

pub fn calculate_building_summary(rooms: &[Room], settings: &Settings) -> BuildingSummary {
    let mut total_revenue = 0.0;
    let mut total_collected = 0.0;
    let mut total_outstanding = 0.0;
    let mut total_kwh = 0.0;
    let mut total_elec_amt = 0.0;

    let mut occupied_rooms = 0;
    let mut empty_rooms = 0;
    let mut paid_rooms = 0;
    let mut pending_rooms = 0;
    let mut overdue_rooms = 0;

    let mut calculations = Vec::new();

    for room in rooms {
        let calc = calculate_room_bill(room, settings);
        if room.status == "EMPTY" {
            empty_rooms += 1;
        } else {
            occupied_rooms += 1;
            total_revenue += calc.total_amount;
            total_kwh += calc.kwh_used;
            total_elec_amt += calc.electric_amount;

            if room.status == "PAID" {
                paid_rooms += 1;
                total_collected += calc.total_amount;
            } else {
                total_outstanding += calc.total_amount;
                if calc.is_overdue || room.status == "OVERDUE" {
                    overdue_rooms += 1;
                } else {
                    pending_rooms += 1;
                }
            }
        }
        calculations.push(calc);
    }

    BuildingSummary {
        total_rooms: rooms.len(),
        occupied_rooms,
        empty_rooms,
        paid_rooms,
        pending_rooms,
        overdue_rooms,
        total_revenue,
        total_collected,
        total_outstanding,
        total_electricity_kwh: total_kwh,
        total_electricity_amount: total_elec_amt,
        calculations,
    }
}
