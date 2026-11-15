import * as XLSX from "xlsx";
import { SAMPLE_HEADERS } from "../data/mockData";
import type { Room, RoomStatus, Settings } from "../types";
import { electricityAmount, formatVND, roomTotal, STATUS_META } from "./format";

export interface ImportResult {
  rooms: Room[];
  updated: number;
  unknown: string[];
  fileName: string;
}

const normalizeRoomId = (raw: unknown): string => {
  const s = String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (/^\d{3}$/.test(s)) return `P${s}`;
  return s;
};

/** Chuyển "3.000.000", "3,000,000", "3000000 ₫" → 3000000 */
const toNumber = (raw: unknown): number => {
  if (typeof raw === "number") return raw;
  const digits = String(raw ?? "").replace(/[^\d-]/g, "");
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
};

const pick = (row: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) {
    const found = Object.keys(row).find(
      (h) => h.trim().toLowerCase() === k.toLowerCase()
    );
    if (found !== undefined) return row[found];
  }
  return undefined;
};

/** Phân tích chuỗi trạng thái từ Excel thành RoomStatus */
const parseStatus = (raw: unknown, hasTenant: boolean): { status: RoomStatus; invoiceIssued: boolean } => {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "PAID" || s.includes("ĐÃ ĐÓNG") || s.includes("DA DONG") || s.includes("ĐÃ THANH TOÁN")) {
    return { status: "PAID", invoiceIssued: true };
  }
  if (s === "OVERDUE" || s.includes("QUÁ HẠN") || s.includes("QUA HAN") || s.includes("NỢ")) {
    return { status: "OVERDUE", invoiceIssued: false };
  }
  if (s === "EMPTY" || s.includes("TRỐNG") || s.includes("TRONG")) {
    return { status: "EMPTY", invoiceIssued: false };
  }
  if (s === "PENDING" || s.includes("CHỜ ĐÓNG") || s.includes("CHO DONG") || s.includes("CHƯA ĐÓNG") || s.includes("CHUA DONG")) {
    return { status: "PENDING", invoiceIssued: false };
  }
  // Mặc định dựa vào việc có khách hay không
  return hasTenant
    ? { status: "PENDING", invoiceIssued: false }
    : { status: "EMPTY", invoiceIssued: false };
};

/** Đọc .xlsx / .xls / .csv và cập nhật dữ liệu điện-nước-khách của từng phòng */
export const importRoomsFile = async (
  file: File,
  rooms: Room[]
): Promise<ImportResult> => {
  const workbook = file.name.toLowerCase().endsWith(".csv")
    ? XLSX.read(await file.text(), { type: "string" })
    : XLSX.read(await file.arrayBuffer(), { type: "array" });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  const next = rooms.map((r) => ({ ...r }));
  const unknown: string[] = [];
  let updated = 0;

  for (const row of rows) {
    const id = normalizeRoomId(pick(row, ["Phòng", "Room", "Ma phong"]));
    if (!id) continue;
    const room = next.find((r) => r.id === id);
    if (!room) {
      unknown.push(id);
      continue;
    }

    const tenant = String(pick(row, ["Tên khách", "Tenant", "Khách"]) ?? "").trim();
    const phone = String(pick(row, ["SĐT Zalo", "SDT Zalo", "Phone", "SĐT"]) ?? "").trim();
    const oldMeter = pick(row, ["Điện cũ (kWh)", "Điện cũ", "Old"]);
    const newMeter = pick(row, ["Điện mới (kWh)", "Điện mới", "New"]);
    const statusVal = pick(row, ["Trạng thái", "Trang thai", "Status"]);

    room.tenant = tenant;
    room.phone = phone;
    const roomFee = pick(row, ["Tiền phòng", "Room fee"]);
    if (roomFee !== undefined && roomFee !== "") room.roomFee = toNumber(roomFee);
    if (oldMeter !== undefined && oldMeter !== "") room.electricOld = toNumber(oldMeter);
    if (newMeter !== undefined && newMeter !== "") room.electricNew = toNumber(newMeter);
    const water = pick(row, ["Tiền nước", "Water"]);
    if (water !== undefined && water !== "") room.waterFee = toNumber(water);
    const net = pick(row, ["Internet", "Mạng"]);
    if (net !== undefined && net !== "") room.internetFee = toNumber(net);

    const { status, invoiceIssued } = parseStatus(statusVal, Boolean(tenant));
    room.status = status;
    room.invoiceIssued = invoiceIssued;

    updated += 1;
  }

  return { rooms: next, updated, unknown, fileName: file.name };
};

