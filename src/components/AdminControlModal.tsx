import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  KeyRound,
  Bot,
  Zap,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Download,
  Trash2,
  X,
  Search,
  FileText,
  Sliders,
  Send,
} from "lucide-react";
import type { AdminSettings, AgentLogEntry } from "../types/swarmContracts";
import type { Room } from "../types";
import { TactileButton } from "./ui/TactileButton";
import { triggerHaptic } from "../utils/platformBridge";
import { cn } from "../utils/cn";

export const DEFAULT_ADMIN_PIN_HASH =
  "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4"; // SHA-256 của '1234'

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  adminPinHash: DEFAULT_ADMIN_PIN_HASH,
  autopilotEnabled: true,
  autoAuditDay: 1,
  autoRunHour: 8,
  autoDispatchBundle4In1: true,
  strictAdminMode: false,
};

export const STORAGE_KEY_ADMIN_SETTINGS = "an_gia_smart_home_admin_settings_v1";

export async function hashPinSha256(pin: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const data = new TextEncoder().encode(pin.trim());
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return DEFAULT_ADMIN_PIN_HASH;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  adminSettings: AdminSettings;
  onUpdateAdminSettings: (updates: Partial<AdminSettings>) => void;
  logs: AgentLogEntry[];
  onClearLogs: () => void;
  onRunBatchOverdue?: () => Promise<void> | void;
  overdueRooms?: Room[];
  onShowToast?: (message: string, tone?: "success" | "info" | "error") => void;
}

