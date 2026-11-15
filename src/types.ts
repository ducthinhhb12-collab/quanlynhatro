export type RoomStatus = "PAID" | "PENDING" | "OVERDUE" | "EMPTY";

export interface Room {
  id: string; // "P101" ... "P304" ...
  floor: 1 | 2 | 3 | number;
  col: number; // vị trí trên sàn tầng
  area: number; // m²
  tenant: string;
  phone: string;
  roomFee: number; // VNĐ / tháng
  electricOld: number; // kWh (chỉ số cũ)
  electricNew: number; // kWh (chỉ số mới)
  waterFee: number; // VNĐ
  internetFee: number; // VNĐ
  status: RoomStatus;
  invoiceIssued: boolean; // Hóa đơn điện tử đã xuất
  dueDate: string; // dd/mm/yyyy - Hạn thanh toán
  startDate?: string; // dd/mm/yyyy - Ngày bắt đầu chu kỳ 1 tháng
  zaloName?: string; // Tên hiển thị Zalo / Biệt danh
  zaloNote?: string; // Ghi chú thông tin Zalo khác (CCCD, công việc, v.v.)
  idCard?: string; // Số CCCD / CMND
  lastZaloSentAt?: string; // Thời gian tin nhắn Zalo gửi gần nhất
  zaloSendStatus?: "NOT_SENT" | "SENDING" | "SENT" | "FAILED";
  reminderCount?: number; // Số lần Agent tự động gửi tin nhắn thu tiền
  lastAutoSentAt?: string; // Thời gian Agent tự động gửi thu tiền gần nhất
  hasExcelInvoice?: boolean; // Đã tạo file Excel hóa đơn riêng
  hasImageInvoice?: boolean; // Đã chụp ảnh phiếu thu hóa đơn
  meterPhotoUrl?: string; // URL hoặc Base64 ảnh chụp công tơ điện
  electricMeterReadDate?: string; // Ngày giờ chụp / đọc công tơ
  handwrittenBillUrl?: string; // Ảnh hóa đơn viết tay đã kết xuất
}

export interface BankOption {
  code: string; // mã VietQR (bin/short code)
  name: string;
}

export interface Settings {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  electricUnitPrice: number; // VNĐ / kWh
  zaloAutoSend: boolean; // Tự động gửi tin nhắn Zalo khi đến hạn
  zaloMethod: "simulated" | "webhook" | "zalo_oa";
  zaloWebhookUrl?: string; // Webhook gửi tin tự động
  zaloAccessToken?: string; // Token Zalo OA/ZNS
  handsFreeMode?: boolean; // Chế độ Rảnh tay 100%: Agent tự động chạy toàn bộ không cần người bấm
  customQrImage?: string; // Ảnh mã QR tùy chỉnh (Zalo Pay / VietQR riêng của chủ nhà)
  adminPin?: string; // Mã PIN Admin (mặc định '8888')
}

export interface ToastState {
  id: number;
  message: string;
  tone: "success" | "info" | "error";
}

/* ---------- CÔNG TY AGENT ĐIỀU HÀNH TÒA NHÀ ---------- */
export type AgentRole =
  | "DOCUMENT_GEN" // Agent Tạo Bản Excel Hóa Đơn & Chụp Ảnh Phiếu Thu
  | "AUTO_COLLECTOR" // Agent Tự Động Thu Tiền & Gửi Zalo 100% Rảnh Tay
  | "ACCOUNTING" // Agent Kế Toán & Đối Soát Điện Nước
  | "ZALO_CSKH" // Agent CSKH & Điều Phối Zalo
  | "TREASURY" // Agent Ngân Quỹ & VietQR
  | "FACILITY_3D"; // Agent Quản Lý Mặt Bằng & 3D

export interface AgentInfo {
  role: AgentRole;
  name: string;
  title: string;
  department: string;
  status: "IDLE" | "WORKING" | "STANDBY";
  currentTask: string;
  tasksCompleted: number;
  avatarColor: string;
}

export interface AgentLog {
  id: string;
  role: AgentRole;
  agentName: string;
  message: string;
  timestamp: string;
  level: "info" | "success" | "warning" | "action";
}

export interface AutoMessageJob {
  id: string;
  roomId: string;
  tenant: string;
  phone: string;
  amount: number;
  dueDate: string;
  status: "QUEUED" | "PROCESSING" | "SENT" | "FAILED";
  excelReady: boolean;
  imageReady: boolean;
  qrReady: boolean;
  timestamp: string;
  detail: string;
}
