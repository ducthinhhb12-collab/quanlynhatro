import * as XLSX from "xlsx";
import type { Room, Settings } from "../types";
import {
  buildVietQrUrl,
  electricityAmount,
  formatNumber,
  formatVND,
  roomTotal,
  STATUS_META,
} from "./format";

/**
 * 1. AGENT TẠO FILE EXCEL HÓA ĐƠN RIÊNG CHO TỪNG PHÒNG (.XLSX)
 */
export const generateRoomInvoiceWorkbook = (room: Room, settings: Settings): XLSX.WorkBook => {
  const total = roomTotal(room, settings);
  const kwh = Math.max(0, room.electricNew - room.electricOld);
  const elecFee = electricityAmount(room, settings.electricUnitPrice);
  const qrUrl = buildVietQrUrl(room, settings);

  const data: (string | number)[][] = [
    ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
    ["Độc lập - Tự do - Hạnh phúc"],
    [""],
    ["HÓA ĐƠN TIỀN PHÒNG & DỊCH VỤ THÁNG"],
    [`Mã hóa đơn: HD-${room.id}-${room.invoiceIssued ? "EINV" : "0526"}`],
    [""],
    ["THÔNG TIN KHÁCH HÀNG & PHÒNG THUÊ"],
    ["Mã phòng:", room.id, "Tầng:", room.floor],
    ["Khách thuê:", room.tenant || "Phòng trống", "SĐT Zalo:", room.phone || "--"],
    ["Diện tích:", `${room.area} m²`, "Trạng thái:", STATUS_META[room.status].label],
    ["Chu kỳ 1 tháng:", `Từ ${room.startDate || "01"} đến ${room.dueDate}`],
    [""],
    ["BẢNG KÊ CHI TIẾT CHI PHÍ"],
    ["STT", "Khoản mục", "Chỉ số / Đơn giá", "Khối lượng", "Thành tiền (VNĐ)"],
    ["1", "Tiền thuê phòng", "Cố định tháng", "1 tháng", room.roomFee],
    [
      "2",
      "Tiền điện sinh hoạt",
      `${formatNumber(settings.electricUnitPrice)} đ/kWh`,
      `Cũ: ${formatNumber(room.electricOld)} - Mới: ${formatNumber(room.electricNew)} (${formatNumber(kwh)} kWh)`,
      elecFee,
    ],
    ["3", "Tiền nước sinh hoạt", "Trọn gói tháng", "1 tháng", room.waterFee],
    ["4", "Internet WiFi tốc độ cao", "Trọn gói tháng", "1 tháng", room.internetFee],
    [""],
    ["TỔNG CỘNG PHẢI THANH TOÁN:", "", "", "", total],
    ["Bằng chữ:", `${formatVND(total)}`],
    ["Hạn thanh toán:", room.dueDate],
    [""],
    ["THÔNG TIN CHUYỂN KHOẢN TỰ ĐỘNG (VIETQR)"],
    ["Ngân hàng nhận:", settings.bankName],
    ["Số tài khoản:", settings.accountNumber],
    ["Chủ tài khoản:", settings.accountName],
    ["Nội dung chuyển khoản (bắt buộc):", `THANHTOAN ${room.id}`],
    ["Link ảnh mã QR thanh toán nhanh:", qrUrl],
    [""],
    ["Ban Quản Lý An Gia Smart Home xin cảm ơn Quý khách!"],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [
    { wch: 6 },
    { wch: 28 },
    { wch: 24 },
    { wch: 30 },
    { wch: 22 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Hoa-Don-${room.id}`);
  return wb;
};

/** Tải file Excel hóa đơn phòng */
export const downloadRoomInvoiceExcel = (room: Room, settings: Settings) => {
  const wb = generateRoomInvoiceWorkbook(room, settings);
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Hoa-Don-Phong-${room.id}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * 2. AGENT TỰ ĐỘNG CHỤP & KẾT XUẤT ẢNH PHIẾU THU HÓA ĐƠN ĐIỆN TỬ (PNG)
 */
export const generateInvoiceCanvasImage = async (
  room: Room,
  settings: Settings
): Promise<string> => {
  return new Promise((resolve) => {
    const total = roomTotal(room, settings);
    const kwh = Math.max(0, room.electricNew - room.electricOld);
    const elecFee = electricityAmount(room, settings.electricUnitPrice);
    const qrUrl = buildVietQrUrl(room, settings);

    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 920;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      resolve("");
      return;
    }

    // Nền trắng mềm mại
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Bo viền phiếu thu
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 3;
    ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

    // Banner tiêu đề xanh ngọc
    ctx.fillStyle = "#059669";
    ctx.fillRect(16, 16, canvas.width - 32, 110);

    // Chữ tiêu đề
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("AN GIA SMART HOME", canvas.width / 2, 58);

    ctx.font = "14px sans-serif";
    ctx.fillText("PHIẾU THU TIỀN PHÒNG & DỊCH VỤ THÁNG", canvas.width / 2, 86);
    ctx.font = "12px sans-serif";
    ctx.fillText(`Kỳ 1 tháng: Từ ${room.startDate || "01"} đến ${room.dueDate}`, canvas.width / 2, 108);

    // Thông tin phòng & khách
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(36, 146, canvas.width - 72, 75);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.strokeRect(36, 146, canvas.width - 72, 75);

    ctx.textAlign = "left";
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(`Phòng: ${room.id}  (Tầng ${room.floor})`, 52, 178);

    ctx.font = "13px sans-serif";
    ctx.fillStyle = "#475569";
    ctx.fillText(`Khách thuê: ${room.tenant || "Phòng trống"}`, 52, 203);
    ctx.fillText(`SĐT Zalo: ${room.phone || "--"}`, 340, 203);

    // Bảng chi tiết chi phí
    const startY = 245;
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(36, startY, canvas.width - 72, 34);
    ctx.fillStyle = "#334155";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText("Khoản mục", 50, startY + 22);
    ctx.fillText("Chi tiết", 220, startY + 22);
    ctx.textAlign = "right";
    ctx.fillText("Thành tiền", canvas.width - 50, startY + 22);

    const items = [
      { name: "Tiền thuê phòng", detail: "Theo hợp đồng", amount: formatVND(room.roomFee) },
      {
        name: "Tiền điện sinh hoạt",
        detail: `${room.electricOld} ➔ ${room.electricNew} (${kwh} kWh)`,
        amount: formatVND(elecFee),
      },
      { name: "Tiền nước", detail: "Trọn gói tháng", amount: formatVND(room.waterFee) },
      { name: "Internet WiFi", detail: "Gói gia đình", amount: formatVND(room.internetFee) },
    ];

    let rowY = startY + 60;
    items.forEach((it) => {
      ctx.textAlign = "left";
      ctx.font = "13px sans-serif";
      ctx.fillStyle = "#1e293b";
      ctx.fillText(it.name, 50, rowY);
      ctx.fillStyle = "#64748b";
      ctx.font = "12px sans-serif";
      ctx.fillText(it.detail, 220, rowY);
      ctx.textAlign = "right";
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(it.amount, canvas.width - 50, rowY);

      // Đường kẻ mờ
      ctx.strokeStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.moveTo(36, rowY + 12);
      ctx.lineTo(canvas.width - 36, rowY + 12);
      ctx.stroke();

      rowY += 36;
    });

    // Hộp Tổng cộng
    ctx.fillStyle = "#ecfdf5";
    ctx.fillRect(36, rowY + 10, canvas.width - 72, 54);
    ctx.strokeStyle = "#a7f3d0";
    ctx.strokeRect(36, rowY + 10, canvas.width - 72, 54);

    ctx.textAlign = "left";
    ctx.fillStyle = "#065f46";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText("TỔNG TIỀN PHẢI THU:", 52, rowY + 43);

    ctx.textAlign = "right";
    ctx.fillStyle = "#047857";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(formatVND(total), canvas.width - 52, rowY + 45);

    // Khu vực VietQR & Thông tin thanh toán
    const qrBoxY = rowY + 80;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(36, qrBoxY, canvas.width - 72, 230);
    ctx.strokeStyle = "#cbd5e1";
    ctx.strokeRect(36, qrBoxY, canvas.width - 72, 230);

    ctx.textAlign = "left";
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText("QUÉT MÃ VIETQR THANH TOÁN TỰ ĐỘNG", 52, qrBoxY + 30);

    ctx.fillStyle = "#475569";
    ctx.font = "12px sans-serif";
    ctx.fillText(`Ngân hàng: ${settings.bankName}`, 240, qrBoxY + 70);
    ctx.fillText(`Số tài khoản: ${settings.accountNumber}`, 240, qrBoxY + 100);
    ctx.fillText(`Chủ tài khoản: ${settings.accountName}`, 240, qrBoxY + 130);
    ctx.fillStyle = "#1d4ed8";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(`Cú pháp CK: THANHTOAN ${room.id}`, 240, qrBoxY + 165);
    ctx.fillStyle = "#ef4444";
    ctx.font = "12px sans-serif";
    ctx.fillText(`Hạn thanh toán: ${room.dueDate}`, 240, qrBoxY + 195);

    // Tải ảnh VietQR vẽ vào canvas
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.drawImage(img, 52, qrBoxY + 46, 160, 160);

      // Đóng dấu kiểm toán HĐĐT
      ctx.save();
      ctx.translate(canvas.width - 150, canvas.height - 130);
      ctx.rotate(-0.25);
      if (room.status === "PAID") {
        ctx.strokeStyle = "#059669";
        ctx.lineWidth = 3;
        ctx.strokeRect(-80, -25, 160, 50);
        ctx.fillStyle = "#059669";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("ĐÃ XUẤT HĐĐT", 0, 0);
        ctx.font = "10px sans-serif";
        ctx.fillText("ĐÃ THANH TOÁN", 0, 16);
      } else {
        ctx.strokeStyle = "#dc2626";
        ctx.lineWidth = 3;
        ctx.strokeRect(-80, -25, 160, 50);
        ctx.fillStyle = "#dc2626";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("CHƯA THU TIỀN", 0, 0);
        ctx.font = "10px sans-serif";
        ctx.fillText("CHỜ KHÁCH CK", 0, 16);
      }
      ctx.restore();

      // Footer
      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Hóa đơn được tự động lập bởi AI Agent Công Ty An Gia Smart Home", canvas.width / 2, canvas.height - 30);

      resolve(canvas.toDataURL("image/png"));
    };

    img.onerror = () => {
      // Fallback nếu không tải được ảnh QR mạng
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(52, qrBoxY + 46, 160, 160);
      ctx.fillStyle = "#475569";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Mã VietQR", 132, qrBoxY + 130);
      resolve(canvas.toDataURL("image/png"));
    };

    img.src = qrUrl;
  });
};

/** Tải file ảnh phiếu thu hóa đơn PNG */
export const downloadInvoiceImage = async (room: Room, settings: Settings) => {
  const dataUrl = await generateInvoiceCanvasImage(room, settings);
  if (!dataUrl) return;

  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `Phieu-Thu-Phong-${room.id}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
};
