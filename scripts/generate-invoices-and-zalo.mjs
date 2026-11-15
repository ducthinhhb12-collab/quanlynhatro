import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

const outputDir = path.resolve(process.cwd(), "invoices-zalo");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Cấu hình ngân hàng & giá điện
const settings = {
  bankCode: "MB",
  bankName: "MB Bank (Quân Đội)",
  accountNumber: "0901234567",
  accountName: "NGUYEN VAN QUAN",
  electricUnitPrice: 3500,
};

// Danh sách các phòng nợ cần Agent lập hóa đơn và gửi tin nhắn Zalo
const unpaidRooms = [
  {
    id: "P102",
    floor: 1,
    tenant: "Trần Thị Bích",
    phone: "0912345602",
    roomFee: 3000000,
    electricOld: 980,
    electricNew: 1061,
    waterFee: 110000,
    internetFee: 100000,
    status: "PENDING",
    dueDate: "05/05/2026",
    startDate: "05/04/2026",
    zaloName: "Bích Trần",
  },
  {
    id: "P103",
    floor: 1,
    tenant: "Lê Hoàng Long",
    phone: "0912345603",
    roomFee: 3200000,
    electricOld: 1502,
    electricNew: 1590,
    waterFee: 120000,
    internetFee: 100000,
    status: "OVERDUE",
    dueDate: "28/04/2026",
    startDate: "28/03/2026",
    zaloName: "Long Lê Designer",
  },
  {
    id: "P203",
    floor: 2,
    tenant: "Đặng Quốc Bảo",
    phone: "0912345606",
    roomFee: 3500000,
    electricOld: 1320,
    electricNew: 1402,
    waterFee: 100000,
    internetFee: 100000,
    status: "PENDING",
    dueDate: "05/05/2026",
    startDate: "05/04/2026",
    zaloName: "Bảo Đặng Media",
  },
  {
    id: "P204",
    floor: 2,
    tenant: "Hoàng Thu Trang",
    phone: "0912345607",
    roomFee: 3800000,
    electricOld: 2440,
    electricNew: 2531,
    waterFee: 140000,
    internetFee: 100000,
    status: "OVERDUE",
    dueDate: "28/04/2026",
    startDate: "28/03/2026",
    zaloName: "Trang Hoàng",
  },
  {
    id: "P301",
    floor: 3,
    tenant: "Bùi Đức Mạnh",
    phone: "0912345608",
    roomFee: 3800000,
    electricOld: 630,
    electricNew: 712,
    waterFee: 120000,
    internetFee: 100000,
    status: "PENDING",
    dueDate: "05/05/2026",
    startDate: "05/04/2026",
    zaloName: "Mạnh Bùi Freelancer",
  },
  {
    id: "P304",
    floor: 3,
    tenant: "Ngô Gia Huy",
    phone: "0912345611",
    roomFee: 4200000,
    electricOld: 2215,
    electricNew: 2320,
    waterFee: 150000,
    internetFee: 100000,
    status: "OVERDUE",
    dueDate: "28/04/2026",
    startDate: "28/03/2026",
    zaloName: "Huy Ngô",
  },
];

const formatVND = (num) => new Intl.NumberFormat("vi-VN").format(num) + " ₫";
const formatNumber = (num) => new Intl.NumberFormat("vi-VN").format(num);

const buildVietQrUrl = (room, settings) => {
  const kwh = Math.max(0, room.electricNew - room.electricOld);
  const elecFee = kwh * settings.electricUnitPrice;
  const total = Math.round(room.roomFee + elecFee + room.waterFee + room.internetFee);
  const info = encodeURIComponent(`THANHTOAN ${room.id}`);
  return `https://img.vietqr.io/image/${settings.bankCode}-${settings.accountNumber}-compact2.png?amount=${total}&addInfo=${info}`;
};

