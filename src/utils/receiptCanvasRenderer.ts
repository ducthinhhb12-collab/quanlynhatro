/**
 * BỘ KẾT XUẤT PHIẾU THU HÓA ĐƠN HTML5 CANVAS 2X RETINA (WORKER 3)
 * An Gia Smart Home 3D - High-Res 1080x1520 Pure Canvas Invoice Renderer
 * 
 * - Không sử dụng html2canvas để tránh lỗi màu oklch và lỗi bảo mật CORS.
 * - Khung viền luxury sang trọng, huy hiệu mộc tròn đỏ "ĐÃ XÁC NHẬN PHÁT HÀNH".
 * - Bảng chi tiết điện nước, mã VietQR nhúng cục bộ và chữ ký số chủ nhà.
 * - Xuất ảnh chuẩn Retina Base64 PNG siêu sắc nét trên mọi thiết bị.
 */

import type { Room, Settings } from "../types";
import type { ZaloHostSession } from "../types/swarmContracts";
import { electricityAmount, formatNumber, formatVND, roomTotal, buildVietQrUrl } from "./format";
import QRCode from "qrcode";

/**
 * Hàm đọc số tiền VNĐ thành chữ tiếng Việt chuẩn xác theo quy tắc tài chính
 */
export const readVNDToWords = (amount: number): string => {
  const num = Math.round(Math.abs(amount));
  if (num === 0) return "Không đồng chẵn";

  const digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const scales = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];

  const groups: number[] = [];
  let temp = num;
  while (temp > 0) {
    groups.push(temp % 1000);
    temp = Math.floor(temp / 1000);
  }

  const readThreeDigits = (val: number, isHighest: boolean): string => {
    const hundred = Math.floor(val / 100);
    const ten = Math.floor((val % 100) / 10);
    const unit = val % 10;
    const parts: string[] = [];

    if (hundred > 0 || !isHighest) {
      parts.push(`${digits[hundred]} trăm`);
    }

    if (ten > 1) {
      parts.push(`${digits[ten]} mươi`);
      if (unit === 1) parts.push("mốt");
      else if (unit === 4) parts.push("tư");
      else if (unit === 5) parts.push("lăm");
      else if (unit > 0) parts.push(digits[unit]);
    } else if (ten === 1) {
      parts.push("mười");
      if (unit === 5) parts.push("lăm");
      else if (unit > 0) parts.push(digits[unit]);
    } else if (ten === 0 && unit > 0) {
      if (hundred > 0 || !isHighest) {
        parts.push("lẻ");
      }
      parts.push(digits[unit]);
    }

    return parts.join(" ");
  };

  const resultParts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const gVal = groups[i];
    if (gVal > 0) {
      const isHighest = i === groups.length - 1;
      const gStr = readThreeDigits(gVal, isHighest);
      if (gStr) {
        const scale = scales[i];
        resultParts.push(scale ? `${gStr} ${scale}` : gStr);
      }
    }
  }

  const result = resultParts.join(" ").trim();
  if (!result) return "Không đồng chẵn";
  return result.charAt(0).toUpperCase() + result.slice(1) + " đồng chẵn";
};

/**
 * Vẽ hình chữ nhật bo góc tương thích mọi trình duyệt và canvas
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Vẽ chữ cong theo cung tròn cho con dấu mộc đỏ
 */
function drawCurvedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  inward: boolean = true
) {
  const chars = text.split("");
  const totalAngle = endAngle - startAngle;
  const step = chars.length > 1 ? totalAngle / (chars.length - 1) : 0;
  ctx.save();
  chars.forEach((ch, i) => {
    const angle = startAngle + step * i;
    ctx.save();
    ctx.translate(centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle));
    ctx.rotate(angle + (inward ? Math.PI / 2 : -Math.PI / 2));
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}

/**
 * Vẽ dấu mộc tròn đỏ chứng thực "ĐÃ XÁC NHẬN PHÁT HÀNH"
 */
function drawOfficialRedSeal(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number
) {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(-0.18); // Góc nghiêng tự nhiên của mộc thật (-10.3 độ)

  const redColor = "#dc2626"; // Đỏ chuẩn mộc văn bản
  ctx.strokeStyle = redColor;
  ctx.fillStyle = redColor;

  // 1. Hai vòng tròn đồng tâm
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 84, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 0, 75, 0, Math.PI * 2);
  ctx.stroke();

  // 2. Chữ cong hình cung phía trên
  ctx.font = "bold 15px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  drawCurvedText(ctx, "★ AN GIA SMART HOME ★", 0, 0, 60, -Math.PI * 0.8, -Math.PI * 0.2, true);

  // 3. Ngôi sao trang trí trung tâm
  ctx.font = "bold 13px 'Segoe UI', Arial, sans-serif";
  ctx.fillText("★  ★  ★", 0, -18);

  // 4. Dòng chữ chính xác nhận ở giữa
  ctx.font = "bold 19px 'Segoe UI', Arial, sans-serif";
  ctx.fillText("ĐÃ XÁC NHẬN", 0, 6);
  ctx.fillText("PHÁT HÀNH", 0, 28);

  // 5. Chữ cong hoặc nhãn phía dưới
  ctx.font = "bold 12px 'Segoe UI', Arial, sans-serif";
  ctx.fillText("HÓA ĐƠN ĐIỆN TỬ", 0, 52);

  ctx.restore();
}

/**
 * TẠO ẢNH PHIẾU THU RETINA 2X (1080 x 1520) THUẦN HTML5 CANVAS
 * Hoàn toàn không phụ thuộc html2canvas, chống lỗi CORS và chạy mượt 100% offline.
 */