/** Tạo file Excel mẫu thật (.xlsx) với dữ liệu 12 phòng hiện tại */
export const downloadSampleWorkbook = (rooms: Room[]) => {
  const data: (string | number)[][] = [
    [...SAMPLE_HEADERS],
    ...rooms.map((r) => [
      r.id,
      r.floor,
      r.tenant,
      r.phone,
      r.area,
      r.roomFee,
      r.electricOld,
      r.electricNew,
      r.waterFee,
      r.internetFee,
      STATUS_META[r.status].label,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [
    { wch: 8 }, { wch: 7 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dien-Nuoc-12-Phong");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mau-dien-nuoc-12-phong.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Xuất báo cáo tổng kết doanh thu & công nợ ra file Excel (.xlsx) */
export const exportReportWorkbook = (rooms: Room[], settings: Settings) => {
  const headers = [
    "Mã phòng",
    "Tầng",
    "Khách thuê",
    "SĐT Zalo",
    "Diện tích (m²)",
    "Tiền phòng (đ)",
    "Điện cũ (kWh)",
    "Điện mới (kWh)",
    "Điện tiêu thụ (kWh)",
    "Tiền điện (đ)",
    "Tiền nước (đ)",
    "Internet (đ)",
    "Tổng phải thu (đ)",
    "Trạng thái",
    "Hóa đơn ĐT",
    "Hạn thanh toán",
  ];

  let totalRoomFee = 0;
  let totalElecFee = 0;
  let totalWaterFee = 0;
  let totalNetFee = 0;
  let totalAmount = 0;
  let totalCollected = 0;
  let totalDebt = 0;

  const rows: (string | number)[][] = rooms.map((r) => {
    const kwh = Math.max(0, r.electricNew - r.electricOld);
    const elecFee = electricityAmount(r, settings.electricUnitPrice);
    const total = roomTotal(r, settings);

    if (r.status !== "EMPTY") {
      totalRoomFee += r.roomFee;
      totalElecFee += elecFee;
      totalWaterFee += r.waterFee;
      totalNetFee += r.internetFee;
      totalAmount += total;

      if (r.status === "PAID") {
        totalCollected += total;
      } else {
        totalDebt += total;
      }
    }

    return [
      r.id,
      r.floor,
      r.tenant || "--",
      r.phone || "--",
      r.area,
      r.roomFee,
      r.electricOld,
      r.electricNew,
      kwh,
      elecFee,
      r.waterFee,
      r.internetFee,
      total,
      STATUS_META[r.status].label,
      r.invoiceIssued ? "Đã xuất" : "Chưa xuất",
      r.dueDate,
    ];
  });

  // Dòng tổng cộng
  const summaryRow = [
    "TỔNG CỘNG",
    "",
    `Đã thu: ${formatVND(totalCollected)}`,
    `Công nợ: ${formatVND(totalDebt)}`,
    "",
    totalRoomFee,
    "",
    "",
    "",
    totalElecFee,
    totalWaterFee,
    totalNetFee,
    totalAmount,
    "",
    "",
    "",
  ];

  const data = [headers, ...rows, summaryRow];
  const ws = XLSX.utils.aoa_to_sheet(data);

  ws["!cols"] = [
    { wch: 10 }, { wch: 8 }, { wch: 22 }, { wch: 14 }, { wch: 14 },
    { wch: 15 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 14 },
    { wch: 13 }, { wch: 13 }, { wch: 16 }, { wch: 13 }, { wch: 13 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Bao-Cao-Doanh-Thu");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bao-cao-doanh-thu-an-gia-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
