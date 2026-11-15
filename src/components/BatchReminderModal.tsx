import { Copy, MessageSquareWarning, X, Check, Smartphone, Send, Download } from "lucide-react";
import { useState } from "react";
import type { Room, Settings } from "../types";
import {
  buildReminderMessage,
  buildVietQrUrl,
  downloadQrCodeImage,
  formatVND,
  getDueStatusInfo,
  roomTotal,
  STATUS_META,
} from "../utils/format";
import { cn } from "../utils/cn";

interface Props {
  rooms: Room[];
  settings: Settings;
  onClose: () => void;
  onCopyAll: (text: string) => void;
  onCopySingle: (room: Room) => void;
  onSendZaloMessage: (room: Room) => void;
  onOpenZalo: (room: Room) => void;
  onAutoSendAllZalo: () => void;
}

export default function BatchReminderModal({
  rooms,
  settings,
  onClose,
  onCopyAll,
  onCopySingle,
  onSendZaloMessage,
  onOpenZalo,
  onAutoSendAllZalo,
}: Props) {
  const [copiedAll, setCopiedAll] = useState(false);

  // Lọc các phòng chưa thanh toán (PENDING hoặc OVERDUE) và có khách
  const unpaidRooms = rooms.filter(
    (r) => r.status !== "EMPTY" && r.status !== "PAID"
  );

  const totalDebt = unpaidRooms.reduce((sum, r) => sum + roomTotal(r, settings), 0);

  const handleCopyAll = () => {
    if (unpaidRooms.length === 0) return;
    const combinedMessage = unpaidRooms
      .map((r, idx) => `[${idx + 1}/${unpaidRooms.length}] ${buildReminderMessage(r, settings)}`)
      .join("\n\n" + "=".repeat(40) + "\n\n");

    onCopyAll(combinedMessage);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nhắc nợ hàng loạt qua Zalo"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-3xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
              <MessageSquareWarning className="w-5 h-5 shrink-0" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Tự Động Soạn Tin Nhắn & Mã QR Nhắc Nợ Zalo
              </h2>
              <p className="text-xs text-slate-500">
                Tin nhắn đã tự động kèm link ảnh VietQR động & cú pháp chuyển khoản chính xác cho từng phòng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="w-4 h-4 shrink-0" />
          </button>
        </div>

        {/* Thống kê nhanh */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-3.5">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-slate-500">Số phòng đang nợ: </span>
              <span className="font-bold text-slate-900">{unpaidRooms.length} phòng</span>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <div>
              <span className="text-slate-500">Tổng tiền công nợ: </span>
              <span className="font-bold text-rose-600">{formatVND(totalDebt)}</span>
            </div>
          </div>

          <button
            type="button"
            disabled={unpaidRooms.length === 0}
            onClick={handleCopyAll}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-xl px-4 text-xs font-bold transition-all shadow-sm active:scale-95",
              copiedAll
                ? "bg-emerald-600 text-white"
                : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {copiedAll ? (
              <>
                <Check className="w-4 h-4 shrink-0" />
                Đã chép toàn bộ kèm mã QR!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 shrink-0" />
                Sao chép tất cả ({unpaidRooms.length} tin + QR)
              </>
            )}
          </button>
        </div>

        {/* Danh sách phòng nợ */}
        <div className="thin-scroll flex-1 overflow-y-auto p-6">
          {unpaidRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Check className="w-6 h-6 shrink-0" />
              </div>
              <p className="mt-3 text-sm font-bold text-slate-800">
                Tuyệt vời! Không có phòng nào đang nợ phí
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Toàn bộ các phòng có khách đã thanh toán đầy đủ hóa đơn tháng này.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {unpaidRooms.map((r) => {
                const total = roomTotal(r, settings);
                const meta = STATUS_META[r.status];
                const dueInfo = getDueStatusInfo(r.dueDate);
                const qrUrl = buildVietQrUrl(r, settings);

                return (
                  <div
                    key={r.id}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {/* Mã QR thu nhỏ */}
                      <div className="relative group shrink-0">
                        <img
                          src={qrUrl}
                          alt={`QR ${r.id}`}
                          className="h-12 w-12 rounded-xl border border-slate-200 object-contain bg-white p-0.5"
                        />
                        <button
                          type="button"
                          onClick={() => downloadQrCodeImage(r, settings)}
                          className="absolute inset-0 flex items-center justify-center bg-slate-900/60 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity text-white"
                          title="Tải ảnh QR"
                        >
                          <Download className="w-4 h-4 shrink-0" />
                        </button>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">Phòng {r.id}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-sm font-bold text-slate-800">{r.tenant}</span>
                          {r.zaloName && (
                            <span className="text-[11px] text-blue-600 font-medium">({r.zaloName})</span>
                          )}
                          <span
                            className={cn(
                              "rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                              meta.badge
                            )}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500 flex items-center gap-2">
                          <span>Zalo: {r.phone || "--"}</span>
                          <span>• Hạn: {r.dueDate}</span>
                          <span className={dueInfo.isOverdue ? "font-bold text-rose-600" : "text-emerald-700"}>
                            ({dueInfo.label})
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <p className="text-base font-bold tabular-nums text-rose-600">
                        {formatVND(total)}
                      </p>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSendZaloMessage(r)}
                          disabled={!r.phone}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                          title="Tự động mở Zalo gửi tin nhắn kèm mã VietQR"
                        >
                          <Send className="w-3.5 h-3.5 shrink-0" />
                          <span>Gửi Zalo + QR</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenZalo(r)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                          title="Xem phiếu thu Zalo Mini App"
                        >
                          <Smartphone className="w-4 h-4 shrink-0 text-blue-600" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onCopySingle(r)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95"
                          title="Sao chép tin nhắn kèm link ảnh mã QR"
                        >
                          <Copy className="w-3.5 h-3.5 shrink-0" />
                          <span>Chép tin</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 p-4 bg-slate-50/50">
          <button
            type="button"
            onClick={onAutoSendAllZalo}
            disabled={unpaidRooms.length === 0}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 px-4 text-xs font-bold text-white shadow-sm transition hover:opacity-95 active:scale-95 disabled:opacity-50"
            title="Cho Agent tự động gửi tin nhắn kèm mã VietQR tới tất cả các phòng đang nợ"
          >
            <Send className="w-4 h-4 shrink-0 text-white" />
            <span>🤖 Cho Agent Gửi Zalo Tự Động Toàn Bộ (100% Rảnh Tay)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl bg-slate-900 px-5 text-xs font-bold text-white hover:bg-slate-800"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
