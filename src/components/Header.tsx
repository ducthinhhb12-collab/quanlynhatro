import { useState, useRef } from "react";
import {
  Building2,
  Download,
  Settings as SettingsIcon,
  BellRing,
  FileSpreadsheet,
  Plus,
  Users,
  Smartphone,
  Shield,
  MessageCircle,
} from "lucide-react";
import UploadBox from "./UploadBox";
import { triggerHaptic } from "../utils/platformBridge";
import { cn } from "../utils/cn";

interface Props {
  unpaidCount: number;
  tenantCount?: number;
  onUpload: (file: File) => void;
  onDownloadSample: () => void;
  onExportReport: () => void;
  onOpenAddRoom: () => void;
  onOpenCustomerManager?: () => void;
  onSimulatePayment: () => void;
  onOpenSettings: () => void;
  onOpenMobileApp?: () => void;
  onOpenAdmin: () => void;
  onOpenZaloAuth: () => void;
  isZaloConnected?: boolean;
  zaloHostName?: string;
  // Giữ lại các props cũ dưới dạng optional để tương thích ngược
  onOpenBatchReminder?: () => void;
  onOpenAgentCompany?: () => void;
  onAutoSendAllZalo?: () => void;
}

export default function Header({
  unpaidCount: _unpaidCount,
  tenantCount = 0,
  onUpload,
  onDownloadSample,
  onExportReport,
  onOpenAddRoom,
  onOpenCustomerManager,
  onSimulatePayment,
  onOpenSettings,
  onOpenMobileApp,
  onOpenAdmin,
  onOpenZaloAuth,
  isZaloConnected = false,
  zaloHostName = "",
}: Props) {
  // Cử chỉ nhấn giữ 1.5s trên logo để mở stealth Admin Access
  const timerRef = useRef<number | null>(null);
  const [isPressingLogo, setIsPressingLogo] = useState(false);

  const handleLogoPressStart = () => {
    setIsPressingLogo(true);
    timerRef.current = window.setTimeout(() => {
      triggerHaptic("success");
      setIsPressingLogo(false);
      onOpenAdmin();
    }, 1500);
  };

  const handleLogoPressEnd = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPressingLogo(false);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-[calc(60px+env(safe-area-inset-top,0px))] md:h-[72px] items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 md:px-5 shadow-xs pt-[env(safe-area-inset-top,0px)]">
      {/* Left: Logo (nhấn giữ 1.5s mở Admin) + Tiêu đề */}
      <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
        <div
          onMouseDown={handleLogoPressStart}
          onMouseUp={handleLogoPressEnd}
          onMouseLeave={handleLogoPressEnd}
          onTouchStart={handleLogoPressStart}
          onTouchEnd={handleLogoPressEnd}
          onTouchCancel={handleLogoPressEnd}
          title="Nhấn giữ 1.5s để mở Bảng Quản Trị Hệ Thống (Admin Stealth)"
          className={cn(
            "relative flex h-9 w-9 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 shadow-sm shadow-emerald-200 cursor-pointer select-none transition-all",
            isPressingLogo && "scale-95 ring-4 ring-amber-400 bg-emerald-700"
          )}
        >
          <Building2 className="w-4 h-4 md:w-5 md:h-5 shrink-0 text-white" />
          {isPressingLogo && (
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-400 animate-ping" />
          )}
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

      {/* Center: Upload + Mẫu + Xuất báo cáo (Desktop only) */}
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

      {/* Right: Actions Tối giản, không phân tán nút Agent */}
      <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
        {/* Zalo Host Status Badge (Bấm để mở ZaloAuthModal) */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("light");
            onOpenZaloAuth();
          }}
          title={
            isZaloConnected
              ? `Zalo Host: ${zaloHostName || "Đã xác thực"} (Bấm để quản lý phiên)`
              : "Zalo Host: Chưa xác thực (Bấm để kết nối QR / Webhook)"
          }
          className={cn(
            "inline-flex min-h-[44px] md:h-10 items-center gap-1.5 md:gap-2 rounded-xl px-2.5 md:px-3 text-xs font-bold transition-all active:scale-[0.96] border shadow-2xs select-none",
            isZaloConnected
              ? "bg-blue-50/90 border-blue-200 text-blue-700 hover:bg-blue-100"
              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300"
          )}
        >
          <div className="relative flex items-center justify-center">
            <MessageCircle className="w-4 h-4 md:w-4.5 md:h-4.5 text-[#0068FF] shrink-0" />
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-white",
                isZaloConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-400"
              )}
            />
          </div>
          <div className="flex flex-col text-left leading-tight">
            <span className="text-[9px] text-slate-400 font-semibold hidden md:block">
              Zalo Host
            </span>
            <span className="text-xs font-bold truncate max-w-[85px] sm:max-w-[120px]">
              {isZaloConnected ? (zaloHostName || "Đã xác thực") : "Chưa kết nối"}
            </span>
          </div>
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

        {/* Nút Ting ting (hiện trên cả Mobile & Desktop) */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("success");
            onSimulatePayment();
          }}
          className="inline-flex min-h-[44px] md:h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 md:px-3 text-xs font-bold text-white shadow-sm shadow-emerald-200 transition-all hover:bg-emerald-700 active:scale-[0.96] select-none"
          title="Giả lập nhận tiền chuyển khoản VietQR"
        >
          <BellRing className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Ting ting</span>
        </button>

        {/* Nút Tải App Điện Thoại */}
        {onOpenMobileApp && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              onOpenMobileApp();
            }}
            className="inline-flex min-h-[44px] md:h-10 items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50/90 px-3 md:px-3 text-xs font-bold text-emerald-800 shadow-2xs transition-all hover:bg-emerald-100 active:scale-[0.96] select-none"
            title="Lấy mã QR & link tải trực tiếp file .apk cho Android hoặc .ipa cho iOS để chạy độc lập"
          >
            <Smartphone className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="hidden sm:inline">Tải App</span>
          </button>
        )}

        {/* Stealth Admin Access Button (Shield Icon) */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("light");
            onOpenAdmin();
          }}
          title="Quản trị hệ thống & Master Autopilot 24/7 (Bảo vệ bằng PIN)"
          className="flex min-h-[44px] min-w-[44px] md:h-10 md:w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50/60 transition-all shadow-2xs active:scale-[0.96] select-none"
        >
          <Shield className="w-4.5 h-4.5" />
        </button>

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
