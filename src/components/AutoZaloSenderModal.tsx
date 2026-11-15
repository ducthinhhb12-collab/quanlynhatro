import { useState, useEffect, useRef } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Image as ImageIcon,
  MessageSquare,
  Play,
  QrCode,
  RefreshCw,
  Send,
  Smartphone,
  Square,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import * as XLSX from "xlsx";
import type { Room, Settings } from "../types";
import type { ZaloBatchItem, ZaloProgressEvent, ZaloStatusEvent } from "../types/electron";
import {
  buildReminderMessage,
  buildZaloChatUrl,
  formatVND,
  roomTotal,
  STATUS_META,
} from "../utils/format";
import { generateRoomInvoiceWorkbook } from "../utils/invoiceGenerator";
import { cn } from "../utils/cn";

interface Props {
  rooms: Room[];
  settings: Settings;
  onClose: () => void;
  onDownloadExcelInvoice: (room: Room) => void;
  onDownloadReceiptImage: (room: Room) => void;
  onConfirmSent: (roomId: string) => void;
  onAutoSendAll: () => Promise<void>;
}

interface RoomResultLog {
  roomId: string;
  tenant: string;
  phone: string;
  status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";
  stepText: string;
  error?: string;
}

export default function AutoZaloSenderModal({
  rooms,
  settings,
  onClose,
  onDownloadExcelInvoice,
  onDownloadReceiptImage,
  onConfirmSent,
  onAutoSendAll,
}: Props) {
  const isDesktop = typeof window !== "undefined" && Boolean(window.electronAPI);

  // Lọc các phòng chưa thanh toán và có số điện thoại
  const unpaidRooms = rooms.filter(
    (r) => r.status !== "EMPTY" && r.status !== "PAID" && r.phone
  );

  const [selectedRoomId, setSelectedRoomId] = useState<string>(
    unpaidRooms[0]?.id || ""
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testSuccessMessage, setTestSuccessMessage] = useState<string | null>(null);

  // Cấu hình chống gửi trùng hôm nay
  const [skipSentToday, setSkipSentToday] = useState<boolean>(() => {
    try {
      return localStorage.getItem("zalo_skip_sent_today") === "true";
    } catch {
      return true;
    }
  });

  const handleToggleSkipSent = (val: boolean) => {
    setSkipSentToday(val);
    try {
      localStorage.setItem("zalo_skip_sent_today", val ? "true" : "false");
    } catch {
      // ignore
    }
  };

  // Trạng thái Robot RPA
  const [isRobotRunning, setIsRobotRunning] = useState(false);
  const [robotStatusText, setRobotStatusText] = useState<string>("Sẵn sàng làm việc");
  const [currentProgress, setCurrentProgress] = useState<ZaloProgressEvent | null>(null);
  const [resultsLog, setResultsLog] = useState<Record<string, RoomResultLog>>({});
  const [activeTab, setActiveTab] = useState<"preview" | "robot">("preview");
  const [qrScanning, setQrScanning] = useState(false);
  const [qrMessage, setQrMessage] = useState<string | null>(null);

  // Ref lưu danh sách để không bị stale closure trong callbacks
  const unpaidRoomsRef = useRef(unpaidRooms);
  unpaidRoomsRef.current = unpaidRooms;

  // Lắng nghe sự kiện từ Electron IPC Main Process (React 19 StrictMode Safe)
  useEffect(() => {
    if (!window.electronAPI) return;

    const cleanupProgress = window.electronAPI.onZaloProgress((event: ZaloProgressEvent) => {
      setCurrentProgress(event);

      if (event.roomId) {
        const rId = event.roomId;
        setResultsLog((prev) => {
          const currentLog = prev[rId] || {
            roomId: rId,
            tenant: event.tenant || "",
            phone: event.phone || "",
            status: "PROCESSING" as const,
            stepText: event.detail || "Đang xử lý...",
          };

          let newStatus = currentLog.status;
          let stepText = event.detail || currentLog.stepText;

          if (event.step === "SUCCESS") {
            newStatus = "SUCCESS";
            stepText = "Đã gửi tin nhắn & hóa đơn thành công";
            onConfirmSent(rId);
          } else if (event.step === "FAILED") {
            newStatus = "FAILED";
            stepText = event.error || "Thất bại";
          } else if (event.step === "DELAYING") {
            stepText = `Nghỉ an toàn: Còn ${event.countdownSeconds || 0}s...`;
          }

          return {
            ...prev,
            [rId]: {
              ...currentLog,
              status: newStatus,
              stepText,
              error: event.error,
            },
          };
        });
      }

      if (event.step === "WAITING_QR") {
        setQrScanning(true);
      } else {
        setQrScanning(false);
      }

      if (event.step === "BATCH_DONE") {
        setIsRobotRunning(false);
        window.electronAPI?.showNotification({
          title: "An Gia Smart Home 3D",
          body: "Robot RPA Zalo đã hoàn thành chu trình gửi tin nhắn & hóa đơn!",
        });
      }
    });

    const cleanupStatus = window.electronAPI.onZaloStatusChange((event: ZaloStatusEvent) => {
      if (event.currentTask) {
        setRobotStatusText(event.currentTask);
      }
      setIsRobotRunning(event.isBusy);
    });

    return () => {
      cleanupProgress();
      cleanupStatus();
    };
  }, [onConfirmSent]);

  const activeRoom =
    unpaidRooms.find((r) => r.id === selectedRoomId) || unpaidRooms[0] || null;

  const handleCopyText = async (text: string, roomId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(roomId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      setCopiedId(roomId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // 1. Mở phiên Zalo để quét QR
  const handleOpenZaloSession = async () => {
    if (!window.electronAPI) {
      alert("Tính năng tự động hóa Zalo chỉ khả dụng khi chạy trên phần mềm Desktop Native (.exe)!");
      return;
    }

    setQrScanning(true);
    setQrMessage("Đang mở trình duyệt Zalo. Quý khách vui lòng quét mã QR trên Zalo điện thoại để kết nối...");
    try {
      const res = await window.electronAPI.openZaloSession();
      if (res.success) {
        setQrMessage("✅ Đã kết nối Zalo thành công! Phiên làm việc đã được lưu trữ vĩnh viễn.");
      } else {
        setQrMessage(`⚠️ ${res.message}`);
      }
    } catch (err: any) {
      setQrMessage(`❌ Lỗi mở Zalo: ${err.message}`);
    } finally {
      setQrScanning(false);
      setTimeout(() => setQrMessage(null), 8000);
    }
  };

  // 2. Khởi động Robot RPA gửi tự động
  const handleStartRobotBatch = async () => {
    if (!window.electronAPI) {
      // Fallback cho môi trường web thông thường
      handleRunWebSimulation();
      return;
    }

    const todayStr = new Date().toLocaleDateString("vi-VN");
    const targetRooms = unpaidRooms.filter((r) => {
      if (skipSentToday && r.lastZaloSentAt && r.lastZaloSentAt.includes(todayStr)) {
        return false;
      }
      return true;
    });

    if (targetRooms.length === 0) {
      alert("Toàn bộ các phòng nợ đã được gửi Zalo trong ngày hôm nay! (Bỏ tích 'Bỏ qua phòng đã gửi hôm nay' nếu muốn gửi lại)");
      return;
    }

    setActiveTab("robot");
    setIsRobotRunning(true);
    setRobotStatusText("Đang xuất hóa đơn Excel và chuẩn bị hàng đợi...");

    // Khởi tạo bảng kết quả
    const initialLog: Record<string, RoomResultLog> = {};
    for (const r of targetRooms) {
      initialLog[r.id] = {
        roomId: r.id,
        tenant: r.tenant,
        phone: r.phone,
        status: "PENDING",
        stepText: "Chờ đến lượt...",
      };
    }
    setResultsLog(initialLog);

    try {
      const currentMonth = new Date().toISOString().slice(0, 7); // e.g. '2026-11'
      const items: ZaloBatchItem[] = [];

      for (const room of targetRooms) {
        // Tự động tạo file Excel hóa đơn dạng binary Uint8Array
        const wb = generateRoomInvoiceWorkbook(room, settings);
        const excelArray = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
        const excelBuffer = new Uint8Array(excelArray);
        const fileName = `Hoa-Don-Phong-${room.id}.xlsx`;

        // Ghi xuống ổ cứng Document/QuanLyPhongTro/HoaDon/[month]
        const saveRes = await window.electronAPI.saveExcelFile(fileName, currentMonth, excelBuffer);
        const invoicePath = saveRes.success ? saveRes.filePath : undefined;

        items.push({
          id: room.id,
          tenant: room.tenant,
          tenantPhone: room.phone,
          zaloName: room.zaloName,
          amount: roomTotal(room, settings),
          dueDate: room.dueDate,
          startDate: room.startDate,
          electricOld: room.electricOld,
          electricNew: room.electricNew,
          waterFee: room.waterFee,
          internetFee: room.internetFee,
          roomFee: room.roomFee,
          invoiceExcelPath: invoicePath,
          messageText: buildReminderMessage(room, settings),
        });
      }

      setRobotStatusText(`Đã nạp ${items.length} phòng vào hàng đợi Robot. Đang khởi chạy...`);
      await window.electronAPI.startZaloBatch(items, {
        bankCode: settings.bankCode,
        bankName: settings.bankName,
        accountNumber: settings.accountNumber,
        accountName: settings.accountName,
        electricUnitPrice: settings.electricUnitPrice,
      });
    } catch (err: any) {
      setRobotStatusText(`Lỗi khởi động Robot: ${err.message}`);
      setIsRobotRunning(false);
    }
  };

  // 3. Dừng Robot khẩn cấp
  const handleStopRobot = async () => {
    if (window.electronAPI) {
      await window.electronAPI.stopZaloBatch();
    }
    setIsRobotRunning(false);
  };

  // Fallback mô phỏng khi chạy trên trình duyệt thường
  const handleRunWebSimulation = async () => {
    if (unpaidRooms.length === 0) return;
    setIsRobotRunning(true);
    setActiveTab("robot");

    const initialLog: Record<string, RoomResultLog> = {};
    for (const r of unpaidRooms) {
      initialLog[r.id] = {
        roomId: r.id,
        tenant: r.tenant,
        phone: r.phone,
        status: "PENDING",
        stepText: "Chờ mô phỏng...",
      };
    }
    setResultsLog(initialLog);

    for (let i = 0; i < unpaidRooms.length; i++) {
      const r = unpaidRooms[i];
      setResultsLog((prev) => ({
        ...prev,
        [r.id]: { ...prev[r.id], status: "PROCESSING", stepText: "Đang tải Excel & soạn tin..." },
      }));

      onDownloadExcelInvoice(r);
      onConfirmSent(r.id);

      await new Promise((res) => setTimeout(res, 800));

      setResultsLog((prev) => ({
        ...prev,
        [r.id]: { ...prev[r.id], status: "SUCCESS", stepText: "Đã tạo file và đánh dấu gửi" },
      }));
    }

    setIsRobotRunning(false);
    await onAutoSendAll();
  };

  // Gửi thử nghiệm trực tiếp đến số Zalo người dùng nhập
  const handleSendTestToMyPhone = async () => {
    const clean = testPhone.trim().replace(/[^\d]/g, "");
    if (clean.length < 9) {
      alert("Vui lòng nhập số điện thoại Zalo hợp lệ (từ 10 số, ví dụ 0912345678)!");
      return;
    }

    const roomToUse = activeRoom || unpaidRooms[0] || rooms[0];
    const customRoom: Room = {
      ...roomToUse,
      phone: clean,
      tenant: "Bạn (Người nhận thử nghiệm)",
      zaloName: "Zalo của bạn",
    };

    const message = buildReminderMessage(customRoom, settings);
    await handleCopyText(message, "test");

    onDownloadExcelInvoice(customRoom);

    const zaloUrl = buildZaloChatUrl(clean);
    window.open(zaloUrl, "_blank");

    setTestSuccessMessage(
      `✅ Đã mở cuộc trò chuyện Zalo với số ${clean}! Tin nhắn & link VietQR đã được copy vào clipboard, file Excel đã tải về. Nhấn Ctrl+V để gửi!`
    );
    setTimeout(() => setTestSuccessMessage(null), 8000);
  };

  const handleDispatchSingleToZalo = async (room: Room) => {
    const message = buildReminderMessage(room, settings);
    await handleCopyText(message, room.id);
    onDownloadExcelInvoice(room);
    const zaloUrl = buildZaloChatUrl(room.phone);
    window.open(zaloUrl, "_blank");
    onConfirmSent(room.id);
  };

  const totalDebt = unpaidRooms.reduce((s, r) => s + roomTotal(r, settings), 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Trung Tâm Điều Phối Tin Nhắn & Hóa Đơn Zalo Tự Động"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[94vh] w-full max-w-5xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-100"
      >
        {/* Header với phong cách Desktop & RPA */}
        <div className="flex items-start justify-between border-b border-slate-100 p-5 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-500 via-pink-500 to-amber-400 text-white shadow-md shadow-rose-950/50">
              <Bot className="w-6 h-6 shrink-0" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-white">
                  Robot Tự Động Hóa Zalo RPA (Desktop Native)
                </h2>
                {isDesktop ? (
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/40 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    DESKTOP NATIVE .EXE
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-500/40 flex items-center gap-1">
                    TRÌNH DUYỆT WEB
                  </span>
                )}
                <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-[10px] font-bold text-rose-300 ring-1 ring-rose-500/40 flex items-center gap-1">
                  <Zap className="w-3 h-3 shrink-0" />
                  100% RẢNH TAY
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-300">
                Robot Playwright tự động tìm khách, dán tin nhắn đa dòng, đính kèm file Excel hóa đơn & gửi kèm mã VietQR
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Nút Kết nối Zalo (Quét QR) */}
            {isDesktop && (
              <button
                type="button"
                disabled={isRobotRunning || qrScanning}
                onClick={handleOpenZaloSession}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-bold text-white shadow-xs backdrop-blur-sm transition-all hover:bg-white/20 active:scale-95 disabled:opacity-50"
                title="Mở trình duyệt Zalo để quét QR đăng nhập trước"
              >
                <QrCode className="w-3.5 h-3.5 shrink-0 text-amber-300" />
                <span>{qrScanning ? "Đang chờ QR..." : "Kết nối Zalo (Quét QR)"}</span>
              </button>
            )}

            {/* Nút Bắt đầu / Dừng Robot */}
            {isRobotRunning ? (
              <button
                type="button"
                onClick={handleStopRobot}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white shadow-md shadow-rose-900/50 transition-all hover:bg-rose-700 active:scale-95 animate-pulse"
                title="Dừng chu trình Robot ngay lập tức"
              >
                <Square className="w-3.5 h-3.5 shrink-0 fill-current" />
                <span>Dừng Robot Khẩn Cấp</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={unpaidRooms.length === 0}
                onClick={handleStartRobotBatch}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 text-xs font-bold text-white shadow-md shadow-emerald-950/40 transition-all hover:opacity-95 active:scale-95 disabled:opacity-50"
                title="Khởi động Robot tự động tìm kiếm, đính kèm file và gửi Zalo cho toàn bộ phòng nợ"
              >
                <Play className="w-3.5 h-3.5 shrink-0 fill-current" />
                <span>Khởi Động Robot Gửi Tự Động</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>

        {/* Thanh trạng thái nhanh & Tabs chuyển đổi */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-2.5 text-xs">
          <div className="flex items-center gap-4">
            <span className="text-slate-600">
              Khách chưa đóng: <strong>{unpaidRooms.length} phòng</strong>
            </span>
            <span className="h-3 w-px bg-slate-300" />
            <span className="text-slate-600">
              Tổng công nợ:{" "}
              <strong className="text-rose-600">{formatVND(totalDebt)}</strong>
            </span>
            <span className="h-3 w-px bg-slate-300" />
            <label className="flex items-center gap-1.5 text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={skipSentToday}
                onChange={(e) => handleToggleSkipSent(e.target.checked)}
                className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
              />
              <span className="font-medium text-[11px]">Bỏ qua phòng đã gửi hôm nay</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-slate-200/70 p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={cn(
                  "rounded-lg px-3 py-1 transition-all",
                  activeTab === "preview"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Xem trước & Soạn tin ({unpaidRooms.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("robot")}
                className={cn(
                  "rounded-lg px-3 py-1 transition-all flex items-center gap-1.5",
                  activeTab === "robot"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <span>Tiến trình Robot Real-time</span>
                {isRobotRunning && (
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Thông báo quét QR hoặc trạng thái */}
        {qrMessage && (
          <div className="bg-indigo-900 text-indigo-100 px-6 py-2.5 text-xs font-medium flex items-center justify-between border-b border-indigo-800">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-amber-300 shrink-0" />
              <span>{qrMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setQrMessage(null)}
              className="text-xs text-indigo-300 hover:text-white underline ml-3"
            >
              Đóng
            </button>
          </div>
        )}

        {/* Khung Gửi Thử Trực Tiếp Đến SĐT Của Bạn (cho phép test trước khi chạy batch) */}
        <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-indigo-500/10 border-b border-rose-200/60 p-3 px-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-xs">
              <Smartphone className="w-4 h-4 shrink-0" />
            </span>
            <div>
              <p className="text-xs font-bold text-slate-900">
                Gửi Thử Tin Nhắn & Hóa Đơn Trực Tiếp Vào Số Zalo Của Bạn
              </p>
              <p className="text-[11px] text-slate-500">
                Nhập số Zalo của bạn để nhận tin nhắn mẫu kèm link VietQR và file Excel ngay lập tức
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
            <input
              type="tel"
              placeholder="Nhập SĐT Zalo của bạn (VD: 0987654321)..."
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="h-8.5 w-64 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-rose-500 shadow-2xs"
            />
            <button
              type="button"
              onClick={handleSendTestToMyPhone}
              className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 px-3.5 text-xs font-bold text-white shadow-xs hover:opacity-95 active:scale-95"
            >
              <Send className="w-3.5 h-3.5 shrink-0" />
              <span>Gửi Vào Zalo Tôi</span>
            </button>
          </div>
        </div>

        {testSuccessMessage && (
          <div className="bg-emerald-600 text-white px-6 py-2.5 text-xs font-medium flex items-center justify-between shadow-inner">
            <span>{testSuccessMessage}</span>
            <button
              type="button"
              onClick={() => setTestSuccessMessage(null)}
              className="underline text-[11px] ml-2 text-emerald-100 hover:text-white"
            >
              Đóng
            </button>
          </div>
        )}

        {/* Nội dung chính theo Tabs */}
        {activeTab === "robot" ? (
          /* TAB 1: TIẾN TRÌNH ROBOT REAL-TIME */
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto thin-scroll p-6 space-y-5 bg-slate-50/50">
            {/* Banner trạng thái Robot */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-md",
                      isRobotRunning
                        ? "bg-gradient-to-tr from-emerald-500 to-teal-500 shadow-emerald-500/30"
                        : "bg-slate-800"
                    )}
                  >
                    {isRobotRunning ? (
                      <RefreshCw className="w-6 h-6 animate-spin shrink-0" />
                    ) : (
                      <Bot className="w-6 h-6 shrink-0" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      Trạng thái Robot:{" "}
                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-xs font-bold",
                          isRobotRunning
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-700"
                        )}
                      >
                        {isRobotRunning ? "ĐANG CHẠY TỰ ĐỘNG" : "ĐANG CHỜ"}
                      </span>
                    </h3>
                    <p className="mt-0.5 text-xs font-medium text-slate-600">
                      {robotStatusText}
                    </p>
                  </div>
                </div>

                {isRobotRunning && (
                  <button
                    type="button"
                    onClick={handleStopRobot}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-rose-700 active:scale-95"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Dừng Robot Khẩn Cấp</span>
                  </button>
                )}
              </div>

              {/* Thanh tiến độ tổng quát */}
              {currentProgress && currentProgress.totalRooms && currentProgress.totalRooms > 0 && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                    <span>
                      Tiến độ: Phòng {currentProgress.currentRoomIndex || 1} / {currentProgress.totalRooms} (
                      {currentProgress.tenant || ""} - {currentProgress.phone || ""})
                    </span>
                    <span className="text-emerald-600">
                      {Math.round(((currentProgress.currentRoomIndex || 1) / currentProgress.totalRooms) * 100)}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
                      style={{
                        width: `${Math.round(
                          ((currentProgress.currentRoomIndex || 1) / currentProgress.totalRooms) * 100
                        )}%`,
                      }}
                    />
                  </div>

                  {/* Chi tiết bước hiện tại */}
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-200">
                    <div className="flex items-center gap-2 text-xs">
                      {currentProgress.step === "WAITING_QR" && (
                        <QrCode className="w-4 h-4 text-amber-600 animate-bounce" />
                      )}
                      {currentProgress.step === "DELAYING" && (
                        <Clock className="w-4 h-4 text-indigo-600 animate-spin" />
                      )}
                      {currentProgress.step === "SUCCESS" && (
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                      )}
                      {currentProgress.step === "FAILED" && (
                        <XCircle className="w-4 h-4 text-rose-600" />
                      )}
                      {["SEARCHING", "CHATTING", "PASTING_TEXT", "ATTACHING_FILE", "SENDING"].includes(
                        currentProgress.step
                      ) && <RefreshCw className="w-4 h-4 text-teal-600 animate-spin" />}

                      <span className="font-semibold text-slate-800">
                        {currentProgress.detail || "Đang xử lý..."}
                      </span>
                    </div>

                    {currentProgress.countdownSeconds !== undefined &&
                      currentProgress.countdownSeconds > 0 && (
                        <span className="rounded-lg bg-indigo-100 px-2.5 py-1 text-xs font-mono font-bold text-indigo-800">
                          Đếm ngược: {currentProgress.countdownSeconds}s
                        </span>
                      )}
                  </div>
                </div>
              )}
            </div>

            {/* Bảng danh sách kết quả từng phòng */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Nhật Ký Thực Thi Từng Phòng
                </h4>
              </div>

              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto thin-scroll">
                {Object.keys(resultsLog).length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Chưa có chu trình nào chạy. Hãy bấm <strong>"Khởi Động Robot Gửi Tự Động"</strong> để bắt đầu.
                  </div>
                ) : (
                  Object.values(resultsLog).map((log) => (
                    <div
                      key={log.roomId}
                      className="flex items-center justify-between p-3.5 px-4 text-xs transition-colors hover:bg-slate-50/80"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-900 w-14">
                          {log.roomId}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-800">
                            {log.tenant}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {log.phone}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-slate-600 max-w-xs truncate text-right">
                          {log.stepText}
                        </span>

                        {log.status === "PENDING" && (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            Chờ
                          </span>
                        )}
                        {log.status === "PROCESSING" && (
                          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Đang xử lý
                          </span>
                        )}
                        {log.status === "SUCCESS" && (
                          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Thành công
                          </span>
                        )}
                        {log.status === "FAILED" && (
                          <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 flex items-center gap-1" title={log.error}>
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Thất bại
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          /* TAB 2: XEM TRƯỚC TIN NHẮN & SOẠN THẢO */
          unpaidRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <h3 className="mt-3 text-base font-bold text-slate-800">
                Tuyệt vời! Không còn khách nào chưa thanh toán
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Toàn bộ các phòng có khách đã đóng tiền đầy đủ.
              </p>
            </div>
          ) : (
            <div className="flex flex-1 min-h-0 overflow-hidden divide-x divide-slate-100">
              {/* Cột trái: Danh sách phòng chưa đóng */}
              <div className="w-72 shrink-0 overflow-y-auto thin-scroll p-3 space-y-1.5 bg-slate-50/40">
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Chọn khách ({unpaidRooms.length})
                </p>

                {unpaidRooms.map((room) => {
                  const isSelected = activeRoom?.id === room.id;
                  const total = roomTotal(room, settings);

                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => setSelectedRoomId(room.id)}
                      className={cn(
                        "w-full rounded-2xl p-3 text-left transition-all border",
                        isSelected
                          ? "border-slate-900 bg-white shadow-sm ring-1 ring-slate-900"
                          : "border-slate-200/80 bg-white/70 hover:border-slate-300 hover:bg-white"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs">
                          {room.id}
                        </span>
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: STATUS_META[room.status].hex }}
                          title={STATUS_META[room.status].label}
                        />
                      </div>

                      <p className="mt-0.5 text-xs font-semibold text-slate-800 truncate">
                        {room.tenant}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate font-mono">
                        {room.phone}
                      </p>

                      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5 text-[11px]">
                        <span className="font-bold text-rose-600 tabular-nums">
                          {formatVND(total)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {room.reminderCount ? `Đã gửi ${room.reminderCount} lần` : "Chưa gửi"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Cột phải: Khung chi tiết tin nhắn, file Excel & VietQR */}
              {activeRoom && (
                <div className="flex-1 flex flex-col min-w-0 overflow-y-auto thin-scroll p-6 space-y-5">
                  {/* Khối Thông tin khách & Hành động gửi */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-slate-900">
                            Phòng {activeRoom.id}
                          </span>
                          <span className="text-xs text-slate-500">
                            (Tầng {activeRoom.floor} • {activeRoom.area} m²)
                          </span>
                          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            {STATUS_META[activeRoom.status].label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-700">
                          Khách thuê: <strong>{activeRoom.tenant}</strong>
                          {activeRoom.zaloName && ` (${activeRoom.zaloName})`} • SĐT Zalo:{" "}
                          <strong className="text-indigo-600 font-mono">{activeRoom.phone}</strong>
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-slate-500">Tổng phải thu</p>
                        <p className="text-xl font-black text-rose-600 tabular-nums">
                          {formatVND(roomTotal(activeRoom, settings))}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
                      <button
                        type="button"
                        onClick={() => handleDispatchSingleToZalo(activeRoom)}
                        className="inline-flex h-10 flex-1 min-w-[240px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-xs font-bold text-white shadow-sm hover:opacity-95 active:scale-95"
                        title="Tự động copy tin nhắn, tải file Excel và mở Zalo của khách"
                      >
                        <Send className="w-4 h-4 shrink-0" />
                        <span>Mở Zalo Khách & Tự Động Sao Chép Tin Nhắn</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-80" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleCopyText(
                            buildReminderMessage(activeRoom, settings),
                            activeRoom.id
                          )
                        }
                        className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-100 shadow-2xs"
                      >
                        <Copy className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {copiedId === activeRoom.id ? "Đã chép tin!" : "Chép tin nhắn"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* 2 Khối Tệp đính kèm: Excel Hóa đơn & Ảnh VietQR */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* File Excel */}
                    <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                          <FileSpreadsheet className="w-5 h-5 shrink-0" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-emerald-950 truncate">
                            Hoa-Don-Phong-{activeRoom.id}.xlsx
                          </p>
                          <p className="text-[11px] text-emerald-700">
                            Bảng tính chi tiết điện nước
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDownloadExcelInvoice(activeRoom)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-bold text-white hover:bg-emerald-700 shadow-2xs shrink-0 ml-2"
                        title="Tải file Excel hóa đơn về máy"
                      >
                        <Download className="w-3 h-3 shrink-0" />
                        <span>Tải file</span>
                      </button>
                    </div>

                    {/* Ảnh Phiếu Thu */}
                    <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/40 p-3.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white shadow-xs">
                          <ImageIcon className="w-5 h-5 shrink-0" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-amber-950 truncate">
                            Phieu-Thu-Phong-{activeRoom.id}.png
                          </p>
                          <p className="text-[11px] text-amber-700">
                            Ảnh phiếu thu có đóng dấu
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDownloadReceiptImage(activeRoom)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg bg-amber-600 px-2.5 text-[11px] font-bold text-white hover:bg-amber-700 shadow-2xs shrink-0 ml-2"
                        title="Tải ảnh phiếu thu PNG về máy"
                      >
                        <Download className="w-3 h-3 shrink-0" />
                        <span>Tải ảnh</span>
                      </button>
                    </div>
                  </div>

                  {/* Hộp Tin Nhắn Zalo Đã Soạn Sẵn */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
                        Nội dung tin nhắn Zalo đã được Robot tự động soạn:
                      </p>
                      <span className="text-[11px] text-slate-400">
                        Sẵn sàng gửi kèm link VietQR động
                      </span>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed shadow-inner max-h-72 overflow-y-auto thin-scroll">
                      {buildReminderMessage(activeRoom, settings)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 p-4 bg-slate-50/60">
          <p className="text-xs text-slate-500">
            {isDesktop ? (
              <span>
                🖥️ Chế độ Desktop Native: Robot Playwright tự động chạy ngầm và lưu hóa đơn tại thư mục <strong>Documents/QuanLyPhongTro/HoaDon/</strong>.
              </span>
            ) : (
              <span>
                🌐 Đang chạy trên trình duyệt Web. Để kích hoạt Robot tự động hóa Zalo 100% rảnh tay, hãy khởi chạy file <strong>.exe</strong> của phần mềm.
              </span>
            )}
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