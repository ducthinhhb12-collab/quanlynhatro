use crate::billing::{
    calculate_electricity_amount, calculate_room_total, format_number,
    vietnamese_number_to_words, Room, Settings,
};
use rust_xlsxwriter::{Color, Format, FormatAlign, FormatBorder, Workbook};
use std::fs;
use std::path::PathBuf;

pub fn resolve_invoice_directory(custom_dir: Option<String>) -> PathBuf {
    if let Some(dir) = custom_dir {
        let p = PathBuf::from(dir);
        if let Ok(()) = fs::create_dir_all(&p) {
            return p;
        }
    }

    // Default to OS temp directory or documents invoices folder
    let mut default_dir = std::env::temp_dir();
    default_dir.push("angia_invoices");
    let _ = fs::create_dir_all(&default_dir);
    default_dir
}

pub fn generate_room_invoice_excel_native(
    room: &Room,
    settings: &Settings,
    output_dir: Option<String>,
) -> Result<String, String> {
    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();
    worksheet
        .set_name(&format!("Hoa-Don-{}", room.id))
        .map_err(|e| e.to_string())?;

    // Định nghĩa các Styles chuẩn kế toán
    let title_format = Format::new()
        .set_bold()
        .set_font_size(15.0)
        .set_align(FormatAlign::Center)
        .set_font_color(Color::RGB(0x0F172A));

    let subtitle_format = Format::new()
        .set_italic()
        .set_font_size(10.0)
        .set_align(FormatAlign::Center)
        .set_font_color(Color::RGB(0x475569));

    let section_header_format = Format::new()
        .set_bold()
        .set_font_size(11.0)
        .set_font_color(Color::RGB(0x1E293B));

    let table_header_format = Format::new()
        .set_bold()
        .set_font_size(11.0)
        .set_align(FormatAlign::Center)
        .set_background_color(Color::RGB(0x1E293B))
        .set_font_color(Color::RGB(0xFFFFFF))
        .set_border(FormatBorder::Thin);

    let cell_format = Format::new()
        .set_font_size(10.0)
        .set_border(FormatBorder::Thin);

    let cell_center = Format::new()
        .set_font_size(10.0)
        .set_align(FormatAlign::Center)
        .set_border(FormatBorder::Thin);

    let cell_number = Format::new()
        .set_font_size(10.0)
        .set_align(FormatAlign::Right)
        .set_num_format("#,##0")
        .set_border(FormatBorder::Thin);

    let total_label_format = Format::new()
        .set_bold()
        .set_font_size(12.0)
        .set_align(FormatAlign::Right)
        .set_background_color(Color::RGB(0xFEF3C7))
        .set_border(FormatBorder::Medium);

    let total_value_format = Format::new()
        .set_bold()
        .set_font_size(12.0)
        .set_align(FormatAlign::Right)
        .set_font_color(Color::RGB(0xB45309))
        .set_background_color(Color::RGB(0xFEF3C7))
        .set_num_format("#,##0")
        .set_border(FormatBorder::Medium);

    // Độ rộng các cột
    worksheet.set_column_width(0, 8).map_err(|e| e.to_string())?;
    worksheet.set_column_width(1, 30).map_err(|e| e.to_string())?;
    worksheet.set_column_width(2, 26).map_err(|e| e.to_string())?;
    worksheet.set_column_width(3, 32).map_err(|e| e.to_string())?;
    worksheet.set_column_width(4, 24).map_err(|e| e.to_string())?;

    // 1. Tiêu ngữ Quốc gia
    worksheet
        .write_string_with_format(0, 1, "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", &title_format)
        .map_err(|e| e.to_string())?;
    worksheet
        .write_string_with_format(1, 1, "Độc lập - Tự do - Hạnh phúc", &subtitle_format)
        .map_err(|e| e.to_string())?;

    // 2. Tiêu đề Hóa Đơn
    worksheet
        .write_string_with_format(3, 1, "HÓA ĐƠN TIỀN PHÒNG & DỊCH VỤ THÁNG", &title_format)
        .map_err(|e| e.to_string())?;
    worksheet
        .write_string(
            4,
            1,
            &format!("Mã hóa đơn: HD-{}-{}", room.id, if room.invoice_issued { "EINV" } else { "0526" }),
        )
        .map_err(|e| e.to_string())?;

    // 3. Thông tin Khách hàng & Phòng
    worksheet
        .write_string_with_format(6, 0, "THÔNG TIN KHÁCH HÀNG & PHÒNG THUÊ", &section_header_format)
        .map_err(|e| e.to_string())?;

    worksheet.write_string(7, 0, "Mã phòng:").map_err(|e| e.to_string())?;
    worksheet.write_string(7, 1, &room.id).map_err(|e| e.to_string())?;
    worksheet.write_string(7, 2, "Tầng:").map_err(|e| e.to_string())?;
    worksheet.write_number(7, 3, room.floor as f64).map_err(|e| e.to_string())?;

    worksheet.write_string(8, 0, "Khách thuê:").map_err(|e| e.to_string())?;
    worksheet.write_string(8, 1, &room.tenant).map_err(|e| e.to_string())?;
    worksheet.write_string(8, 2, "SĐT Zalo:").map_err(|e| e.to_string())?;
    worksheet.write_string(8, 3, &room.phone).map_err(|e| e.to_string())?;

    worksheet.write_string(9, 0, "Diện tích:").map_err(|e| e.to_string())?;
    worksheet.write_string(9, 1, &format!("{} m²", room.area)).map_err(|e| e.to_string())?;
    worksheet.write_string(9, 2, "Trạng thái:").map_err(|e| e.to_string())?;
    worksheet.write_string(9, 3, &room.status).map_err(|e| e.to_string())?;

    let cycle_text = match &room.start_date {
        Some(s) if !s.is_empty() => format!("Từ {} đến {}", s, room.due_date),
        _ => format!("Hạn thanh toán: {}", room.due_date),
    };
    worksheet.write_string(10, 0, "Chu kỳ:").map_err(|e| e.to_string())?;
    worksheet.write_string(10, 1, &cycle_text).map_err(|e| e.to_string())?;

    // 4. Bảng kê chi phí
    worksheet
        .write_string_with_format(12, 0, "BẢNG KÊ CHI TIẾT CHI PHÍ", &section_header_format)
        .map_err(|e| e.to_string())?;

    let headers = ["STT", "Khoản mục", "Chỉ số / Đơn giá", "Khối lượng", "Thành tiền (VNĐ)"];
    for (col_idx, &hdr) in headers.iter().enumerate() {
        worksheet
            .write_string_with_format(13, col_idx as u16, hdr, &table_header_format)
            .map_err(|e| e.to_string())?;
    }

    // Row 1: Tiền thuê phòng
    worksheet.write_string_with_format(14, 0, "1", &cell_center).map_err(|e| e.to_string())?;
    worksheet.write_string_with_format(14, 1, "Tiền thuê phòng", &cell_format).map_err(|e| e.to_string())?;
    worksheet.write_string_with_format(14, 2, "Cố định tháng", &cell_center).map_err(|e| e.to_string())?;
    worksheet.write_string_with_format(14, 3, "1 tháng", &cell_center).map_err(|e| e.to_string())?;
    worksheet.write_number_with_format(14, 4, room.room_fee, &cell_number).map_err(|e| e.to_string())?;

    // Row 2: Tiền điện
    let kwh = (room.electric_new - room.electric_old).max(0.0);
    let elec_fee = calculate_electricity_amount(room, settings.electric_unit_price);
    worksheet.write_string_with_format(15, 0, "2", &cell_center).map_err(|e| e.to_string())?;
    worksheet.write_string_with_format(15, 1, "Tiền điện sinh hoạt", &cell_format).map_err(|e| e.to_string())?;
    worksheet
        .write_string_with_format(
            15,
            2,
            &format!("{} đ/kWh", format_number(settings.electric_unit_price)),
            &cell_center,
        )
        .map_err(|e| e.to_string())?;
    worksheet
        .write_string_with_format(
            15,
            3,
            &format!(
                "Cũ: {} - Mới: {} ({} kWh)",
                format_number(room.electric_old),
                format_number(room.electric_new),
                format_number(kwh)
            ),
            &cell_center,
        )
        .map_err(|e| e.to_string())?;
    worksheet.write_number_with_format(15, 4, elec_fee, &cell_number).map_err(|e| e.to_string())?;

    // Row 3: Tiền nước
    worksheet.write_string_with_format(16, 0, "3", &cell_center).map_err(|e| e.to_string())?;
    worksheet.write_string_with_format(16, 1, "Tiền nước sinh hoạt", &cell_format).map_err(|e| e.to_string())?;
    worksheet.write_string_with_format(16, 2, "Trọn gói tháng", &cell_center).map_err(|e| e.to_string())?;
    worksheet.write_string_with_format(16, 3, "1 tháng", &cell_center).map_err(|e| e.to_string())?;
    worksheet.write_number_with_format(16, 4, room.water_fee, &cell_number).map_err(|e| e.to_string())?;

    // Row 4: Internet
    worksheet.write_string_with_format(17, 0, "4", &cell_center).map_err(|e| e.to_string())?;
    worksheet.write_string_with_format(17, 1, "Internet WiFi tốc độ cao", &cell_format).map_err(|e| e.to_string())?;
    worksheet.write_string_with_format(17, 2, "Trọn gói tháng", &cell_center).map_err(|e| e.to_string())?;
    worksheet.write_string_with_format(17, 3, "1 tháng", &cell_center).map_err(|e| e.to_string())?;
    worksheet.write_number_with_format(17, 4, room.internet_fee, &cell_number).map_err(|e| e.to_string())?;

    // Row Tổng cộng
    let total = calculate_room_total(room, settings);
    worksheet
        .write_string_with_format(18, 0, "TỔNG CỘNG PHẢI THANH TOÁN:", &total_label_format)
        .map_err(|e| e.to_string())?;
    worksheet.write_string_with_format(18, 1, "", &total_label_format).map_err(|e| e.to_string())?;
    worksheet.write_string_with_format(18, 2, "", &total_label_format).map_err(|e| e.to_string())?;
    worksheet.write_string_with_format(18, 3, "", &total_label_format).map_err(|e| e.to_string())?;
    worksheet.write_number_with_format(18, 4, total, &total_value_format).map_err(|e| e.to_string())?;

    // Bằng chữ
    let words = vietnamese_number_to_words(total);
    worksheet.write_string(20, 0, "Bằng chữ:").map_err(|e| e.to_string())?;
    worksheet.write_string(20, 1, &words).map_err(|e| e.to_string())?;
    worksheet.write_string(21, 0, "Hạn thanh toán:").map_err(|e| e.to_string())?;
    worksheet.write_string(21, 1, &room.due_date).map_err(|e| e.to_string())?;

    // 5. Thông tin VietQR
    worksheet
        .write_string_with_format(23, 0, "THÔNG TIN CHUYỂN KHOẢN TỰ ĐỘNG (VIETQR)", &section_header_format)
        .map_err(|e| e.to_string())?;
    worksheet.write_string(24, 0, "Ngân hàng nhận:").map_err(|e| e.to_string())?;
    worksheet.write_string(24, 1, &settings.bank_name).map_err(|e| e.to_string())?;
    worksheet.write_string(25, 0, "Số tài khoản:").map_err(|e| e.to_string())?;
    worksheet.write_string(25, 1, &settings.account_number).map_err(|e| e.to_string())?;
    worksheet.write_string(26, 0, "Chủ tài khoản:").map_err(|e| e.to_string())?;
    worksheet.write_string(26, 1, &settings.account_name).map_err(|e| e.to_string())?;
    worksheet.write_string(27, 0, "Cú pháp chuyển khoản:").map_err(|e| e.to_string())?;
    worksheet.write_string(27, 1, &format!("THANHTOAN {}", room.id)).map_err(|e| e.to_string())?;

    let out_dir = resolve_invoice_directory(output_dir);
    let file_path = out_dir.join(format!("Hoa-Don-Phong-{}.xlsx", room.id));
    workbook
        .save(&file_path)
        .map_err(|e| format!("Lỗi lưu file Excel: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

pub fn generate_building_summary_excel_native(
    rooms: &[Room],
    settings: &Settings,
    output_dir: Option<String>,
) -> Result<String, String> {
    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();
    worksheet
        .set_name("Tong-Hop-Toa-Nha")
        .map_err(|e| e.to_string())?;

    let header_format = Format::new()
        .set_bold()
        .set_font_size(11.0)
        .set_align(FormatAlign::Center)
        .set_background_color(Color::RGB(0x0F172A))
        .set_font_color(Color::RGB(0xFFFFFF))
        .set_border(FormatBorder::Thin);

    let cell_format = Format::new()
        .set_font_size(10.0)
        .set_border(FormatBorder::Thin);

    let cell_center = Format::new()
        .set_font_size(10.0)
        .set_align(FormatAlign::Center)
        .set_border(FormatBorder::Thin);

    let num_format = Format::new()
        .set_font_size(10.0)
        .set_align(FormatAlign::Right)
        .set_num_format("#,##0")
        .set_border(FormatBorder::Thin);

    let col_headers = [
        "Mã phòng", "Tầng", "Khách thuê", "SĐT", "Trạng thái", "Tiền phòng",
        "Điện cũ", "Điện mới", "kWh dùng", "Tiền điện", "Tiền nước", "Internet", "Tổng cộng"
    ];

    for (i, &w) in [10, 8, 20, 14, 14, 16, 10, 10, 10, 16, 14, 14, 18].iter().enumerate() {
        worksheet.set_column_width(i as u16, w).map_err(|e| e.to_string())?;
    }

    for (col_idx, &h) in col_headers.iter().enumerate() {
        worksheet
            .write_string_with_format(0, col_idx as u16, h, &header_format)
            .map_err(|e| e.to_string())?;
    }

    for (idx, room) in rooms.iter().enumerate() {
        let r = (idx + 1) as u32;
        let kwh = (room.electric_new - room.electric_old).max(0.0);
        let elec_fee = calculate_electricity_amount(room, settings.electric_unit_price);
        let total = calculate_room_total(room, settings);

        worksheet.write_string_with_format(r, 0, &room.id, &cell_center).map_err(|e| e.to_string())?;
        worksheet.write_number_with_format(r, 1, room.floor as f64, &cell_center).map_err(|e| e.to_string())?;
        worksheet.write_string_with_format(r, 2, &room.tenant, &cell_format).map_err(|e| e.to_string())?;
        worksheet.write_string_with_format(r, 3, &room.phone, &cell_center).map_err(|e| e.to_string())?;
        worksheet.write_string_with_format(r, 4, &room.status, &cell_center).map_err(|e| e.to_string())?;
        worksheet.write_number_with_format(r, 5, room.room_fee, &num_format).map_err(|e| e.to_string())?;
        worksheet.write_number_with_format(r, 6, room.electric_old, &cell_center).map_err(|e| e.to_string())?;
        worksheet.write_number_with_format(r, 7, room.electric_new, &cell_center).map_err(|e| e.to_string())?;
        worksheet.write_number_with_format(r, 8, kwh, &cell_center).map_err(|e| e.to_string())?;
        worksheet.write_number_with_format(r, 9, elec_fee, &num_format).map_err(|e| e.to_string())?;
        worksheet.write_number_with_format(r, 10, room.water_fee, &num_format).map_err(|e| e.to_string())?;
        worksheet.write_number_with_format(r, 11, room.internet_fee, &num_format).map_err(|e| e.to_string())?;
        worksheet.write_number_with_format(r, 12, total, &num_format).map_err(|e| e.to_string())?;
    }

    let out_dir = resolve_invoice_directory(output_dir);
    let file_path = out_dir.join("Bao-Cao-Tong-Hop-Toa-Nha.xlsx");
    workbook
        .save(&file_path)
        .map_err(|e| format!("Lỗi lưu file Excel: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}
