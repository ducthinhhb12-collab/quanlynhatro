import type { Room, RoomStatus, Settings } from "../types";

export const formatVND = (n: number): string =>
  new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " ₫";

export const formatNumber = (n: number): string =>
  new Intl.NumberFormat("vi-VN").format(Math.round(n));

/** Tiền điện = (Chỉ số mới - Chỉ số cũ) × Đơn giá */
export const electricityAmount = (room: Room, unitPrice: number): number =>
  Math.max(0, room.electricNew - room.electricOld) * unitPrice;

/** Tổng phải thu của phòng. Phòng trống = 0 */
export const roomTotal = (room: Room, settings: Settings): number => {
  if (room.status === "EMPTY") return 0;
  return (
    room.roomFee +
    electricityAmount(room, settings.electricUnitPrice) +
    room.waterFee +
    room.internetFee
  );
};

export const isUnpaid = (status: RoomStatus): boolean =>
  status === "PENDING" || status === "OVERDUE";

export const STATUS_META: Record<
  RoomStatus,
  { label: string; hex: string; badge: string; dot: string }
> = {
  PAID: {
    label: "Đã đóng",
    hex: "#10B981",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    dot: "bg-emerald-500",
  },
  PENDING: {
    label: "Chờ đóng",
    hex: "#F59E0B",
    badge: "bg-amber-50 text-amber-700 ring-amber-600/20",
    dot: "bg-amber-500",
  },
  OVERDUE: {
    label: "Quá hạn",
    hex: "#EF4444",
    badge: "bg-red-50 text-red-600 ring-red-600/20",
    dot: "bg-red-500",
  },
  EMPTY: {
    label: "Phòng trống",
    hex: "#CBD5E1",
    badge: "bg-slate-100 text-slate-600 ring-slate-500/20",
    dot: "bg-slate-300",
  },
};

/** Lấy ngày hiện tại dạng dd/mm/yyyy */
export const getTodayVN = (): string => {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/** Tự động tính hạn thanh toán sau đúng 1 tháng từ ngày bắt đầu (dd/mm/yyyy) */
export const addOneMonthVN = (dateStr: string): string => {
  const parts = dateStr.trim().split("/");
  if (parts.length !== 3) {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${d.getFullYear()}`;
  }

  const day = parseInt(parts[0], 10) || 1;
  const month = parseInt(parts[1], 10) || 1;
  const year = parseInt(parts[2], 10) || 2026;

  // Tính tháng tiếp theo
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }

  // Xử lý số ngày tối đa của tháng tiếp theo
  const maxDays = new Date(nextYear, nextMonth, 0).getDate();
  const nextDay = Math.min(day, maxDays);

  return `${String(nextDay).padStart(2, "0")}/${String(nextMonth).padStart(2, "0")}/${nextYear}`;
};

/** Tính số ngày còn lại đến hạn hoặc số ngày quá hạn */
export const getDueStatusInfo = (dueDateStr: string): { label: string; isOverdue: boolean; days: number } => {
  if (!dueDateStr || dueDateStr === "--") {
    return { label: "Chưa xác định", isOverdue: false, days: 0 };
  }

  const parts = dueDateStr.trim().split("/");
  if (parts.length !== 3) return { label: dueDateStr, isOverdue: false, days: 0 };

  const due = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: `Quá hạn ${Math.abs(diffDays)} ngày`, isOverdue: true, days: diffDays };
  } else if (diffDays === 0) {
    return { label: "Đến hạn hôm nay", isOverdue: false, days: 0 };
  } else {
    return { label: `Còn ${diffDays} ngày`, isOverdue: false, days: diffDays };
  }
};

/** Tạo link mã VietQR động theo chuẩn Napas 247 */
export const buildVietQrUrl = (room: Room, settings: Settings): string => {
  const total = Math.round(roomTotal(room, settings));
  const info = encodeURIComponent(`THANHTOAN ${room.id}`);
  return `https://img.vietqr.io/image/${settings.bankCode}-${settings.accountNumber}-compact2.png?amount=${total}&addInfo=${info}`;
};

/** Tạo đường dẫn mở chat Zalo trực tiếp với khách */
export const buildZaloChatUrl = (phone: string): string => {
  const clean = phone.replace(/[^\d]/g, "");
  return `https://zalo.me/${clean}`;
};

/** Tự động tải file ảnh mã QR thanh toán của phòng */
export const downloadQrCodeImage = async (room: Room, settings: Settings) => {
  const qrUrl = buildVietQrUrl(room, settings);
  try {
    const res = await fetch(qrUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `VietQR-${room.id}-${settings.bankCode}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    window.open(qrUrl, "_blank");
  }
};

/** TỰ ĐỘNG SOẠN TIN NHẮN THU TIỀN KÈM MÃ QR CHO ZALO NGƯỜI THUÊ */
export const buildReminderMessage = (room: Room, settings: Settings): string => {
  const total = roomTotal(room, settings);
  const qrUrl = buildVietQrUrl(room, settings);
  const kwh = Math.max(0, room.electricNew - room.electricOld);
  const elecFee = electricityAmount(room, settings.electricUnitPrice);

  const cycleText = room.startDate
    ? `Kỳ tính tiền 1 tháng: Từ ${room.startDate} đến ${room.dueDate}`
    : `Hạn thanh toán: ${room.dueDate}`;

  const zaloGreeting = room.zaloName
    ? `Chào bạn ${room.tenant} (${room.zaloName})`
    : `Chào bạn ${room.tenant}`;

  return [
    `🔔 THÔNG BÁO TIỀN PHÒNG ${room.id} - AN GIA SMART HOME`,
    `${zaloGreeting}, Ban quản lý gửi bạn bảng kê chi phí tháng này:`,
    `🗓 ${cycleText}`,
    `----------------------------------------`,
    `1. Tiền phòng: ${formatVND(room.roomFee)}`,
    `2. Tiền điện: ${formatVND(elecFee)} (Cũ: ${formatNumber(room.electricOld)} ➔ Mới: ${formatNumber(room.electricNew)} | Dùng: ${formatNumber(kwh)} kWh × ${formatNumber(settings.electricUnitPrice)}đ)`,
    `3. Tiền nước: ${formatVND(room.waterFee)}`,
    `4. Internet: ${formatVND(room.internetFee)}`,
    `----------------------------------------`,
    `👉 TỔNG CỘNG: ${formatVND(total)}`,
    `⏰ Hạn thanh toán: ${room.dueDate}`,
    ``,
    `💳 THÔNG TIN CHUYỂN KHOẢN:`,
    `- Ngân hàng: ${settings.bankName}`,
    `- Số tài khoản: ${settings.accountNumber}`,
    `- Chủ tài khoản: ${settings.accountName}`,
    `- Cú pháp CK: THANHTOAN ${room.id}`,
    ``,
    `📲 MÃ VIETQR THANH TOÁN TỰ ĐỘNG (Bấm link để mở/lưu QR):`,
    `${qrUrl}`,
    `(Mở link trên bằng Zalo để quét mã VietQR tự động điền đúng số tiền và nội dung CK)`,
    room.zaloNote ? `📌 Ghi chú: ${room.zaloNote}` : "",
    ``,
    `Xin cảm ơn bạn! Chúc bạn một ngày tốt lành.`,
  ]
    .filter(Boolean)
    .join("\n");
};
