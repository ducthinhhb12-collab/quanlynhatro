/**
 * BỘ KẾT XUẤT HÓA ĐƠN VIẾT TAY VINTAGE (HANDWRITTEN BILL CANVAS RENDERER)
 * An Gia Smart Home - High-Resolution 1080x1500 HTML5 Canvas Renderer
 * 
 * - Giả lập phong cách giấy tập học sinh / sổ tay kẻ ô ly mờ (#fcfaf2, #e8e2d2).
 * - Nét mực bút bi / bút mực xanh tự nhiên, mềm mại chân thật.
 * - Thể hiện đầy đủ: Phòng số, Khách thuê, Ngày thu, Chỉ số điện (Cũ/Mới/Đã dùng/Thành tiền),
 *   Tiền nước, Tiền phòng, Tổng cộng bằng số & Bằng chữ tiếng Việt.
 * - Kèm lời nhắn viết tay thân tình của cô chủ nhà gửi em thuê phòng.
 * - Chữ ký tay tự nhiên của chủ nhà và con dấu mộc tròn đỏ "ĐÃ XÁC NHẬN - AN GIA".
 * - Xuất chuỗi Base64 Data URL (PNG) siêu sắc nét.
 */

import type { Room, Settings } from "../types";
import { electricityAmount, formatNumber, formatVND, roomTotal } from "./format";

/**
 * Đọc số tiền VNĐ thành chữ tiếng Việt chuẩn xác theo quy tắc tài chính
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
 * Vẽ đoạn thẳng viết tay có độ rung nhẹ tự nhiên của ngòi bút
 */
function drawHandwrittenLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string = "#1e3a8a",
  width: number = 1.6
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(3, Math.floor(length / 28));

  ctx.beginPath();
  ctx.moveTo(x1, y1);

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const curX = x1 + dx * t;
    const curY = y1 + dy * t;
    // Rung nhẹ ngẫu nhiên nhỏ +/- 0.8px
    const jitterX = (Math.sin(i * 1.7) * 0.7);
    const jitterY = (Math.cos(i * 2.3) * 0.7);
    if (i === steps) {
      ctx.lineTo(x2, y2);
    } else {
      ctx.lineTo(curX + jitterX, curY + jitterY);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Vẽ hộp chữ nhật vẽ tay có viền uốn nhẹ tự nhiên
 */
function drawHandwrittenBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  borderColor: string = "#1e3a8a",
  fillColor?: string,
  lineWidth: number = 1.8
) {
  ctx.save();
  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, 8) : ctx.rect(x, y, w, h);
    ctx.fill();
  }

  drawHandwrittenLine(ctx, x, y, x + w, y, borderColor, lineWidth);
  drawHandwrittenLine(ctx, x + w, y, x + w, y + h, borderColor, lineWidth);
  drawHandwrittenLine(ctx, x + w, y + h, x, y + h, borderColor, lineWidth);
  drawHandwrittenLine(ctx, x, y + h, x, y, borderColor, lineWidth);
  ctx.restore();
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
 * Vẽ con dấu tròn đỏ "ĐÃ XÁC NHẬN - AN GIA"
 */
function drawHandwrittenRedSeal(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number
) {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(-0.14); // Góc nghiêng tự nhiên của mộc đóng tay (-8 độ)

  const red = "#dc2626";
  ctx.strokeStyle = red;
  ctx.fillStyle = red;

  // 1. Hai vòng tròn đồng tâm
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(0, 0, 78, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, 70, 0, Math.PI * 2);
  ctx.stroke();

  // 2. Chữ cong hình vòng cung phía trên
  ctx.font = "bold 13px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  drawCurvedText(ctx, "★ AN GIA SMART HOME ★", 0, 0, 56, -Math.PI * 0.8, -Math.PI * 0.2, true);

  // 3. Ngôi sao ở giữa
  ctx.font = "bold 12px 'Segoe UI', Arial, sans-serif";
  ctx.fillText("★  ★  ★", 0, -18);

  // 4. Nội dung chính xác nhận
  ctx.font = "900 17px 'Segoe UI', Arial, sans-serif";
  ctx.fillText("ĐÃ XÁC NHẬN", 0, 4);

  ctx.font = "bold 15px 'Segoe UI', Arial, sans-serif";
  ctx.fillText("AN GIA", 0, 24);

  // 5. Chữ cong phía dưới
  ctx.font = "bold 11px 'Segoe UI', Arial, sans-serif";
  ctx.fillText("ĐÃ THU ĐỦ TIỀN", 0, 48);

  ctx.restore();
}

