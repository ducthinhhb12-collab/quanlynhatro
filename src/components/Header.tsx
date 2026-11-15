import {
  Building2,
  Download,
  Settings as SettingsIcon,
  BellRing,
  FileSpreadsheet,
  MessageSquareWarning,
  Plus,
  Bot,
  Send,
  Users,
  Smartphone,
} from "lucide-react";
import UploadBox from "./UploadBox";

interface Props {
  unpaidCount: number;
  tenantCount?: number;
  onUpload: (file: File) => void;
  onDownloadSample: () => void;
  onExportReport: () => void;
  onOpenBatchReminder: () => void;
  onOpenAddRoom: () => void;
  onOpenCustomerManager?: () => void;
  onOpenAgentCompany: () => void;
  onAutoSendAllZalo: () => void;
  onSimulatePayment: () => void;
  onOpenSettings: () => void;
  onOpenMobileApp?: () => void;
}

export default function Header({
  unpaidCount,
  tenantCount = 0,
  onUpload,
  onDownloadSample,
  onExportReport,
  onOpenBatchReminder,
  onOpenAddRoom,
  onOpenCustomerManager,
  onOpenAgentCompany,
  onAutoSendAllZalo,
  onSimulatePayment,
  onOpenSettings,
  onOpenMobileApp,
}: Props) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-[calc(60px+env(safe-area-inset-top,0px))] md:h-[72px] items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 md:px-5 shadow-xs pt-[env(safe-area-inset-top,0px)]">
      {/* Left: logo + title */}
      <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
        <div className="flex h-9 w-9 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 shadow-sm shadow-emerald-200">
          <Building2 className="w-4 h-4 md:w-5 md:h-5 shrink-0 text-white" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 md:gap-2">
            <h1 className="truncate text-sm md:text-[15px] font-black tracking-tight text-slate-900">
              An Gia Smart Home 3D
            </h1>
            <span className="shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] md:text-[10px] font-bold tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              PRO
            </span>
          </div>
          <p className="hidden md:block truncate text-xs text-slate-500">
            Hệ thống 6 AI Agent điều hành tự động • Lập HĐ, Thu nợ 100% rảnh tay & Zalo 24/7
          </p>
        </div>
      </div>

      {/* Center: upload + mẫu + xuất báo cáo (Desktop only) */}
      <div className="hidden lg:flex flex-1 items-center justify-center gap-1.5">
        <UploadBox onFile={onUpload} />
        <button
          type="button"
          onClick={onDownloadSample}
          title="Tải file Excel mẫu phòng"
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          <Download className="w-4 h-4 shrink-0 text-slate-500" />
          <span>Mẫu Excel</span>
        </button>

        <button
          type="button"
          onClick={onExportReport}
          title="Xuất bảng Excel tổng kết doanh thu và công nợ"
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/60 px-2.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
        >
          <FileSpreadsheet className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>Báo cáo</span>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
        {/* Nút Agent Tự Động Gửi Zalo Cho Khách Nợ */}
        <button
          type="button"
          onClick={onAutoSendAllZalo}
          className="inline-flex h-8.5 md:h-10 items-center gap-1.5 md:gap-2 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 px-2.5 md:px-3.5 text-xs font-bold text-white shadow-sm shadow-rose-200 transition-all hover:opacity-95 active:scale-[0.98]"
          title="Cho Agent tự động gửi tin nhắn thu tiền kèm mã VietQR tới toàn bộ khách thuê đang nợ"
        >
          <Send className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 text-white" />
          <span className="hidden sm:inline">Agent Gửi Zalo</span>
          <span className="sm:hidden">Zalo</span>
          {unpaidCount > 0 && (
            <span className="inline-flex h-4.5 min-w-4.5 md:h-5 md:min-w-5 items-center justify-center rounded-full bg-white/25 px-1 text-[10px] md:text-[11px] font-black text-white">
              {unpaidCount}
            </span>
          )}
        </button>

        {/* Nút Công ty AI Agent Điều hành (Desktop/Tablet) */}
        <button
          type="button"
          onClick={onOpenAgentCompany}
          className="hidden sm:inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-600 px-3 text-xs font-bold text-white shadow-sm shadow-indigo-200 transition-all hover:opacity-95 active:scale-[0.98]"
          title="Mở bảng điều khiển 6 AI Agents tự động điều hành tòa nhà"
        >
          <Bot className="w-4 h-4 shrink-0 text-indigo-200" />
          <span>Công ty Agent</span>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
          </span>
        </button>

        {/* Nút Thêm phòng (Desktop) */}
        <button
          type="button"
          onClick={onOpenAddRoom}
          className="hidden md:inline-flex h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-[0.98]"
          title="Thêm phòng mới và gán khách thuê"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>Thêm phòng</span>
        </button>

        {/* Nút Quản lý Khách thuê (Desktop) */}
        {onOpenCustomerManager && (
          <button
            type="button"
            onClick={onOpenCustomerManager}
            className="hidden md:inline-flex h-10 items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 text-xs font-bold text-indigo-800 transition-colors hover:bg-indigo-100 active:scale-[0.98]"
            title="Quản lý danh sách khách thuê, thêm khách mới hoặc xóa khách trả phòng"
          >
            <Users className="w-4 h-4 shrink-0 text-indigo-600" />
            <span>Khách thuê</span>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-200/80 px-1 text-[11px] font-black text-indigo-900">
              {tenantCount}
            </span>
          </button>
        )}

        {/* Nút Nhắc nợ Zalo (Desktop) */}
        <button
          type="button"
          onClick={onOpenBatchReminder}
          className="hidden lg:inline-flex h-10 items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-100 active:scale-[0.98]"
          title="Mở danh sách và sao chép tin nhắc nợ hàng loạt"
        >
          <MessageSquareWarning className="w-4 h-4 shrink-0 text-amber-600" />
          <span>Nhắc nợ Zalo</span>
        </button>

        {/* Nút Ting ting (hiện trên cả Mobile & Desktop) */}
        <button
          type="button"
          onClick={onSimulatePayment}
          className="inline-flex h-8.5 md:h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-2.5 md:px-3 text-xs font-bold text-white shadow-sm shadow-emerald-200 transition-colors hover:bg-emerald-700 active:scale-[0.98]"
          title="Giả lập nhận tiền chuyển khoản VietQR"
        >
          <BellRing className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
          <span className="hidden sm:inline">Ting ting</span>
        </button>

        {/* Nút Tải App Điện Thoại */}
        {onOpenMobileApp && (
          <button
            type="button"
            onClick={onOpenMobileApp}
            className="inline-flex h-8.5 md:h-10 items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50/90 px-2.5 md:px-3.5 text-xs font-bold text-emerald-800 shadow-2xs transition-all hover:bg-emerald-100 active:scale-[0.98]"
            title="Lấy mã QR & link tải trực tiếp file .apk cho Android hoặc .ipa cho iOS để chạy độc lập"
          >
            <Smartphone className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 text-emerald-600" />
            <span className="hidden sm:inline">Tải App Điện Thoại</span>
            <span className="sm:hidden">Tải App</span>
          </button>
        )}

        {/* Nút Cài đặt (Desktop) */}
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Cài đặt"
          className="hidden md:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <SettingsIcon className="w-5 h-5 shrink-0" />
        </button>
      </div>
    </header>
  );
}