const buildZaloMessage = (room, settings) => {
  const kwh = Math.max(0, room.electricNew - room.electricOld);
  const elecFee = kwh * settings.electricUnitPrice;
  const total = room.roomFee + elecFee + room.waterFee + room.internetFee;
  const qrUrl = buildVietQrUrl(room, settings);
  const cleanPhone = room.phone.replace(/[^\d]/g, "");

  return [
    `🔔 THÔNG BÁO TIỀN PHÒNG ${room.id} - AN GIA SMART HOME`,
    `Chào bạn ${room.tenant}${room.zaloName ? ` (${room.zaloName})` : ""}, Ban quản lý gửi bạn bảng kê chi phí tháng này:`,
    `🗓 Kỳ tính tiền 1 tháng: Từ ${room.startDate} đến ${room.dueDate}`,
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
    ``,
    `🔗 Mở chat Zalo trực tiếp: https://zalo.me/${cleanPhone}`,
    `Xin cảm ơn bạn! Chúc bạn một ngày tốt lành.`,
  ].join("\n");
};

// Tạo file Excel cho từng phòng
console.log("==================================================================");
console.log("🤖 AI AGENT: BẮT ĐẦU TỰ ĐỘNG TẠO BẢN EXCEL & SOẠN TIN NHẮN ZALO");
console.log("==================================================================");

let allMessages = [];

for (const room of unpaidRooms) {
  const kwh = Math.max(0, room.electricNew - room.electricOld);
  const elecFee = kwh * settings.electricUnitPrice;
  const total = room.roomFee + elecFee + room.waterFee + room.internetFee;
  const qrUrl = buildVietQrUrl(room, settings);

  // Dữ liệu bảng tính Excel
  const excelData = [
    ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
    ["Độc lập - Tự do - Hạnh phúc"],
    [""],
    ["HÓA ĐƠN TIỀN PHÒNG & DỊCH VỤ THÁNG"],
    [`Mã hóa đơn: HD-${room.id}-0526`],
    [""],
    ["THÔNG TIN KHÁCH HÀNG & PHÒNG THUÊ"],
    ["Mã phòng:", room.id, "Tầng:", room.floor],
    ["Khách thuê:", room.tenant, "SĐT Zalo:", room.phone],
    ["Kỳ 1 tháng:", `Từ ${room.startDate} đến ${room.dueDate}`],
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
    ["Cú pháp chuyển khoản:", `THANHTOAN ${room.id}`],
    ["Link ảnh mã QR thanh toán nhanh:", qrUrl],
    [""],
    ["Ban Quản Lý An Gia Smart Home xin cảm ơn Quý khách!"],
  ];

  const ws = XLSX.utils.aoa_to_sheet(excelData);
  ws["!cols"] = [{ wch: 6 }, { wch: 28 }, { wch: 25 }, { wch: 30 }, { wch: 22 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Hoa-Don-${room.id}`);

  const excelFilePath = path.join(outputDir, `Hoa-Don-Phong-${room.id}.xlsx`);
  XLSX.writeFile(wb, excelFilePath);

  // Soạn tin nhắn Zalo
  const message = buildZaloMessage(room, settings);
  allMessages.push(
    `==================== PHÒNG ${room.id} (${room.tenant} - ${room.phone}) ====================\n` +
    `File Excel đính kèm: ${excelFilePath}\n\n` +
    message + "\n\n"
  );

  console.log(`✅ [DOCUMENT_GEN] Đã tạo file Excel: Hoa-Don-Phong-${room.id}.xlsx (${formatVND(total)})`);
  console.log(`📲 [AUTO_COLLECTOR] Đã soạn tin nhắn Zalo kèm VietQR cho khách: ${room.tenant} (${room.phone})`);
}

// Lưu toàn bộ tin nhắn Zalo vào file text
const allMessagesPath = path.join(outputDir, "DANH-SACH-TIN-NHAN-ZALO-GUI-KHACH.txt");
fs.writeFileSync(allMessagesPath, allMessages.join("\n"), "utf-8");

console.log("==================================================================");
console.log(`🎉 HOÀN THÀNH: Đã tạo 6 file Excel & toàn bộ nội dung tin nhắn Zalo tại:`);
console.log(`📁 Thư mục: ${outputDir}`);
console.log(`📄 File tổng hợp tin nhắn: ${allMessagesPath}`);
console.log("==================================================================");

