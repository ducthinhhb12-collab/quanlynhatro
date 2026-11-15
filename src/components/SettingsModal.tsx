import { useState, type FormEvent, type ChangeEvent } from "react";
import {
  Landmark,
  X,
  Zap,
  Save,
  RotateCcw,
  MessageCircle,
  Bot,
  ShieldCheck,
  Download,
  Upload,
} from "lucide-react";
import { BANK_OPTIONS } from "../data/mockData";
import type { Settings, Room } from "../types";
import {
  exportUserDataBackup,
  parseUserDataBackup,
  loadSafelyPreservedRooms,
  savePreservedRooms,
} from "../utils/userDataGuard";
import { triggerHaptic } from "../utils/platformBridge";

interface Props {
  settings: Settings;
  onSave: (next: Settings) => void;
  onResetDefault: () => void;
  onClose: () => void;
  onReloadRooms?: (rooms: Room[]) => void;
}

const inputCls =
  "mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";

export default function SettingsModal({
  settings,
  onSave,
  onResetDefault,
  onClose,
  onReloadRooms,
}: Props) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [error, setError] = useState<string | null>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  const handleExportBackup = () => {
    try {
      triggerHaptic("medium");
      const currentRooms = loadSafelyPreservedRooms();
      exportUserDataBackup(currentRooms, draft);
      setBackupMessage("✅ Đã xuất file sao lưu thành công! Hãy lưu file vào nơi an toàn.");
      setTimeout(() => setBackupMessage(null), 4000);
    } catch {
      setError("Không thể xuất file sao lưu.");
    }
  };

  const handleImportBackupFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || "");
        const result = parseUserDataBackup(text);
        if (result && Array.isArray(result.rooms)) {
          triggerHaptic("success");
          savePreservedRooms(result.rooms);
          setDraft(result.settings);
          onSave(result.settings);
          onReloadRooms?.(result.rooms);
          setBackupMessage(`✅ Đã khôi phục thành công ${result.rooms.length} phòng từ file sao lưu!`);
          setTimeout(() => setBackupMessage(null), 5000);
        } else {
          setError("File sao lưu không đúng định dạng An Gia Smart Home 3D.");
        }
      } catch {
        setError("Lỗi khi đọc file sao lưu.");
      }
    };
    reader.readAsText(file);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6,20}$/.test(draft.accountNumber.trim())) {
      setError("Số tài khoản chỉ gồm 6–20 chữ số.");
      return;
    }
    if (!(draft.electricUnitPrice > 0)) {
      setError("Đơn giá điện phải lớn hơn 0.");
      return;
    }
    onSave({
      ...draft,
      accountNumber: draft.accountNumber.trim(),
      accountName: draft.accountName.trim().toUpperCase(),
    });
  };

  const handleReset = () => {
    if (window.confirm("Bạn có chắc chắn muốn khôi phục lại dữ liệu mẫu 12 phòng và cài đặt ban đầu không?")) {
      onResetDefault();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl max-h-[90dvh] overflow-hidden flex flex-col pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-6"
        role="dialog"
        aria-modal="true"
        aria-label="Cài đặt hệ thống"
      >
        {/* Mobile Drag Handle */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-3 shrink-0" />

        <div className="mb-4 sm:mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Cài đặt Hệ thống & Tự động Zalo</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Cấu hình ngân hàng VietQR và chế độ AI Agent tự động gửi tin nhắn Zalo.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:scale-95 transition-all"
          >
            <X className="w-5 h-5 shrink-0" />
          </button>
        </div>

        <div className="thin-scroll max-h-[60dvh] overflow-y-auto space-y-4 pr-1">
          {/* Ngân hàng VietQR */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <Landmark className="w-3.5 h-3.5 shrink-0" />
              Tài khoản nhận tiền (VietQR)
            </p>

            <div>
              <label className="text-xs font-semibold text-slate-700">Ngân hàng</label>
              <select
                value={draft.bankCode}
                onChange={(e) => {
                  const opt = BANK_OPTIONS.find((b) => b.code === e.target.value);
                  if (opt) setDraft({ ...draft, bankCode: opt.code, bankName: opt.name });
                }}
                className={inputCls}
              >
                {BANK_OPTIONS.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-700">Số tài khoản</label>
                <input
                  value={draft.accountNumber}
                  onChange={(e) => setDraft({ ...draft, accountNumber: e.target.value })}
                  inputMode="numeric"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Chủ tài khoản</label>
                <input
                  value={draft.accountName}
                  onChange={(e) => setDraft({ ...draft, accountName: e.target.value })}
                  className={`${inputCls} uppercase`}
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                <Zap className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                Đơn giá điện (VNĐ / kWh)
              </label>
              <input
                type="number"
                min={1}
                value={draft.electricUnitPrice}
                onChange={(e) =>
                  setDraft({ ...draft, electricUnitPrice: Number(e.target.value) })
                }
                className={inputCls}
              />
            </div>
          </div>

          {/* Cấu hình Tự động gửi Zalo & Rảnh tay 100% */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                Tự động gửi Zalo & Agent CSKH
              </p>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={draft.zaloAutoSend}
                  onChange={(e) => setDraft({ ...draft, zaloAutoSend: e.target.checked })}
                  className="peer sr-only"
                />
                <div className="peer h-5 w-9 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full"></div>
              </label>
            </div>

            {/* Toggle Chế độ Rảnh tay 100% */}
            <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50/70 p-2.5">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 shrink-0 text-rose-600" />
                <div>
                  <p className="text-xs font-bold text-rose-900">
                    Chế độ Rảnh tay 100% (Hands-Free)
                  </p>
                  <p className="text-[11px] text-rose-700">
                    Robot tự tạo hóa đơn Excel, ảnh phiếu thu và tự gửi Zalo (con người 0 click)
                  </p>
                </div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center shrink-0 ml-2">
                <input
                  type="checkbox"
                  checked={draft.handsFreeMode ?? true}
                  onChange={(e) => setDraft({ ...draft, handsFreeMode: e.target.checked })}
                  className="peer sr-only"
                />
                <div className="peer h-5 w-9 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-rose-600 peer-checked:after:translate-x-full"></div>
              </label>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Cơ chế gửi tin Zalo</label>
              <select
                value={draft.zaloMethod}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    zaloMethod: e.target.value as "simulated" | "webhook" | "zalo_oa",
                  })
                }
                className={inputCls}
              >
                <option value="simulated">
                  🤖 Agent Tự động điều phối ngầm (Zalo Autonomous Bot)
                </option>
                <option value="webhook">
                  ⚡ Webhook API Zalo / Server Backend Tự Động
                </option>
                <option value="zalo_oa">
                  🏢 Zalo Official Account (ZNS) Doanh Nghiệp
                </option>
              </select>
            </div>

            {draft.zaloMethod === "webhook" && (
              <div>
                <label className="text-xs font-semibold text-slate-700">Webhook Endpoint URL</label>
                <input
                  type="url"
                  placeholder="https://your-api.com/send-zalo"
                  value={draft.zaloWebhookUrl || ""}
                  onChange={(e) => setDraft({ ...draft, zaloWebhookUrl: e.target.value })}
                  className={inputCls}
                />
              </div>
            )}

            {(draft.zaloMethod === "zalo_oa" || draft.zaloMethod === "webhook") && (
              <div>
                <label className="text-xs font-semibold text-slate-700">Zalo Access Token / API Key</label>
                <input
                  type="password"
                  placeholder="Bearer token hoặc ZNS key..."
                  value={draft.zaloAccessToken || ""}
                  onChange={(e) => setDraft({ ...draft, zaloAccessToken: e.target.value })}
                  className={inputCls}
                />
              </div>
            )}

            <div className="rounded-xl bg-white p-3 text-[11px] text-slate-600 border border-blue-100 flex items-start gap-2">
              <Bot className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
              <span>
                Khi bật tính năng này, <strong>Agent CSKH Zalo</strong> sẽ tự động quét các phòng đến kỳ tính tiền 1 tháng hoặc quá hạn để tự gửi thông báo mà không cần bấm thủ công từng phòng.
              </span>
            </div>
          </div>

          {/* Bảo Vệ & Sao Lưu Dữ Liệu Người Dùng */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                Bảo vệ & Sao lưu thông tin người dùng
              </p>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                100% An Toàn
              </span>
            </div>

            <p className="text-xs text-slate-600">
              Mọi đợt cập nhật tính năng mới từ GitHub sẽ <strong>tự động giữ nguyên 100% dữ liệu phòng và khách thuê</strong> trên thiết bị. Bạn cũng có thể chủ động tải file sao lưu để chuyển máy.
            </p>

            {backupMessage && (
              <p className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800 animate-in fade-in">
                {backupMessage}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleExportBackup}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-50 active:scale-95 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                Xuất file sao lưu (.json)
              </button>

              <label className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 cursor-pointer active:scale-95 transition-all">
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Nhập bản sao lưu</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportBackupFile}
                />
              </label>
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
            {error}
          </p>
        )}

        <div className="mt-4 sm:mt-5 flex items-center justify-between border-t border-slate-100 pt-3 sm:pt-4">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100 active:scale-95"
            title="Xóa dữ liệu lưu trữ và đưa về 12 phòng mặc định"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Khôi phục</span> mặc định
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 active:scale-95"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs active:scale-95"
            >
              <Save className="w-4 h-4 shrink-0" />
              Lưu
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
