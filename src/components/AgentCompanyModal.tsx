import { useState } from "react";
import {
  Bot,
  Play,
  RotateCcw,
  Sparkles,
  X,
  Calculator,
  MessageCircle,
  Wallet,
  Box,
  CheckCircle2,
  Activity,
  Zap,
  FileSpreadsheet,
  Send,
  Download,
  QrCode,
  Image as ImageIcon,
  AlertCircle,
} from "lucide-react";
import type { AgentInfo, AgentLog, Room, Settings } from "../types";
import { cn } from "../utils/cn";
import { formatVND, getDueStatusInfo, roomTotal } from "../utils/format";

interface Props {
  agents: AgentInfo[];
  logs: AgentLog[];
  rooms: Room[];
  settings: Settings;
  autopilot: boolean;
  onToggleAutopilot: () => void;
  onRunCycleNow: () => void;
  onDownloadExcelInvoice: (room: Room) => void;
  onDownloadReceiptImage: (room: Room) => void;
  onAutoSendAllZalo: () => void;
  onSendZaloMessage?: (room: Room) => void;
  onClearLogs: () => void;
  onClose: () => void;
}

const AGENT_ICONS = {
  DOCUMENT_GEN: FileSpreadsheet,
  AUTO_COLLECTOR: Send,
  ACCOUNTING: Calculator,
  ZALO_CSKH: MessageCircle,
  TREASURY: Wallet,
  FACILITY_3D: Box,
};