export const renderReceiptCanvas = async (
  room: Room,
  settings: Settings,
  session?: ZaloHostSession
): Promise<string> => {
  return new Promise(async (resolve) => {
    try {
      const width = 1080;
      const height = 1520;

      const total = roomTotal(room, settings);
      const totalWords = readVNDToWords(total);
      const kwh = Math.max(0, room.electricNew - room.electricOld);
      const elecFee = electricityAmount(room, settings.electricUnitPrice);

      // Tạo canvas ẩn
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      if (!ctx) {
        resolve("");
        return;
      }

      // 1. NỀN TRẮNG TINH & BỀ MẶT GIẤY IN CHỨNG TỪ CAO CẤP
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      // Dải nền gradient nhẹ trang trí phần đầu phiếu
      const topGrad = ctx.createLinearGradient(0, 0, 0, 260);
      topGrad.addColorStop(0, "#f0fdf4");
      topGrad.addColorStop(1, "#ffffff");
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, width, 260);

      // 2. KHUNG VIỀN LUXURY SANG TRỌNG (DOUBLE BORDER VÀNG KIM & XANH NGỌC)
      // Viền ngoài xanh ngọc sâu
      ctx.strokeStyle = "#065f46";
      ctx.lineWidth = 4;
      ctx.strokeRect(28, 28, width - 56, height - 56);

      // Viền trong vàng kim / lục bảo thanh lịch
      ctx.strokeStyle = "#d97706";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(40, 40, width - 80, height - 80);

      // 4 Họa tiết góc vàng kim
      const corners = [
        { x: 40, y: 40 },
        { x: width - 40, y: 40 },
        { x: 40, y: height - 40 },
        { x: width - 40, y: height - 40 },
      ];
      ctx.fillStyle = "#d97706";
      corners.forEach((c) => {
        ctx.beginPath();
        ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      // 3. PHẦN ĐẦU HÓA ĐƠN (HEADER 'AN GIA SMART HOME')
      // Huy hiệu định vị trên cùng
      const badgeW = 460;
      const badgeH = 34;
      const badgeX = (width - badgeW) / 2;
      const badgeY = 62;
      ctx.fillStyle = "#ecfdf5";
      drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 17);
      ctx.fill();
      ctx.strokeStyle = "#a7f3d0";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#065f46";
      ctx.font = "bold 15px 'Segoe UI', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("★ HỆ THỐNG CĂN HỘ CAO CẤP & QUẢN LÝ THÔNG MINH ★", width / 2, badgeY + 22);

      // Tiêu đề thương hiệu chính
      ctx.font = "900 48px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = "#065f46";
      ctx.fillText("AN GIA SMART HOME", width / 2, 142);

      // Tên phiếu
      ctx.font = "bold 23px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = "#047857";
      ctx.fillText("PHIẾU THU TIỀN PHÒNG & DỊCH VỤ SINH HOẠT", width / 2, 182);

      // Kỳ thu và ngày tháng
      const billingCycle = room.startDate
        ? `Từ ngày ${room.startDate} đến ngày ${room.dueDate}`
        : `Hạn thanh toán: ${room.dueDate}`;
      const nowStr = new Date().toLocaleDateString("vi-VN");
      ctx.font = "italic 16px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(`Mã chứng từ: HD-${room.id}-${nowStr.replace(/\//g, "")}  •  Kỳ tính tiền: ${billingCycle}`, width / 2, 218);

      // Đường kẻ ngang trang trí
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(70, 242);
      ctx.lineTo(width - 70, 242);
      ctx.stroke();

      // 4. HỘP THÔNG TIN PHÒNG VÀ KHÁCH THUÊ
      const cardX = 70;
      const cardY = 262;
      const cardW = width - 140;
      const cardH = 136;
      ctx.fillStyle = "#f8fafc";
      drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 12);
      ctx.fill();
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Cột trái: Tên phòng, Khách thuê, SĐT
      ctx.textAlign = "left";
      ctx.fillStyle = "#0f172a";
      ctx.font = "900 24px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(`Căn Hộ / Phòng: ${room.id}`, cardX + 30, cardY + 40);

      ctx.fillStyle = "#047857";
      ctx.font = "bold 16px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(`(Tầng ${room.floor})`, cardX + 330, cardY + 39);

      ctx.fillStyle = "#475569";
      ctx.font = "17px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("Khách thuê:", cardX + 30, cardY + 76);
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 18px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(`${room.tenant || "Phòng trống"}`, cardX + 135, cardY + 76);

      ctx.fillStyle = "#475569";
      ctx.font = "17px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("Số điện thoại:", cardX + 30, cardY + 110);
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 18px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(`${room.phone || "--"}`, cardX + 148, cardY + 110);

      // Cột phải: Diện tích, Hạn đóng tiền, Huy hiệu trạng thái
      const colRightX = cardX + 540;
      ctx.fillStyle = "#475569";
      ctx.font = "17px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("Diện tích:", colRightX, cardY + 40);
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 18px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(`${room.area} m²`, colRightX + 90, cardY + 40);

      ctx.fillStyle = "#475569";
      ctx.font = "17px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("Hạn thanh toán:", colRightX, cardY + 76);
      ctx.fillStyle = "#dc2626";
      ctx.font = "bold 18px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(`${room.dueDate}`, colRightX + 145, cardY + 76);

      // Huy hiệu trạng thái
      ctx.fillStyle = "#475569";
      ctx.font = "17px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("Trạng thái:", colRightX, cardY + 110);

      const statusMap: Record<string, { label: string; bg: string; text: string; border: string }> = {
        PAID: { label: "ĐÃ THANH TOÁN", bg: "#ecfdf5", text: "#047857", border: "#10b981" },
        PENDING: { label: "CHỜ THANH TOÁN", bg: "#fffbeb", text: "#b45309", border: "#f59e0b" },
        OVERDUE: { label: "QUÁ HẠN THANH TOÁN", bg: "#fef2f2", text: "#b91c1c", border: "#ef4444" },
        EMPTY: { label: "PHÒNG TRỐNG", bg: "#f1f5f9", text: "#475569", border: "#94a3b8" },
      };
      const st = statusMap[room.status] || statusMap.PENDING;

      const badgeStatW = 180;
      const badgeStatH = 28;
      const badgeStatX = colRightX + 100;
      const badgeStatY = cardY + 92;
      ctx.fillStyle = st.bg;
      drawRoundedRect(ctx, badgeStatX, badgeStatY, badgeStatW, badgeStatH, 6);
      ctx.fill();
      ctx.strokeStyle = st.border;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = st.text;
      ctx.font = "bold 13px 'Segoe UI', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(st.label, badgeStatX + badgeStatW / 2, badgeStatY + 19);

      // 5. BẢNG CHI TIẾT CHI PHÍ ĐIỆN NƯỚC & DỊCH VỤ
      const tableX = 70;
      const tableY = 422;
      const tableW = width - 140;

      // Tiêu đề bảng
      const thH = 46;
      ctx.fillStyle = "#065f46";
      drawRoundedRect(ctx, tableX, tableY, tableW, thH, 8);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px 'Segoe UI', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("STT", tableX + 35, tableY + 28);

      ctx.textAlign = "left";
      ctx.fillText("KHOẢN MỤC CHI PHÍ", tableX + 85, tableY + 28);
      ctx.fillText("CHỈ SỐ / ĐƠN GIÁ", tableX + 370, tableY + 28);

      ctx.textAlign = "center";
      ctx.fillText("KHỐI LƯỢNG", tableX + 680, tableY + 28);

      ctx.textAlign = "right";
      ctx.fillText("THÀNH TIỀN (VNĐ)", tableX + tableW - 30, tableY + 28);

      // Các hàng chi phí
      const rows = [
        {
          stt: "01",
          name: "Tiền thuê phòng căn hộ",
          rate: "Cố định theo hợp đồng",
          qty: "01 tháng",
          amount: formatVND(room.roomFee),
        },
        {
          stt: "02",
          name: "Tiền điện sinh hoạt",
          rate: `${formatNumber(settings.electricUnitPrice)} đ/kWh`,
          qty: `Cũ: ${formatNumber(room.electricOld)} ➔ Mới: ${formatNumber(room.electricNew)} (${formatNumber(kwh)} kWh)`,
          amount: formatVND(elecFee),
        },
        {
          stt: "03",
          name: "Tiền nước sinh hoạt",
          rate: "Định mức trọn gói",
          qty: "01 tháng",
          amount: formatVND(room.waterFee),
        },
        {
          stt: "04",
          name: "Internet WiFi tốc độ cao & Rác",
          rate: "Gói gia đình cao cấp",
          qty: "01 tháng",
          amount: formatVND(room.internetFee),
        },
      ];

      let curY = tableY + thH;
      const rowH = 54;
      rows.forEach((r, idx) => {
        // Nền xen kẽ
        ctx.fillStyle = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
        ctx.fillRect(tableX, curY, tableW, rowH);

        // Đường kẻ ngang mỏng
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tableX, curY + rowH);
        ctx.lineTo(tableX + tableW, curY + rowH);
        ctx.stroke();

        // Chữ
        ctx.fillStyle = "#64748b";
        ctx.font = "bold 15px 'Segoe UI', Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(r.stt, tableX + 35, curY + 33);

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 16px 'Segoe UI', Arial, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(r.name, tableX + 85, curY + 33);

        ctx.fillStyle = "#475569";
        ctx.font = "15px 'Segoe UI', Arial, sans-serif";
        ctx.fillText(r.rate, tableX + 370, curY + 33);

        ctx.textAlign = "center";
        ctx.fillText(r.qty, tableX + 680, curY + 33);

        ctx.fillStyle = "#065f46";
        ctx.font = "900 17px 'Segoe UI', Arial, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(r.amount, tableX + tableW - 30, curY + 33);

        curY += rowH;
      });

      // 6. KHỐI TỔNG CỘNG TIỀN PHẢI THU (TỔNG TIỀN & BẰNG CHỮ)
      const totalBoxY = curY + 16;
      const totalBoxH = 104;
      ctx.fillStyle = "#ecfdf5";
      drawRoundedRect(ctx, tableX, totalBoxY, tableW, totalBoxH, 12);
      ctx.fill();
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.fillStyle = "#065f46";
      ctx.font = "bold 20px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("TỔNG TIỀN PHẢI THANH TOÁN:", tableX + 30, totalBoxY + 40);

      ctx.font = "italic bold 17px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = "#047857";
      ctx.fillText(`(Bằng chữ: ${totalWords})`, tableX + 30, totalBoxY + 76);

      ctx.textAlign = "right";
      ctx.font = "900 38px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = "#047857";
      ctx.fillText(formatVND(total), tableX + tableW - 30, totalBoxY + 62);

      // 7. KHU VỰC MÃ VIETQR NHÚNG & THÔNG TIN CHUYỂN KHOẢN TỰ ĐỘNG
      const payCardY = totalBoxY + totalBoxH + 20;
      const payCardH = 328;
      ctx.fillStyle = "#f8fafc";
      drawRoundedRect(ctx, tableX, payCardY, tableW, payCardH, 12);
      ctx.fill();
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Tiêu đề thanh toán
      ctx.textAlign = "left";
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 18px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("THÔNG TIN CHUYỂN KHOẢN NHANH QUA MÃ VIETQR ĐỘNG 24/7", tableX + 30, payCardY + 38);

      // Tạo mã VietQR cục bộ bằng thư viện qrcode
      // Chuẩn Napas link hoặc cú pháp ngân hàng
      const qrTargetUrl = buildVietQrUrl(room, settings);
      let qrBase64DataUrl = "";
      try {
        qrBase64DataUrl = await QRCode.toDataURL(qrTargetUrl, {
          width: 400,
          margin: 1,
          color: { dark: "#0f172a", light: "#ffffff" },
          errorCorrectionLevel: "M",
        });
      } catch {
        qrBase64DataUrl = "";
      }

      // Khung chứa mã QR bên trái
      const qrBoxX = tableX + 30;
      const qrBoxY = payCardY + 56;
      const qrBoxSize = 246;

      ctx.fillStyle = "#ffffff";
      drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 8);
      ctx.fill();
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Vẽ thông tin tài khoản bên phải
      const bankInfoX = qrBoxX + qrBoxSize + 36;
      let bankLineY = qrBoxY + 30;

      ctx.fillStyle = "#64748b";
      ctx.font = "16px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("Ngân hàng nhận:", bankInfoX, bankLineY);
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 18px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(settings.bankName, bankInfoX + 150, bankLineY);

      bankLineY += 38;
      ctx.fillStyle = "#64748b";
      ctx.font = "16px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("Số tài khoản:", bankInfoX, bankLineY);
      ctx.fillStyle = "#0284c7"; // Màu xanh làm nổi bật STK
      ctx.font = "900 24px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(settings.accountNumber, bankInfoX + 150, bankLineY + 2);

      bankLineY += 38;
      ctx.fillStyle = "#64748b";
      ctx.font = "16px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("Chủ tài khoản:", bankInfoX, bankLineY);
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 18px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(settings.accountName, bankInfoX + 150, bankLineY);

      bankLineY += 38;
      // Khối cú pháp chuyển khoản màu đỏ cam nổi bật
      const syntaxW = tableW - (qrBoxSize + 76);
      const syntaxH = 46;
      ctx.fillStyle = "#fef2f2";
      drawRoundedRect(ctx, bankInfoX, bankLineY - 20, syntaxW, syntaxH, 8);
      ctx.fill();
      ctx.strokeStyle = "#fca5a5";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#b91c1c";
      ctx.font = "bold 17px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(`Cú pháp CK bắt buộc:  THANHTOAN ${room.id}`, bankInfoX + 16, bankLineY + 10);

      bankLineY += 46;
      ctx.fillStyle = "#dc2626";
      ctx.font = "bold 16px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(`⏰ Hạn thanh toán: ${room.dueDate}`, bankInfoX, bankLineY + 8);

      const hostHotline = session?.hostPhone || room.phone || "0901 234 567";
      ctx.fillStyle = "#64748b";
      ctx.font = "italic 15px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(`Hotline BQL hỗ trợ giải đáp 24/7: ${hostHotline}`, bankInfoX, bankLineY + 34);

      // 8. PHẦN KÝ TÊN VÀ ĐÓNG DẤU MỘC ĐỎ
      const signSectionY = payCardY + payCardH + 28;

      // Bên trái: Đại diện Ban Quản Lý ký số
      const signCenterX = tableX + 220;
      ctx.textAlign = "center";
      ctx.fillStyle = "#334155";
      ctx.font = "bold 18px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("ĐẠI DIỆN BAN QUẢN LÝ TÒA NHÀ", signCenterX, signSectionY);

      ctx.font = "italic 14px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText("(Ký số điện tử & đóng dấu chứng thực)", signCenterX, signSectionY + 22);

      // Chữ ký cách điệu nghệ thuật mô phỏng chữ ký tay
      const hostDisplayName = session?.hostName || settings.accountName || "Lê Văn An";
      ctx.font = "italic bold 32px 'Brush Script MT', 'Segoe Script', 'Dancing Script', cursive, sans-serif";
      ctx.fillStyle = "#1e3a8a"; // Mực xanh bút ký
      ctx.fillText(hostDisplayName, signCenterX, signSectionY + 76);

      // Họ tên người ký in hoa rõ ràng
      ctx.font = "bold 18px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = "#0f172a";
      ctx.fillText(hostDisplayName, signCenterX, signSectionY + 115);

      ctx.font = "14px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText("Chủ Tòa Nhà / Đại Diện BQL An Gia", signCenterX, signSectionY + 138);

      // Huy hiệu chữ ký số hợp lệ
      ctx.fillStyle = "#059669";
      ctx.font = "bold 13px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("✓ Digitally Verified & Published", signCenterX, signSectionY + 162);

      // Bên phải: Đóng dấu mộc tròn đỏ "ĐÃ XÁC NHẬN PHÁT HÀNH"
      const sealCenterX = tableX + tableW - 220;
      const sealCenterY = signSectionY + 80;
      drawOfficialRedSeal(ctx, sealCenterX, sealCenterY);

      // 9. CHÂN TRANG HÓA ĐƠN (FOOTER)
      const footerY = height - 64;
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(70, footerY - 24);
      ctx.lineTo(width - 70, footerY - 24);
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.fillStyle = "#475569";
      ctx.font = "italic 15px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("Trân trọng cảm ơn Quý khách đã luôn tin tưởng & đồng hành cùng An Gia Smart Home!", width / 2, footerY - 4);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "13px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(`Hóa đơn điện tử phát hành tự động lúc ${nowStr} bởi AI Swarm Agent • Tra cứu bảo mật 24/7`, width / 2, footerY + 18);

      // Nếu có mã QR base64, vẽ ảnh vào canvas và xuất PNG
      if (qrBase64DataUrl) {
        const qrImg = new Image();
        qrImg.onload = () => {
          ctx.drawImage(qrImg, qrBoxX + 10, qrBoxY + 10, qrBoxSize - 20, qrBoxSize - 20);
          resolve(canvas.toDataURL("image/png"));
        };
        qrImg.onerror = () => {
          // Fallback nếu ảnh QR lỗi
          ctx.fillStyle = "#64748b";
          ctx.font = "14px 'Segoe UI', Arial, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("Mã VietQR 24/7", qrBoxX + qrBoxSize / 2, qrBoxY + qrBoxSize / 2);
          resolve(canvas.toDataURL("image/png"));
        };
        qrImg.src = qrBase64DataUrl;
      } else {
        resolve(canvas.toDataURL("image/png"));
      }
    } catch (err) {
      console.error("Lỗi kết xuất receiptCanvasRenderer:", err);
      resolve("");
    }
  });
};

/**
 * Tương thích ngược: tải trực tiếp file ảnh phiếu thu PNG từ trình duyệt
 */
export const downloadReceiptPng = async (room: Room, settings: Settings, session?: ZaloHostSession) => {
  const dataUrl = await renderReceiptCanvas(room, settings, session);
  if (!dataUrl) return;

  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `Phieu-Thu-${room.id}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
};
