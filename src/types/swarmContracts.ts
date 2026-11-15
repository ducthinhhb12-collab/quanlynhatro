/**
 * HỢP ĐỒNG KIỂU DỮ LIỆU ĐA TÁC NHÂN (SWARM ARCHITECT CONTRACTS)
 * An Gia Smart Home 3D - Multi-Platform Cross-Device Architecture
 */

/* 1. XÁC THỰC & PHIÊN ZALO CHỦ NHÀ (WORKER 2) */
export type ZaloAuthMode = "desktop_rpa" | "webhook_api" | "profile_verified";

export interface ZaloHostSession {
  isConnected: boolean;
  authMode: ZaloAuthMode;
  hostName: string; // Tên hiển thị chủ nhà (VD: "Lê Văn An - Chủ Nhà")
  hostPhone: string; // SĐT Zalo chính chủ (VD: "0901234567")
  avatarUrl?: string; // Link hoặc Base64 avatar chủ nhà
  webhookUrl?: string; // Webhook API gửi tin tự động
  oaAccessToken?: string; // Token Zalo OA nếu có
  oaRefreshToken?: string;
  lastConnectedAt?: string; // Thời gian đăng nhập phiên
  sessionToken?: string; // Token phiên làm việc mã hóa
}

/* 2. GÓI DỮ LIỆU HÓA ĐƠN ĐA PHƯƠNG TIỆN 4-TRONG-1 (WORKER 3) */
export interface InvoiceBundle4In1 {
  roomId: string;
  tenantName: string;
  phone: string;
  totalAmount: number;
  totalAmountWords: string;
  dueDate: string;
  billingPeriod: string;
  
  // 4 Thành phần chính bắt buộc
  textMessage: string;         // Thành phần 1: Tin nhắn văn bản chuẩn hóa
  vietQrDataUrl: string;       // Thành phần 2: Ảnh mã VietQR động (.png Base64)
  receiptPngDataUrl: string;   // Thành phần 3: Ảnh Phiếu Thu 2x Retina (.png Base64)
  excelWorkbook: any;          // Thành phần 4: Bảng tính Excel Workbook
  excelFileName: string;       // Tên file Excel (.xlsx)
}

export interface DispatchResult4In1 {
  success: boolean;
  message: string;
  timestamp: string;
  copiedText: boolean;
  sharedFiles?: string[];
  detail?: string;
}

/* 3. QUẢN TRỊ BẢO MẬT & ĐIỀU KHIỂN AGENT (WORKER 4) */
export interface AdminSettings {
  adminPinHash: string; // SHA-256 hash của mã PIN 4 số (mặc định "1234")
  autopilotEnabled: boolean; // Master Switch bật/tắt toàn bộ Agent
  autoAuditDay: number; // Ngày chốt số điện nước tự động (1 - 31)
  autoRunHour: number; // Giờ chạy tự động hàng ngày (0 - 23)
  autoDispatchBundle4In1: boolean; // Gửi trọn gói 4-trong-1
  strictAdminMode: boolean; // Ẩn hoàn toàn nút điều khiển với người dùng thường
}

/* 4. NHẬT KÝ HOẠT ĐỘNG AGENT (AGENT LOG ENTRY) */
export interface AgentLogEntry {
  id: string;
  role: string;
  agentName: string;
  message: string;
  timestamp: string;
  level: "info" | "success" | "warning" | "action";
  roomId?: string;
  bundleAttached?: boolean;
}