export default function AgentCompanyModal({
  agents,
  logs,
  rooms,
  settings,
  autopilot,
  onToggleAutopilot,
  onRunCycleNow,
  onDownloadExcelInvoice,
  onDownloadReceiptImage,
  onAutoSendAllZalo,
  onSendZaloMessage,
  onClearLogs,
  onClose,
}: Props) {
  const [activeTab, setActiveTab] = useState<"agents" | "queue" | "logs">("agents");
  const [isRunning, setIsRunning] = useState(false);

  const handleRunNow = async () => {
    setIsRunning(true);
    await onRunCycleNow();
    setTimeout(() => setIsRunning(false), 900);
  };

  // Danh sách các phòng chưa thanh toán để xếp vào hàng đợi thu tiền
  const unpaidRooms = rooms.filter((r) => r.status !== "EMPTY" && r.status !== "PAID");
  const totalDebt = unpaidRooms.reduce((sum, r) => sum + roomTotal(r, settings), 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Công ty Agent Điều Hành Tòa Nhà"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[94vh] w-full max-w-5xl flex-col rounded-3xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-rose-500 text-white shadow-md shadow-indigo-200">
              <Bot className="w-6 h-6 shrink-0" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl font-black text-slate-900">
                  Công Ty AI Agent Điều Hành Tòa Nhà
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {autopilot ? "AUTOPILOT: BẬT" : "AUTOPILOT: TẮT"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-inset ring-rose-600/20">
                  <Zap className="w-3 h-3 shrink-0 text-rose-500" />
                  RẢNH TAY 100% (0 CLICK GỬI TIN)
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Đội ngũ 6 AI Agents tự chủ: Lập hóa đơn Excel, chụp ảnh phiếu thu, tự động gửi Zalo kèm mã VietQR & không cần con người thao tác
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Nút bật/tắt Autopilot */}
            <button
              type="button"
              onClick={onToggleAutopilot}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-xs font-bold transition-all shadow-xs",
                autopilot
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              <Zap className="w-3.5 h-3.5 shrink-0" />
              <span>{autopilot ? "Autopilot: Bật" : "Bật Autopilot"}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>

        {/* Tab Selector & Run Action Button */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 px-6 py-3 bg-slate-50/50">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("agents")}
              className={cn(
                "rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all",
                activeTab === "agents"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-200/70"
              )}
            >
              Đội ngũ 6 Agent ({agents.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("queue")}
              className={cn(
                "relative rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all",
                activeTab === "queue"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-200/70"
              )}
            >
              <span>Hàng đợi thu nợ tự động</span>
              {unpaidRooms.length > 0 && (
                <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] text-white">
                  {unpaidRooms.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("logs")}
              className={cn(
                "rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all",
                activeTab === "logs"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-200/70"
              )}
            >
              Nhật ký Realtime ({logs.length})
            </button>
          </div>

          <button
            type="button"
            disabled={isRunning}
            onClick={handleRunNow}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:opacity-95 active:scale-95 disabled:opacity-50"
            title="Kích hoạt luồng làm việc tự động của toàn bộ 6 Agent ngay lập tức"
          >
            {isRunning ? (
              <>
                <Activity className="w-3.5 h-3.5 shrink-0 animate-spin text-white" />
                <span>Đang xử lý toàn bộ...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 shrink-0 text-white" />
                <span>Kích hoạt 6 Agent chạy ngay</span>
              </>
            )}
          </button>
        </div>

        {/* Content: Switch Tab */}
        <div className="thin-scroll flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: 6 AGENTS CARDS */}
          {activeTab === "agents" && (
            <div className="space-y-6">
              {/* Highlight 2 New Autonomous Agents */}
              <div className="rounded-2xl border border-rose-100 bg-gradient-to-r from-rose-50/50 via-amber-50/40 to-white p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 shrink-0 text-rose-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-900">
                    Bộ Đôi AI Tự Chủ Đỉnh Cao: Lập Hóa Đơn & Tự Động Thu Tiền 100% Rảnh Tay
                  </h3>
                </div>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Hai Agent phối hợp nhịp nhàng: <strong>Agent Lập Hóa Đơn</strong> tự động xuất bảng tính Excel và chụp ảnh phiếu thu PNG có đóng dấu xác thực; ngay sau đó <strong>Agent Thu Tiền Tự Động</strong> tiếp nhận và gửi thẳng tin nhắn Zalo kèm mã VietQR tới từng khách thuê mà con người không cần chạm tay.
                </p>
              </div>

              {/* Grid 6 Agents */}
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {agents.map((agent) => {
                  const Icon = AGENT_ICONS[agent.role] || Bot;
                  const isCollector = agent.role === "AUTO_COLLECTOR";
                  const isDocGen = agent.role === "DOCUMENT_GEN";

                  return (
                    <div
                      key={agent.role}
                      className={cn(
                        "relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4.5 shadow-sm transition-all hover:shadow-md",
                        isCollector
                          ? "border-rose-200 bg-rose-50/30"
                          : isDocGen
                          ? "border-amber-200 bg-amber-50/30"
                          : "border-slate-200 bg-white"
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-xs",
                              agent.avatarColor
                            )}
                          >
                            <Icon className="w-5 h-5 shrink-0" />
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                            {agent.status}
                          </span>
                        </div>

                        <h3 className="mt-3 text-sm font-bold text-slate-900">
                          {agent.name}
                        </h3>
                        <p className="text-[11px] font-semibold text-slate-500">
                          {agent.department}
                        </p>

                        <div className="mt-2.5 rounded-xl bg-white/90 p-2.5 text-[11px] text-slate-600 border border-slate-100 shadow-2xs">
                          <p className="font-semibold text-slate-700">Nhiệm vụ đang chạy:</p>
                          <p className="mt-0.5 line-clamp-2 text-slate-500">
                            {agent.currentTask}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
                        <span className="text-slate-400">Đã xử lý:</span>
                        <span className="font-bold text-slate-800 tabular-nums">
                          {agent.tasksCompleted} tác vụ
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: HÀNG ĐỢI THU NỢ TỰ ĐỘNG (100% RẢNH TAY) */}
          {activeTab === "queue" && (
            <div className="space-y-4">
              {/* Tổng quan hàng đợi */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Danh Sách Hàng Đợi Thu Nợ Tự Động (Auto Collection Pipeline)
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Có <strong>{unpaidRooms.length} phòng chưa đóng tiền</strong> • Tổng công nợ:{" "}
                    <strong className="text-rose-600">{formatVND(totalDebt)}</strong>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onAutoSendAllZalo}
                    disabled={unpaidRooms.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:opacity-95 active:scale-95 disabled:opacity-50"
                    title="Cho Agent Thu Tiền Tự Động gửi Zalo cho tất cả phòng trong hàng đợi"
                  >
                    <Send className="w-3.5 h-3.5 shrink-0 text-white" />
                    <span>🚀 Agent Gửi Zalo Toàn Bộ Hàng Đợi (100% Rảnh Tay)</span>
                  </button>
                </div>
              </div>

              {unpaidRooms.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                  <CheckCircle2 className="mx-auto w-10 h-10 text-emerald-500" />
                  <p className="mt-2 text-sm font-bold text-slate-800">
                    Tuyệt vời! Toàn bộ các phòng có khách đã hoàn tất đóng tiền.
                  </p>
                  <p className="text-xs text-slate-500">
                    Không có phòng nào trong hàng đợi thu tiền hiện tại.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Phòng / Khách thuê</th>
                        <th className="px-4 py-3">Hạn nộp & Nợ</th>
                        <th className="px-4 py-3">Bản Excel HĐĐT</th>
                        <th className="px-4 py-3">Ảnh Phiếu Thu</th>
                        <th className="px-4 py-3">Mã VietQR</th>
                        <th className="px-4 py-3">Agent Đã Tự Gửi</th>
                        <th className="px-4 py-3 text-right">Tải Hóa Đơn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {unpaidRooms.map((room) => {
                        const total = roomTotal(room, settings);
                        const dueInfo = getDueStatusInfo(room.dueDate);

                        return (
                          <tr key={room.id} className="hover:bg-slate-50/80 transition-colors">
                            {/* Phòng / Khách */}
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-900">
                                {room.id}{" "}
                                <span className="font-normal text-slate-400">
                                  (T{room.floor})
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                                {room.tenant || "Chưa có tên"} • {room.phone || "--"}
                              </div>
                            </td>

                            {/* Hạn nộp & Nợ */}
                            <td className="px-4 py-3">
                              <div className="font-bold text-rose-600 tabular-nums">
                                {formatVND(total)}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Hạn: {room.dueDate}{" "}
                                {dueInfo.isOverdue && (
                                  <span className="font-bold text-rose-500">
                                    (Trễ {dueInfo.days} ngày)
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Bản Excel HĐĐT */}
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                                <FileSpreadsheet className="w-3 h-3 shrink-0" />
                                Đã lập xong
                              </span>
                            </td>

                            {/* Ảnh Phiếu Thu */}
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
                                <ImageIcon className="w-3 h-3 shrink-0" />
                                Đã kết xuất
                              </span>
                            </td>

                            {/* Mã VietQR */}
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">
                                <QrCode className="w-3 h-3 shrink-0" />
                                Dynamic QR
                              </span>
                            </td>

                            {/* Agent Đã Tự Gửi */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-indigo-200">
                                  <Send className="w-2.5 h-2.5 shrink-0" />
                                  {room.reminderCount || 0} lần
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {room.lastZaloSentAt || "Đang xếp hàng"}
                              </div>
                            </td>

                            {/* Nút Tải & Gửi */}
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {onSendZaloMessage && (
                                  <button
                                    type="button"
                                    onClick={() => onSendZaloMessage(room)}
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 shadow-2xs"
                                    title="Cho Agent gửi tin nhắn Zalo kèm mã VietQR tới khách này"
                                  >
                                    <Send className="w-3 h-3 shrink-0" />
                                    <span>Gửi Zalo</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => onDownloadExcelInvoice(room)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                                  title="Tải bảng tính Excel hóa đơn phòng này"
                                >
                                  <Download className="w-3 h-3 shrink-0 text-emerald-600" />
                                  <span>Excel</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDownloadReceiptImage(room)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                                  title="Tải ảnh phiếu thu PNG phòng này"
                                >
                                  <Download className="w-3 h-3 shrink-0 text-amber-600" />
                                  <span>Ảnh</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: REALTIME ACTIVITY FEED */}
          {activeTab === "logs" && (
            <div className="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-white shadow-inner">
              <div className="mb-3.5 flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Nhật Ký Tự Động Hóa Realtime (Agent Activity Feed)
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">
                    {logs.length} sự kiện gần nhất
                  </span>
                  <button
                    type="button"
                    onClick={onClearLogs}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    title="Xóa log"
                  >
                    <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  </button>
                </div>
              </div>

              <div className="thin-scroll max-h-96 overflow-y-auto space-y-2 font-mono text-xs">
                {logs.length === 0 ? (
                  <p className="text-center text-slate-500 py-6">
                    Chưa có nhật ký hoạt động nào.
                  </p>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-2.5 rounded-lg bg-slate-800/60 p-2.5 border border-slate-800"
                    >
                      <span className="shrink-0 text-[10px] text-slate-500 pt-0.5">
                        [{log.timestamp}]
                      </span>

                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold",
                          log.role === "DOCUMENT_GEN" && "bg-amber-500/20 text-amber-300",
                          log.role === "AUTO_COLLECTOR" && "bg-rose-500/20 text-rose-300",
                          log.role === "ACCOUNTING" && "bg-sky-500/20 text-sky-300",
                          log.role === "ZALO_CSKH" && "bg-blue-500/20 text-blue-300",
                          log.role === "TREASURY" && "bg-emerald-500/20 text-emerald-300",
                          log.role === "FACILITY_3D" && "bg-indigo-500/20 text-indigo-300"
                        )}
                      >
                        {log.agentName}
                      </span>

                      <span className="flex-1 text-slate-300 leading-relaxed">
                        {log.message}
                      </span>

                      {log.level === "success" && (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400 mt-0.5" />
                      )}
                      {log.level === "warning" && (
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 p-4 bg-slate-50/50 rounded-b-3xl">
          <p className="text-xs text-slate-500">
            Hệ thống đang chạy nền tự chủ 24/7. Hóa đơn Excel và ảnh phiếu thu tự động kết xuất và gửi đến khách thuê theo đúng chu kỳ.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-xl bg-slate-900 px-5 text-xs font-bold text-white hover:bg-slate-800"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