export default function AdminControlModal({
  isOpen,
  onClose,
  adminSettings,
  onUpdateAdminSettings,
  logs,
  onClearLogs,
  onRunBatchOverdue,
  overdueRooms = [],
  onShowToast,
}: Props) {
  // Trạng thái xác thực phiên làm việc hiện tại
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>("");
  const [pinError, setPinError] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // Tab điều khiển
  const [activeTab, setActiveTab] = useState<"controls" | "logs" | "pin">("controls");

  // Trạng thái đổi PIN
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [pinChangeMsg, setPinChangeMsg] = useState<{ text: string; error: boolean } | null>(null);

  // Lọc nhật ký Logs
  const [logSearch, setLogSearch] = useState("");
  const [logLevelFilter, setLogLevelFilter] = useState<string>("all");

  // Đang chạy batch
  const [isRunningBatch, setIsRunningBatch] = useState(false);

  // Reset PIN input khi modal mở
  useEffect(() => {
    if (!isOpen) {
      setPinInput("");
      setPinError("");
      setPinChangeMsg(null);
    }
  }, [isOpen]);

  // Xử lý nhập PIN
  const handlePinDigit = useCallback(
    async (digit: string) => {
      if (pinInput.length >= 4) return;
      triggerHaptic("light");
      const nextPin = pinInput + digit;
      setPinInput(nextPin);
      setPinError("");

      if (nextPin.length === 4) {
        setIsVerifying(true);
        try {
          const hashed = await hashPinSha256(nextPin);
          const currentTargetHash = adminSettings.adminPinHash || DEFAULT_ADMIN_PIN_HASH;

          if (hashed === currentTargetHash) {
            triggerHaptic("success");
            setIsAuthenticated(true);
            setPinInput("");
            setPinError("");
            onShowToast?.("Đã xác thực Quản Trị Viên thành công!", "success");
          } else {
            triggerHaptic("medium");
            setPinError("Mã PIN không chính xác (mặc định: 1234)");
            setPinInput("");
          }
        } catch (err) {
          setPinError("Lỗi kiểm tra bảo mật");
          setPinInput("");
        } finally {
          setIsVerifying(false);
        }
      }
    },
    [pinInput, adminSettings.adminPinHash, onShowToast]
  );

  const handleBackspace = () => {
    triggerHaptic("light");
    setPinInput((prev) => prev.slice(0, -1));
    setPinError("");
  };

  const handleClearPin = () => {
    triggerHaptic("light");
    setPinInput("");
    setPinError("");
  };

  // Hỗ trợ gõ phím vật lý khi đang ở màn hình nhập PIN
  useEffect(() => {
    if (!isOpen || isAuthenticated) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handlePinDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isAuthenticated, handlePinDigit, onClose]);

  // Đổi mã PIN
  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeMsg(null);

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setPinChangeMsg({ text: "Mã PIN mới phải gồm đúng 4 chữ số!", error: true });
      triggerHaptic("medium");
      return;
    }
    if (newPin !== confirmNewPin) {
      setPinChangeMsg({ text: "Mã PIN xác nhận không trùng khớp!", error: true });
      triggerHaptic("medium");
      return;
    }

    const hashedOld = await hashPinSha256(oldPin);
    const targetHash = adminSettings.adminPinHash || DEFAULT_ADMIN_PIN_HASH;
    if (hashedOld !== targetHash) {
      setPinChangeMsg({ text: "Mã PIN hiện tại không chính xác!", error: true });
      triggerHaptic("medium");
      return;
    }

    const hashedNew = await hashPinSha256(newPin);
    onUpdateAdminSettings({ adminPinHash: hashedNew });
    setOldPin("");
    setNewPin("");
    setConfirmNewPin("");
    setPinChangeMsg({ text: "Đã đổi mã PIN Quản Trị thành công!", error: false });
    triggerHaptic("success");
    onShowToast?.("Đã cập nhật mã PIN Quản Trị Viên mới!", "success");
  };

  // Chạy batch tức thời cho các phòng nợ
  const handleExecuteBatchOverdue = async () => {
    if (!onRunBatchOverdue) return;
    setIsRunningBatch(true);
    triggerHaptic("medium");
    try {
      await onRunBatchOverdue();
      triggerHaptic("success");
      onShowToast?.("Đã hoàn tất gửi tin & hóa đơn cho các phòng quá hạn!", "success");
    } catch {
      onShowToast?.("Có lỗi xảy ra khi thực hiện tác vụ hàng loạt", "error");
    } finally {
      setIsRunningBatch(false);
    }
  };

  // Xuất file Logs
  const handleExportLogsJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `AnGia_AgentLogs_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    onShowToast?.("Đã xuất nhật ký Agent (.json)", "success");
  };

  const handleExportLogsText = () => {
    const textLines = logs.map(
      (l) => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.agentName}] ${l.roomId ? `(Phòng ${l.roomId}) ` : ""}${l.message}`
    );
    const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(textLines.join("\n"));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `AnGia_AgentLogs_${new Date().toISOString().slice(0, 10)}.txt`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    onShowToast?.("Đã xuất nhật ký Agent (.txt)", "success");
  };

  // Danh sách log lọc
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchLevel = logLevelFilter === "all" || log.level === logLevelFilter;
      const matchSearch =
        !logSearch.trim() ||
        log.message.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.agentName.toLowerCase().includes(logSearch.toLowerCase()) ||
        (log.roomId && log.roomId.toLowerCase().includes(logSearch.toLowerCase()));
      return matchLevel && matchSearch;
    });
  }, [logs, logLevelFilter, logSearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={cn(
          "w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden max-h-[92dvh] transition-all",
          !isAuthenticated && "max-w-md"
        )}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-amber-400 shadow-xs">
              {isAuthenticated ? <ShieldCheck className="w-5 h-5" /> : <Shield className="w-5 h-5 text-amber-400" />}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                  {isAuthenticated ? "Bảng Quản Trị Hệ Thống & Agent 24/7" : "Xác Thực Quản Trị Viên (Admin PIN)"}
                </h3>
                <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-900 uppercase">
                  Admin
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {isAuthenticated
                  ? "Kiểm soát Master Autopilot, lịch chốt số & nhật ký toàn diện"
                  : "Bảo mật cấp cao • Nhập mã PIN 4 số để tiếp tục"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setIsAuthenticated(false);
                  onShowToast?.("Đã khóa chế độ Quản trị viên", "info");
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
                title="Khóa lại"
              >
                <Lock className="w-4 h-4" />
                <span className="hidden sm:inline">Khóa lại</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 1. MÀN HÌNH NHẬP PIN KHI CHƯA XÁC THỰC */}
        {!isAuthenticated ? (
          <div className="p-6 flex flex-col items-center">
            <div className="my-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-8 ring-amber-50/50">
              <KeyRound className="w-7 h-7" />
            </div>

            <p className="text-sm font-semibold text-slate-800 text-center">
              Nhập mã PIN 4 chữ số
            </p>
            <p className="text-xs text-slate-500 text-center mt-0.5 mb-6">
              Mã mặc định hệ thống ban đầu là <strong className="font-mono text-slate-700">1234</strong>
            </p>

            {/* 4 Chấm chỉ báo PIN */}
            <div className="flex items-center justify-center gap-4 mb-6">
              {[0, 1, 2, 3].map((idx) => {
                const filled = pinInput.length > idx;
                return (
                  <div
                    key={idx}
                    className={cn(
                      "h-4 w-4 rounded-full transition-all duration-200",
                      filled
                        ? "bg-slate-900 scale-110 shadow-sm"
                        : "bg-slate-200 border border-slate-300"
                    )}
                  />
                );
              })}
            </div>

            {/* Thông báo lỗi nếu có */}
            {pinError && (
              <div className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-rose-600 animate-shake">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            {/* Bàn phím số cảm ứng Tactile Keypad */}
            <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px]">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <TactileButton
                  key={num}
                  variant="outline"
                  size="md"
                  onClick={() => handlePinDigit(num)}
                  disabled={isVerifying}
                  className="h-12 text-lg font-bold text-slate-800 font-mono rounded-2xl border-slate-200 hover:border-slate-300 hover:bg-slate-50 active:scale-90"
                >
                  {num}
                </TactileButton>
              ))}

              <TactileButton
                variant="ghost"
                size="md"
                onClick={handleClearPin}
                disabled={isVerifying || pinInput.length === 0}
                className="h-12 text-xs font-semibold text-slate-500 rounded-2xl hover:bg-slate-100 active:scale-95"
              >
                Xóa hết
              </TactileButton>

              <TactileButton
                variant="outline"
                size="md"
                onClick={() => handlePinDigit("0")}
                disabled={isVerifying}
                className="h-12 text-lg font-bold text-slate-800 font-mono rounded-2xl border-slate-200 hover:border-slate-300 hover:bg-slate-50 active:scale-90"
              >
                0
              </TactileButton>

              <TactileButton
                variant="ghost"
                size="md"
                onClick={handleBackspace}
                disabled={isVerifying || pinInput.length === 0}
                className="h-12 text-xs font-semibold text-slate-500 rounded-2xl hover:bg-slate-100 active:scale-95"
              >
                ← Xóa
              </TactileButton>
            </div>
          </div>
        ) : (
          /* 2. BẢNG ĐIỀU KHIỂN QUẢN TRỊ SAU KHI XÁC THỰC */
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Tabs Điều Hướng */}
            <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-100 bg-white">
              <button
                type="button"
                onClick={() => setActiveTab("controls")}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 transition-all",
                  activeTab === "controls"
                    ? "border-emerald-600 text-emerald-800"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                )}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Điều Khiển Master & Lịch Trình</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("logs")}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 transition-all",
                  activeTab === "logs"
                    ? "border-emerald-600 text-emerald-800"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                )}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Nhật Ký Agent</span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-600">
                  {logs.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("pin")}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 transition-all",
                  activeTab === "pin"
                    ? "border-emerald-600 text-emerald-800"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                )}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Đổi Mã PIN</span>
              </button>
            </div>

            {/* Thân Modal cuộn */}
            <div className="thin-scroll flex-1 overflow-y-auto p-5 space-y-4">
              {/* TAB 1: MASTER CONTROLS & SCHEDULE */}
              {activeTab === "controls" && (
                <div className="space-y-4">
                  {/* Master Switch Autopilot 24/7 */}
                  <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                            adminSettings.autopilotEnabled
                              ? "bg-emerald-600 text-white shadow-sm shadow-emerald-200"
                              : "bg-slate-200 text-slate-500"
                          )}
                        >
                          <Zap className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900">
                              Autopilot 24/7 Master Switch
                            </h4>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
                                adminSettings.autopilotEnabled
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-100 text-slate-600"
                              )}
                            >
                              {adminSettings.autopilotEnabled ? (
                                <>
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Đang Hoạt Động
                                </>
                              ) : (
                                "Tạm Dừng"
                              )}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Hệ thống 6 AI Agent tự động giám sát chu kỳ 1 tháng, đối soát điện nước, xuất phiếu thu & tự động gửi Zalo.
                          </p>
                        </div>
                      </div>

                      {/* Nút Toggle Switch */}
                      <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={adminSettings.autopilotEnabled}
                          onChange={(e) => {
                            triggerHaptic("medium");
                            onUpdateAdminSettings({ autopilotEnabled: e.target.checked });
                            onShowToast?.(
                              e.target.checked
                                ? "Đã bật Autopilot 24/7"
                                : "Đã tạm dừng Autopilot 24/7",
                              "info"
                            );
                          }}
                        />
                        <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                      </label>
                    </div>
                  </div>

                  {/* Manual Batch Run for All Overdue Rooms */}
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">
                            Xử Lý Thu Nợ Hàng Loạt Phòng Quá Hạn
                          </h4>
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-black text-rose-700">
                            {overdueRooms.length} phòng quá hạn
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Kích hoạt Agent Lập Hóa Đơn và Agent Thu Tiền Tự Động xử lý tức thời toàn bộ các phòng nợ mà không cần chờ đến khung giờ định kỳ.
                        </p>
                      </div>

                      <TactileButton
                        variant="danger"
                        size="sm"
                        isLoading={isRunningBatch}
                        disabled={isRunningBatch || overdueRooms.length === 0}
                        onClick={handleExecuteBatchOverdue}
                        leftIcon={<Play className="w-3.5 h-3.5" />}
                        className="shrink-0 font-bold shadow-sm shadow-rose-200"
                      >
                        Chạy Tức Thời Ngay ({overdueRooms.length})
                      </TactileButton>
                    </div>
                  </div>

                  {/* Cấu hình lịch chốt sổ & Giờ chạy định kỳ */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Cấu Hình Lịch Chốt Sổ & Giờ Vận Hành
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Ngày chốt số điện nước */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                          <Calendar className="w-4 h-4 text-emerald-600" />
                          <span>Ngày chốt số hàng tháng:</span>
                        </label>
                        <select
                          value={adminSettings.autoAuditDay}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            onUpdateAdminSettings({ autoAuditDay: val });
                          }}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 shadow-2xs"
                        >
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                            <option key={d} value={d}>
                              Ngày {d} hàng tháng {d === 1 ? "(Mặc định)" : ""}
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Đến ngày này, Agent Kế toán sẽ tự động kiểm tra đối soát chỉ số điện nước.
                        </p>
                      </div>

                      {/* Giờ chạy tự động */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                          <Clock className="w-4 h-4 text-indigo-600" />
                          <span>Khung giờ chạy tự động:</span>
                        </label>
                        <select
                          value={adminSettings.autoRunHour}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            onUpdateAdminSettings({ autoRunHour: val });
                          }}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 shadow-2xs"
                        >
                          {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                            <option key={h} value={h}>
                              {String(h).padStart(2, "0")}:00 {h === 8 ? "(08:00 Sáng - Đề xuất)" : ""}
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Thời điểm Agent tự động phát hóa đơn và gửi tin nhắn Zalo đến khách thuê.
                        </p>
                      </div>
                    </div>

                    {/* Tuỳ chọn Gói 4-trong-1 & Chế độ nghiêm ngặt */}
                    <div className="space-y-2 pt-1 border-t border-slate-100">
                      <label className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
                        <div className="flex items-start gap-2.5">
                          <Send className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-slate-800">
                              Tự động phát hành Gói Hóa Đơn 4-trong-1
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Bao gồm Tin nhắn chuẩn hóa + Mã VietQR + Ảnh phiếu thu 2x Retina + Bảng Excel .xlsx
                            </p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={adminSettings.autoDispatchBundle4In1}
                          onChange={(e) =>
                            onUpdateAdminSettings({ autoDispatchBundle4In1: e.target.checked })
                          }
                          className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
                        <div className="flex items-start gap-2.5">
                          <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-slate-800">
                              Chế độ Bảo Mật Quản Trị Nghiêm Ngặt (Strict Admin Mode)
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Ẩn hoàn toàn các nút cấu hình nhạy cảm và điều khiển nâng cao khỏi người dùng thường.
                            </p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={adminSettings.strictAdminMode}
                          onChange={(e) =>
                            onUpdateAdminSettings({ strictAdminMode: e.target.checked })
                          }
                          className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: AGENT LOGS VIEWER */}
              {activeTab === "logs" && (
                <div className="space-y-3">
                  {/* Controls: Search, Level Filter, Export, Clear */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                    <div className="flex items-center gap-2 flex-1">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={logSearch}
                          onChange={(e) => setLogSearch(e.target.value)}
                          placeholder="Tìm trong nhật ký..."
                          className="w-full pl-8 pr-2 py-1 text-xs rounded-lg border border-slate-200 bg-white outline-none focus:border-emerald-500 shadow-2xs"
                        />
                      </div>

                      <select
                        value={logLevelFilter}
                        onChange={(e) => setLogLevelFilter(e.target.value)}
                        className="text-xs rounded-lg border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700 outline-none focus:border-emerald-500"
                      >
                        <option value="all">Tất cả mức độ</option>
                        <option value="action">Hành động (Action)</option>
                        <option value="success">Thành công (Success)</option>
                        <option value="warning">Cảnh báo (Warning)</option>
                        <option value="info">Thông tin (Info)</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <TactileButton
                        variant="outline"
                        size="xs"
                        onClick={handleExportLogsJson}
                        leftIcon={<Download className="w-3 h-3" />}
                        title="Tải tệp nhật ký JSON"
                      >
                        JSON
                      </TactileButton>
                      <TactileButton
                        variant="outline"
                        size="xs"
                        onClick={handleExportLogsText}
                        leftIcon={<FileText className="w-3 h-3" />}
                        title="Tải tệp nhật ký Text"
                      >
                        TXT
                      </TactileButton>
                      <TactileButton
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ nhật ký hiện tại?")) {
                            onClearLogs();
                            onShowToast?.("Đã xóa toàn bộ nhật ký Agent", "info");
                          }
                        }}
                        className="text-rose-600 hover:bg-rose-50"
                        title="Xóa toàn bộ nhật ký"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </TactileButton>
                    </div>
                  </div>

                  {/* Log list */}
                  <div className="border border-slate-200 rounded-2xl bg-white divide-y divide-slate-100 max-h-[380px] overflow-y-auto thin-scroll">
                    {filteredLogs.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        Không có nhật ký nào phù hợp với bộ lọc
                      </div>
                    ) : (
                      filteredLogs.map((log) => {
                        const levelConfig = {
                          action: "bg-indigo-50 text-indigo-700 border-indigo-200",
                          success: "bg-emerald-50 text-emerald-700 border-emerald-200",
                          warning: "bg-amber-50 text-amber-700 border-amber-200",
                          info: "bg-slate-50 text-slate-600 border-slate-200",
                        }[log.level] || "bg-slate-50 text-slate-600 border-slate-200";

                        return (
                          <div key={log.id} className="p-2.5 sm:p-3 hover:bg-slate-50/70 transition-colors">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className={cn(
                                    "rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase border",
                                    levelConfig
                                  )}
                                >
                                  {log.level}
                                </span>
                                <span className="text-xs font-bold text-slate-800 truncate">
                                  {log.agentName}
                                </span>
                                {log.roomId && (
                                  <span className="rounded bg-slate-100 px-1 text-[10px] font-mono font-bold text-slate-600">
                                    {log.roomId}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] font-mono text-slate-400 shrink-0">
                                {log.timestamp}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed font-mono">
                              {log.message}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: ĐỔI MÃ PIN */}
              {activeTab === "pin" && (
                <div className="max-w-md mx-auto py-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
                    <h4 className="text-sm font-bold text-slate-900 mb-1">
                      Thay Đổi Mã PIN Quản Trị Viên
                    </h4>
                    <p className="text-xs text-slate-500 mb-4">
                      Mã PIN được bảo vệ bằng mã hóa chuẩn SHA-256 một chiều, lưu trữ an toàn trong thiết bị.
                    </p>

                    <form onSubmit={handleChangePin} className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-700">
                          Mã PIN hiện tại <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="password"
                          maxLength={4}
                          value={oldPin}
                          onChange={(e) => setOldPin(e.target.value)}
                          placeholder="Mặc định: 1234"
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono tracking-widest text-slate-900 outline-none focus:border-emerald-500 shadow-2xs"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700">
                          Mã PIN mới (4 chữ số) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="password"
                          maxLength={4}
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value)}
                          placeholder="4 chữ số"
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono tracking-widest text-slate-900 outline-none focus:border-emerald-500 shadow-2xs"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700">
                          Xác nhận mã PIN mới <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="password"
                          maxLength={4}
                          value={confirmNewPin}
                          onChange={(e) => setConfirmNewPin(e.target.value)}
                          placeholder="Nhập lại 4 chữ số mới"
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono tracking-widest text-slate-900 outline-none focus:border-emerald-500 shadow-2xs"
                        />
                      </div>

                      {pinChangeMsg && (
                        <div
                          className={cn(
                            "p-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5",
                            pinChangeMsg.error
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          )}
                        >
                          {pinChangeMsg.error ? (
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                          )}
                          <span>{pinChangeMsg.text}</span>
                        </div>
                      )}

                      <div className="pt-2">
                        <TactileButton
                          type="submit"
                          variant="primary"
                          size="md"
                          className="w-full font-bold shadow-sm shadow-emerald-200"
                        >
                          Cập Nhật Mã PIN Bảo Mật
                        </TactileButton>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