/**
 * TẠO ẢNH HÓA ĐƠN VIẾT TAY (VINTAGE HANDWRITTEN BILL) ĐỘ PHÂN GIẢI CAO (1080x1500)
 * 
 * @param room Dữ liệu phòng
 * @param settings Cấu hình hệ thống
 * @param session Phiên làm việc Zalo / Chủ nhà
 * @returns Base64 Data URL (image/png)
 */
export async function renderHandwrittenBillCanvas(
  room: Room,
  settings: Settings,
  session?: any
): Promise<string> {
  return new Promise((resolve) => {
    try {
      const width = 1080;
      const height = 1500;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      if (!ctx) {
        resolve("");
        return;
      }

      // Font chữ viết tay ưu tiên
      const handwritingFont = "'Caveat', 'Segoe Print', 'Dancing Script', 'Comic Sans MS', cursive, sans-serif";
      const inkColor = "#1e3a8a"; // Mực xanh bút máy cổ điển
      const inkRed = "#b91c1c"; // Mực đỏ ghi chú / tổng cộng
      const inkSoft = "#475569"; // Mực nhạt phụ đề

      // 1. NỀN GIẤY TẬP HỌC SINH MÀU KEM ẤM (#fcfaf2)
      ctx.fillStyle = "#fcfaf2";
      ctx.fillRect(0, 0, width, height);

      // Hiệu ứng giấy ngả màu vintage nhẹ quanh viền
      const vignette = ctx.createRadialGradient(
        width / 2,
        height / 2,
        width * 0.35,
        width / 2,
        height / 2,
        width * 0.72
      );
      vignette.addColorStop(0, "rgba(252, 250, 242, 0)");
      vignette.addColorStop(1, "rgba(235, 225, 203, 0.45)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      // 2. KẺ Ô LY TẬP HỌC SINH VINTAGE (ĐƯỜNG KẺ MỜ #e8e2d2)
      const gridSize = 42;
      ctx.strokeStyle = "#e8e2d2";
      ctx.lineWidth = 0.8;

      // Lưới ngang
      for (let y = gridSize; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Lưới dọc
      for (let x = gridSize; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // 3. ĐƯỜNG KẺ LỀ ĐỎ TẬP VỞ (MARGIN LINE HỌC SINH)
      const marginX = 138;
      ctx.strokeStyle = "#f87171";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(marginX, 0);
      ctx.lineTo(marginX, height);
      ctx.stroke();

      // Hai lỗ đóng gáy vở bên lề trái (Binder hole accents)
      const holesY = [280, 750, 1220];
      holesY.forEach((hy) => {
        ctx.save();
        ctx.fillStyle = "#e2d8c3";
        ctx.beginPath();
        ctx.arc(42, hy, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#cbbca3";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      });

      // 4. ĐẦU TRANG TẬP VỞ (HEADER METADATA)
      ctx.fillStyle = inkSoft;
      ctx.font = `italic 17px ${handwritingFont}`;
      ctx.textAlign = "left";
      ctx.fillText("Vở Thu Tiền Trọ An Gia", marginX + 16, 52);

      const billCycleMonth = room.dueDate ? room.dueDate.split("/")[1] || "05" : "05";
      const billCycleYear = room.dueDate ? room.dueDate.split("/")[2] || "2026" : "2026";
      ctx.textAlign = "right";
      ctx.fillText(
        `Tháng: ${billCycleMonth} / ${billCycleYear}  •  Số: VT-${room.id}-${room.dueDate.replace(/\//g, "")}`,
        width - 50,
        52
      );

      // Đường kẻ ngang mỏng dưới header
      drawHandwrittenLine(ctx, marginX + 10, 68, width - 40, 68, "#d1c7b7", 1);

      // 5. TIÊU ĐỀ VIẾT TAY MỀM MẠI, CHÂN THẬT
      const titleCenterX = marginX + (width - marginX) / 2;
      ctx.textAlign = "center";
      ctx.fillStyle = inkColor;
      ctx.font = `bold 44px ${handwritingFont}`;
      ctx.fillText("BIÊN NHẬN THU TIỀN PHÒNG & ĐIỆN NƯỚC", titleCenterX, 138);

      // Gạch chân uốn lượn viết tay tự nhiên
      drawHandwrittenLine(ctx, titleCenterX - 360, 154, titleCenterX + 360, 154, inkColor, 2.2);
      drawHandwrittenLine(ctx, titleCenterX - 320, 160, titleCenterX + 320, 160, inkColor, 1.2);

      // 6. THÔNG TIN KHÁCH THUÊ & PHÒNG SỐ
      const infoBoxX = marginX + 24;
      const infoBoxY = 188;
      const infoBoxW = width - marginX - 60;
      const infoBoxH = 158;

      drawHandwrittenBox(ctx, infoBoxX, infoBoxY, infoBoxW, infoBoxH, "#c7bb9f", "rgba(255, 255, 255, 0.45)");

      ctx.textAlign = "left";
      ctx.fillStyle = inkColor;
      ctx.font = `bold 26px ${handwritingFont}`;
      ctx.fillText(`Phòng số: ${room.id}`, infoBoxX + 24, infoBoxY + 44);

      ctx.fillStyle = inkSoft;
      ctx.font = `22px ${handwritingFont}`;
      ctx.fillText(`(Tầng ${room.floor}  •  Diện tích: ${room.area} m²)`, infoBoxX + 260, infoBoxY + 44);

      ctx.fillStyle = inkColor;
      ctx.font = `bold 24px ${handwritingFont}`;
      ctx.fillText("Khách thuê:", infoBoxX + 24, infoBoxY + 88);
      ctx.fillStyle = "#0f172a";
      ctx.fillText(`${room.tenant || "Phòng trống"}`, infoBoxX + 160, infoBoxY + 88);

      ctx.fillStyle = inkColor;
      ctx.font = `bold 22px ${handwritingFont}`;
      ctx.fillText("Số điện thoại:", infoBoxX + 24, infoBoxY + 128);
      ctx.fillStyle = "#0f172a";
      ctx.fillText(`${room.phone || "--"}`, infoBoxX + 175, infoBoxY + 128);

      // Cột phải thông tin
      const colRightX = infoBoxX + 540;
      ctx.fillStyle = inkColor;
      ctx.font = `bold 22px ${handwritingFont}`;
      ctx.fillText("Ngày lập phiếu:", colRightX, infoBoxY + 44);
      ctx.fillStyle = "#0f172a";
      ctx.fillText(`${room.dueDate}`, colRightX + 160, infoBoxY + 44);

      ctx.fillStyle = inkColor;
      ctx.fillText("Kỳ thanh toán:", colRightX, infoBoxY + 88);
      ctx.fillStyle = "#0f172a";
      const cycleText = room.startDate ? `${room.startDate} ➔ ${room.dueDate}` : `Hạn đóng ${room.dueDate}`;
      ctx.fillText(cycleText, colRightX + 155, infoBoxY + 88);

      ctx.fillStyle = "#059669";
      ctx.font = `italic bold 21px ${handwritingFont}`;
      ctx.fillText("✓ Đã đối soát chỉ số điện nước", colRightX, infoBoxY + 128);

      // 7. CÁC DÒNG VIẾT TAY CHI TIẾT KHOẢN THU
      const kwh = Math.max(0, room.electricNew - room.electricOld);
      const elecFee = electricityAmount(room, settings.electricUnitPrice);
      const total = roomTotal(room, settings);
      const totalWords = readVNDToWords(total);

      let currentLineY = 390;
      const leftColX = marginX + 30;
      const rightColX = width - 70;

      // Tiêu đề phân mục
      ctx.fillStyle = inkRed;
      ctx.font = `bold 25px ${handwritingFont}`;
      ctx.fillText("CHI TIẾT CÁC KHOẢN TIỀN THÁNG NÀY:", leftColX, currentLineY);
      drawHandwrittenLine(ctx, leftColX, currentLineY + 8, leftColX + 420, currentLineY + 8, inkRed, 1.4);

      // DÒNG 1: Tiền phòng
      currentLineY += 56;
      ctx.fillStyle = inkColor;
      ctx.font = `bold 24px ${handwritingFont}`;
      ctx.fillText("1. Tiền thuê phòng căn hộ:", leftColX, currentLineY);
      ctx.textAlign = "right";
      ctx.font = `bold 26px ${handwritingFont}`;
      ctx.fillText(formatVND(room.roomFee), rightColX, currentLineY);

      // DÒNG 2: Tiền điện sinh hoạt
      currentLineY += 56;
      ctx.textAlign = "left";
      ctx.fillStyle = inkColor;
      ctx.font = `bold 24px ${handwritingFont}`;
      ctx.fillText("2. Tiền điện sinh hoạt:", leftColX, currentLineY);

      // Chi tiết điện
      currentLineY += 40;
      ctx.font = `22px ${handwritingFont}`;
      ctx.fillStyle = inkSoft;
      ctx.fillText(`• Chỉ số cũ: ${formatNumber(room.electricOld)} kWh   ➔   Chỉ số mới: ${formatNumber(room.electricNew)} kWh`, leftColX + 28, currentLineY);

      if (room.meterPhotoUrl) {
        ctx.fillStyle = "#059669";
        ctx.font = `italic bold 19px ${handwritingFont}`;
        ctx.fillText(" [📸 Đã lưu ảnh công tơ AI]", leftColX + 540, currentLineY);
      }

      currentLineY += 38;
      ctx.fillStyle = inkSoft;
      ctx.font = `22px ${handwritingFont}`;
      ctx.fillText(
        `• Số điện tiêu thụ: ${formatNumber(kwh)} kWh  ×  ${formatNumber(settings.electricUnitPrice)} đ/kWh`,
        leftColX + 28,
        currentLineY
      );
      ctx.textAlign = "right";
      ctx.fillStyle = inkColor;
      ctx.font = `bold 26px ${handwritingFont}`;
      ctx.fillText(formatVND(elecFee), rightColX, currentLineY);

      // DÒNG 3: Tiền nước sinh hoạt
      currentLineY += 56;
      ctx.textAlign = "left";
      ctx.fillStyle = inkColor;
      ctx.font = `bold 24px ${handwritingFont}`;
      ctx.fillText("3. Tiền nước sinh hoạt (Định mức trọn gói):", leftColX, currentLineY);
      ctx.textAlign = "right";
      ctx.font = `bold 26px ${handwritingFont}`;
      ctx.fillText(formatVND(room.waterFee), rightColX, currentLineY);

      // DÒNG 4: Tiền mạng Internet WiFi & rác
      currentLineY += 56;
      ctx.textAlign = "left";
      ctx.fillStyle = inkColor;
      ctx.font = `bold 24px ${handwritingFont}`;
      ctx.fillText("4. Tiền mạng WiFi tốc độ cao + Rác sinh hoạt:", leftColX, currentLineY);
      ctx.textAlign = "right";
      ctx.font = `bold 26px ${handwritingFont}`;
      ctx.fillText(formatVND(room.internetFee), rightColX, currentLineY);

      // Đường gạch nét đứt phân cách tổng tiền
      currentLineY += 36;
      drawHandwrittenLine(ctx, leftColX, currentLineY, rightColX, currentLineY, "#b91c1c", 1.8);

      // 8. KHỐI TỔNG CỘNG BẰNG SỐ & BẰNG CHỮ
      currentLineY += 28;
      const totalBoxY = currentLineY;
      const totalBoxH = 120;
      drawHandwrittenBox(ctx, leftColX - 6, totalBoxY, rightColX - leftColX + 12, totalBoxH, "#b91c1c", "rgba(254, 242, 242, 0.65)", 2.2);

      ctx.textAlign = "left";
      ctx.fillStyle = inkRed;
      ctx.font = `bold 32px ${handwritingFont}`;
      ctx.fillText("TỔNG CỘNG PHẢI THANH TOÁN:", leftColX + 20, totalBoxY + 50);

      ctx.textAlign = "right";
      ctx.font = `900 44px ${handwritingFont}`;
      ctx.fillText(formatVND(total), rightColX - 18, totalBoxY + 54);

      ctx.textAlign = "left";
      ctx.fillStyle = inkColor;
      ctx.font = `italic bold 23px ${handwritingFont}`;
      ctx.fillText(`(Bằng chữ: ${totalWords})`, leftColX + 20, totalBoxY + 98);

      // 9. LỜI NHẮN VIẾT TAY THÂN TÌNH CỦA CÔ CHỦ NHÀ
      currentLineY = totalBoxY + totalBoxH + 34;
      const noteBoxY = currentLineY;
      const noteBoxH = 138;
      drawHandwrittenBox(ctx, leftColX - 6, noteBoxY, rightColX - leftColX + 12, noteBoxH, "#0d9488", "rgba(240, 253, 250, 0.75)", 1.8);

      ctx.textAlign = "left";
      ctx.fillStyle = "#0f766e";
      ctx.font = `bold 24px ${handwritingFont}`;
      ctx.fillText("💌 Lời nhắn thân tình của cô chủ nhà:", leftColX + 20, noteBoxY + 40);

      ctx.fillStyle = inkColor;
      ctx.font = `italic bold 25px ${handwritingFont}`;
      ctx.fillText(
        "“Cảm ơn em đã thanh toán đúng hẹn. Chúc em tháng mới nhiều sức khỏe và may mắn nhé!”",
        leftColX + 26,
        noteBoxY + 80
      );

      ctx.fillStyle = inkSoft;
      ctx.font = `italic 20px ${handwritingFont}`;
      ctx.fillText(
        "P/S: Em nhớ tắt bớt điện nước khi ra khỏi phòng để tiết kiệm chi phí nhé ❤",
        leftColX + 26,
        noteBoxY + 116
      );

      // 10. PHẦN KÝ TÊN VÀ CON DẤU MỘC ĐỎ
      const signY = noteBoxY + noteBoxH + 54;

      // Bên trái: Người nộp tiền
      const tenantSignX = leftColX + 160;
      ctx.textAlign = "center";
      ctx.fillStyle = inkColor;
      ctx.font = `bold 23px ${handwritingFont}`;
      ctx.fillText("Người nộp tiền", tenantSignX, signY);
      ctx.font = `italic 19px ${handwritingFont}`;
      ctx.fillStyle = inkSoft;
      ctx.fillText("(Ký & ghi rõ họ tên)", tenantSignX, signY + 28);

      // Chữ ký người thuê
      ctx.font = `italic bold 26px ${handwritingFont}`;
      ctx.fillStyle = "#334155";
      ctx.fillText(room.tenant || "Em thuê phòng", tenantSignX, signY + 104);

      // Bên phải: Đại diện chủ nhà thu tiền
      const hostSignX = rightColX - 180;
      ctx.textAlign = "center";
      ctx.fillStyle = inkColor;
      ctx.font = `bold 23px ${handwritingFont}`;
      ctx.fillText("Người thu tiền (Chủ nhà)", hostSignX, signY);
      ctx.font = `italic 19px ${handwritingFont}`;
      ctx.fillStyle = inkSoft;
      ctx.fillText("(Đã nhận đủ tiền phòng)", hostSignX, signY + 28);

      // Chữ ký uốn lượn phong cách chữ ký tay thật
      const hostDisplayName = session?.hostName || settings.accountName || "Cô Ba (An Gia)";
      ctx.font = `italic bold 38px 'Brush Script MT', 'Dancing Script', ${handwritingFont}`;
      ctx.fillStyle = inkColor;
      ctx.fillText(hostDisplayName, hostSignX, signY + 98);

      ctx.font = `bold 22px ${handwritingFont}`;
      ctx.fillStyle = "#0f172a";
      ctx.fillText(hostDisplayName, hostSignX, signY + 138);

      // 11. ĐÓNG DẤU MỘC TRÒN ĐỎ "ĐÃ XÁC NHẬN - AN GIA"
      const sealCenterX = hostSignX + 50;
      const sealCenterY = signY + 90;
      drawHandwrittenRedSeal(ctx, sealCenterX, sealCenterY);

      // 12. CHÂN TRANG GHI CHÚ LIÊN HỆ
      const footerY = height - 36;
      ctx.textAlign = "center";
      ctx.fillStyle = inkSoft;
      ctx.font = `italic 18px ${handwritingFont}`;
      const hostPhone = session?.hostPhone || settings.accountNumber || "0901 234 567";
      ctx.fillText(
        `Mọi thắc mắc cần hỗ trợ xin gọi cô: ${hostPhone} • Nhà Trọ An Gia luôn đồng hành cùng các em!`,
        titleCenterX,
        footerY
      );

      // Xuất Base64 Data URL định dạng PNG
      const dataUrl = canvas.toDataURL("image/png");
      resolve(dataUrl);
    } catch (err) {
      console.error("Lỗi kết xuất renderHandwrittenBillCanvas:", err);
      resolve("");
    }
  });
}

/**
 * Tải trực tiếp file ảnh hóa đơn viết tay PNG về thiết bị
 */
export async function downloadHandwrittenBillPng(
  room: Room,
  settings: Settings,
  session?: any
): Promise<void> {
  const dataUrl = await renderHandwrittenBillCanvas(room, settings, session);
  if (!dataUrl) return;

  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `Hoa-Don-Viet-Tay-${room.id}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
