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
  Lock,
  Unlock,
  KeyRound,
  Image as ImageIcon,
  CheckCircle2,
  Trash2,
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
const lockedInputCls =
  "mt-1.5 block w-full rounded-xl border border-slate-200 bg-slate-100/80 px-3 py-2 text-xs font-medium text-slate-500 outline-none cursor-not-allowed select-none";

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

  // Cơ chế bảo vệ & Mở khóa Admin cho Ngân hàng và Mã QR
  const [isBankLocked, setIsBankLocked] = useState<boolean>(true);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>("");
  const [pinError, setPinError] = useState<string | null>(null);

  const verifyAdminPin = async (inputPin: string): Promise<boolean> => {
    const trimmed = inputPin.trim();
    if (!trimmed) return false;

    // 1. Kiểm tra với mã PIN trong settings nếu có
    if (settings.adminPin && trimmed === settings.adminPin.trim()) {
      return true;
    }
    // 2. Mặc định mã PIN '8888'
    if (trimmed === "8888") {
      return true;
    }
    // 3. Dự phòng mã PIN '1234'
    if (trimmed === "1234") {
      return true;
    }
    // 4. Kiểm tra với hash lưu trong AdminSettings (nếu có)
    try {
      const saved = localStorage.getItem("an_gia_smart_home_admin_settings_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.adminPinHash && typeof crypto !== "undefined" && crypto.subtle) {
          const data = new TextEncoder().encode(trimmed);
          const hashBuffer = await crypto.subtle.digest("SHA-256", data);
          const hashHex = Array.from(new Uint8Array(hashBuffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          if (hashHex === parsed.adminPinHash) {
            return true;
          }
        }
      }
    } catch {
      // Bỏ qua lỗi đọc localStorage
    }
    return false;
  };

  const handleUnlockPinSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const isValid = await verifyAdminPin(pinInput);
    if (isValid) {
      triggerHaptic("success");
      setIsBankLocked(false);
      setShowPinModal(false);
      setPinInput("");
      setPinError(null);
    } else {
      triggerHaptic("heavy");
      setPinError("Mã PIN không chính xác! Vui lòng thử lại (mặc định: 8888).");
    }
  };

  const handleUploadCustomQr = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn file hình ảnh (PNG, JPG, WEBP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result || "");
      if (base64) {
        triggerHaptic("medium");
        setDraft((prev) => ({
          ...prev,
          customQrImage: base64,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCustomQr = () => {
    triggerHaptic("light");
    setDraft((prev) => ({
      ...prev,
      customQrImage: undefined,
    }));
  };

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

    // Nếu ngân hàng bị khóa, giữ nguyên thông tin ngân hàng và mã QR gốc từ settings để chống ghi đè
    const finalAccountNumber = isBankLocked
      ? settings.accountNumber
      : draft.accountNumber.trim();
    const finalAccountName = isBankLocked
      ? settings.accountName
      : draft.accountName.trim().toUpperCase();
    const finalBankCode = isBankLocked ? settings.bankCode : draft.bankCode;
    const finalBankName = isBankLocked ? settings.bankName : draft.bankName;
    const finalCustomQrImage = isBankLocked
      ? settings.customQrImage
      : draft.customQrImage;

    onSave({
      ...draft,
      bankCode: finalBankCode,
      bankName: finalBankName,
      accountNumber: finalAccountNumber,
      accountName: finalAccountName,
      customQrImage: finalCustomQrImage,
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
          {/* Cấu hình Ngân hàng & Mã QR VietQR (Có bảo vệ Admin PIN) */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <Landmark className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                Cấu hình Ngân hàng & Mã QR VietQR
              </p>
              {isBankLocked ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                  <Lock className="w-3 h-3" />
                  Đang Khóa Admin
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                  <Unlock className="w-3 h-3" />
                  Đã Mở Khóa Admin
                </span>
              )}
            </div>

            {/* Thanh thông báo trạng thái Khóa / Nút mở khóa Admin */}
            {isBankLocked ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 space-y-2">
                <div className="flex items-start gap-2 text-amber-900">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold">Mục này đang bị KHÓA để bảo vệ an toàn</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Để sửa STK, Ngân hàng, hoặc đổi Ảnh QR nhận tiền, vui lòng mở khóa quyền Admin.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setPinError(null);
                    setPinInput("");
                    setShowPinModal(true);
                  }}
                  className="w-full inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 active:scale-95 transition-all"
                >
                  <KeyRound className="w-4 h-4 shrink-0" />
                  <span>Mở khóa Admin để đổi mã QR</span>
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-emerald-900">
                    Đã mở khóa: Cho phép sửa STK, Ngân hàng và đổi ảnh QR
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setIsBankLocked(true);
                  }}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 underline shrink-0 ml-2"
                >
                  Khóa lại
                </button>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700">Ngân hàng</label>
              <select
                disabled={isBankLocked}
                value={draft.bankCode}
                onChange={(e) => {
                  const opt = BANK_OPTIONS.find((b) => b.code === e.target.value);
                  if (opt) setDraft({ ...draft, bankCode: opt.code, bankName: opt.name });
                }}
                className={isBankLocked ? lockedInputCls : inputCls}
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
                  readOnly={isBankLocked}
                  value={draft.accountNumber}
                  onChange={(e) => setDraft({ ...draft, accountNumber: e.target.value })}
                  inputMode="numeric"
                  className={isBankLocked ? lockedInputCls : inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Chủ tài khoản</label>
                <input
                  readOnly={isBankLocked}
                  value={draft.accountName}
                  onChange={(e) => setDraft({ ...draft, accountName: e.target.value })}
                  className={`${isBankLocked ? lockedInputCls : inputCls} uppercase`}
                />
              </div>
            </div>

            {/* Ô Ảnh mã QR tùy chỉnh (Zalo Pay / VietQR riêng của chủ nhà) */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <ImageIcon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  Ảnh mã QR tùy chỉnh (Zalo Pay / VietQR riêng của chủ nhà)
                </label>
                {draft.customQrImage && (
                  <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                    Đã cài ảnh riêng
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Nếu bạn có mã QR Zalo Pay, MoMo, hoặc mã VietQR thiết kế riêng của ngân hàng, hãy tải lên tại đây để hệ thống hiển thị trực tiếp cho khách quét.
              </p>

              {draft.customQrImage && (
                <div className="flex items-center gap-3 pt-1">
                  <img
                    src={draft.customQrImage}
                    alt="Custom QR"
                    className="h-20 w-20 shrink-0 rounded-lg border border-slate-200 object-contain bg-slate-50 p-1"
                  />
                  <div className="text-xs space-y-1.5">
                    <p className="font-semibold text-slate-800">Ảnh QR đang được áp dụng</p>
                    {!isBankLocked ? (
                      <button
                        type="button"
                        onClick={handleRemoveCustomQr}
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 active:scale-95 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Xóa ảnh & dùng VietQR tự động</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">
                        (Mở khóa Admin để thay đổi hoặc xóa ảnh)
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-1">
                {isBankLocked ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-2.5 text-center text-xs text-slate-400">
                    🔒 Cần mở khóa Admin ở trên để tải lên hoặc đổi ảnh QR tùy chỉnh
                  </div>
                ) : (
                  <label className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/60 px-3.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 cursor-pointer active:scale-95 transition-all shadow-2xs">
                    <Upload className="w-4 h-4 shrink-0 text-indigo-600" />
                    <span>{draft.customQrImage ? "Tải lên ảnh QR khác thay thế" : "Tải lên ảnh QR tùy chỉnh (.png, .jpg)"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleUploadCustomQr}
                    />
                  </label>
                )}
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

      {/* Modal Nhập PIN Admin để Mở Khóa */}
      {showPinModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <KeyRound className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold">Mở Khóa Quyền Admin</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPinModal(false);
                  setPinInput("");
                  setPinError(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Vui lòng nhập mã PIN Admin để mở khóa thay đổi Số tài khoản, Ngân hàng và Ảnh mã QR nhận tiền:
            </p>

            <form onSubmit={handleUnlockPinSubmit} className="space-y-3">
              <div>
                <input
                  type="password"
                  autoFocus
                  maxLength={10}
                  inputMode="numeric"
                  placeholder="Nhập mã PIN (mặc định: 8888)"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    if (pinError) setPinError(null);
                  }}
                  className="w-full text-center tracking-widest text-base font-bold rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20"
                />
                {pinError && (
                  <p className="mt-1.5 text-center text-xs font-semibold text-rose-600 animate-in fade-in">
                    {pinError}
                  </p>
                )}
                <p className="mt-1.5 text-center text-[10px] text-slate-400">
                  Gợi ý: Mã PIN Admin mặc định hệ thống là <span className="font-mono font-bold text-slate-600">8888</span>
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setPinInput("");
                    setPinError(null);
                  }}
                  className="flex-1 min-h-[42px] rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 active:scale-95"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[42px] rounded-xl bg-amber-600 text-xs font-bold text-white hover:bg-amber-700 active:scale-95 shadow-xs"
                >
                  Xác nhận mở khóa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
