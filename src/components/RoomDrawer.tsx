import { useState, useRef, useEffect, type ReactNode } from "react";
import {
  Copy,
  Droplets,
  Gauge,
  Home,
  Phone,
  Smartphone,
  Wifi,
  X,
  BedDouble,
  CheckCircle2,
  Send,
  Calendar,
  Sparkles,
  Edit3,
  MessageCircle,
  QrCode,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  Zap,
  Bot,
  CheckCheck,
  UserPlus,
  Trash2,
  AlertTriangle,
  Share2,
} from "lucide-react";
import type { Room, Settings } from "../types";
import {
  STATUS_META,
  addOneMonthVN,
  buildReminderMessage,
  buildVietQrUrl,
  downloadQrCodeImage,
  electricityAmount,
  formatNumber,
  formatVND,
  getDueStatusInfo,
  getTodayVN,
  roomTotal,
} from "../utils/format";
import { generateRoomInvoiceWorkbook } from "../utils/invoiceGenerator";
import {
  openZaloAppOrWeb,
  saveOrShareExcelWorkbook,
  triggerHaptic,
  isNativeMobile,
  callPhoneNumber,
  generateQrDataUrlLocal,
} from "../utils/platformBridge";
import { cn } from "../utils/cn";

interface Props {
  room: Room | null;
  settings: Settings;
  onClose: () => void;
  onCopyReminder: (room: Room) => void;
  onOpenZalo: (room: Room) => void;
  onConfirmPayment: (roomId: string) => void;
  onUpdateElectricNew: (roomId: string, newElectric: number) => void;
  onUpdateRoomDetails: (roomId: string, updates: Partial<Room>) => void;
  onSendZaloMessage: (room: Room) => void;
  onDownloadExcelInvoice?: (room: Room) => void;
  onDownloadReceiptImage?: (room: Room) => void;
  onRemoveTenant?: (roomId: string) => void;
  onDeleteRoom?: (roomId: string) => void;
}

function Row({
  icon,
  label,
  sub,
  value,
  action,
}: {
  icon: ReactNode;
  label: string;
  sub?: string;
  value: string;
  action?: ReactNode;
}) {
  return (
    <div className="py-2.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-800">{label}</p>
          {sub && <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>}
        </div>
        <p className="shrink-0 text-xs font-semibold tabular-nums text-slate-900">{value}</p>
      </div>
      {action && <div className="mt-2 pl-10">{action}</div>}
    </div>
  );
}

export default function RoomDrawer({
  room,
  settings,
  onClose,
  onCopyReminder,
  onOpenZalo,
  onConfirmPayment,
  onUpdateElectricNew,
  onUpdateRoomDetails,
  onSendZaloMessage,
  onDownloadExcelInvoice,
  onDownloadReceiptImage,
  onRemoveTenant,
  onDeleteRoom,
}: Props) {
  const lastRef = useRef<Room | null>(null);
  if (room) lastRef.current = room;
  const shown = room ?? lastRef.current;
  const open = room !== null;

  const [isEditingTenant, setIsEditingTenant] = useState(false);
  const [draftTenant, setDraftTenant] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [draftZaloName, setDraftZaloName] = useState("");
  const [draftIdCard, setDraftIdCard] = useState("");
  const [draftZaloNote, setDraftZaloNote] = useState("");
  const [draftRoomFee, setDraftRoomFee] = useState<number>(3000000);
  const [draftStartDate, setDraftStartDate] = useState("");
  const [draftDueDate, setDraftDueDate] = useState("");
  const [showPreviewMessage, setShowPreviewMessage] = useState(false);
  const [offlineQr, setOfflineQr] = useState<string>("");

  // Hộp thoại xác nhận xóa
  const [confirmDeleteTenant, setConfirmDeleteTenant] = useState(false);
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState(false);

  const startEdit = () => {
    if (!shown) return;
    setDraftTenant(shown.tenant || "");
    setDraftPhone(shown.phone || "");
    setDraftZaloName(shown.zaloName || "");
    setDraftIdCard(shown.idCard || "");
    setDraftZaloNote(shown.zaloNote || "");
    setDraftRoomFee(shown.roomFee || 3000000);
    setDraftStartDate(shown.startDate || getTodayVN());
    setDraftDueDate(shown.dueDate && shown.dueDate !== "--" ? shown.dueDate : addOneMonthVN(getTodayVN()));
    setIsEditingTenant(true);
    setConfirmDeleteTenant(false);
  };

  const saveEdit = () => {
    if (!shown) return;
    const hasTenant = draftTenant.trim().length > 0;
    onUpdateRoomDetails(shown.id, {
      tenant: draftTenant.trim(),
      phone: draftPhone.trim(),
      zaloName: draftZaloName.trim() || undefined,
      idCard: draftIdCard.trim() || undefined,
      zaloNote: draftZaloNote.trim() || undefined,
      roomFee: draftRoomFee > 0 ? draftRoomFee : shown.roomFee,
      startDate: hasTenant ? draftStartDate.trim() : undefined,
      dueDate: hasTenant ? draftDueDate.trim() : "--",
      status: !hasTenant ? "EMPTY" : shown.status === "EMPTY" ? "PENDING" : shown.status,
    });
    setIsEditingTenant(false);
  };

  const handleExecuteRemoveTenant = () => {
    if (!shown) return;
    if (onRemoveTenant) {
      onRemoveTenant(shown.id);
    } else {
      onUpdateRoomDetails(shown.id, {
        tenant: "",
        phone: "",
        zaloName: undefined,
        idCard: undefined,
        zaloNote: undefined,
        startDate: undefined,
        dueDate: "--",
        status: "EMPTY",
        invoiceIssued: false,
        reminderCount: 0,
      });
    }
    setConfirmDeleteTenant(false);
    setIsEditingTenant(false);
  };

  const handleExecuteDeleteRoom = () => {
    if (!shown) return;
    if (onDeleteRoom) {
      onDeleteRoom(shown.id);
    }
    setConfirmDeleteRoom(false);
    onClose();
  };

  const handleRenewOneMonth = () => {
    if (!shown) return;
    const today = getTodayVN();
    const nextDue = addOneMonthVN(today);
    onUpdateRoomDetails(shown.id, {
      startDate: today,
      dueDate: nextDue,
      status: "PENDING",
      invoiceIssued: false,
    });
  };

  // Chia sẻ hoặc Tải file Excel đa nền tảng
  const handleShareOrDownloadExcel = async () => {
    if (!shown) return;
    if (onDownloadExcelInvoice) {
      onDownloadExcelInvoice(shown);
    }
    const wb = generateRoomInvoiceWorkbook(shown, settings);
    const month = new Date().toISOString().slice(0, 7);
    await saveOrShareExcelWorkbook({
      fileName: `Hoa-Don-Phong-${shown.id}.xlsx`,
      monthFolder: month,
      workbook: wb,
    });
  };

  const isEmpty = shown?.status === "EMPTY" || !shown?.tenant;
  const meta = shown ? STATUS_META[shown.status] : null;
  const kwh = shown ? Math.max(0, shown.electricNew - shown.electricOld) : 0;
  const total = shown ? roomTotal(shown, settings) : 0;
  const isPaid = shown?.status === "PAID";
  const dueInfo = shown ? getDueStatusInfo(shown.dueDate) : null;
  const displayQr = offlineQr;
  const composedMessage = shown ? buildReminderMessage(shown, settings) : "";

  useEffect(() => {
    if (!shown || !shown.tenant) return;
    const memo = `THANHTOAN ${shown.id}`;
    const fallbackText = `STK:${settings.accountNumber}|NH:${settings.bankName}|CHU:${settings.accountName}|TIEN:${total}|ND:${memo}`;
    generateQrDataUrlLocal(fallbackText).then((dataUrl) => {
      if (dataUrl) setOfflineQr(dataUrl);
    });
  }, [shown, total, settings]);

  return (
    <>
      {/* Mobile Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-xs md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        aria-hidden={!open}
        className={cn(
          "fixed z-50 flex flex-col bg-white shadow-2xl transition-transform duration-300 ease-out",
          // Mobile: Bottom Sheet trượt từ đáy lên
          "inset-x-0 bottom-0 max-h-[88dvh] w-full rounded-t-3xl border-t border-slate-200 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]",
          open ? "translate-y-0" : "translate-y-full pointer-events-none",
          // Desktop: Side-drawer bên phải
          "md:inset-auto md:right-0 md:top-[72px] md:bottom-auto md:h-[calc(100dvh-72px)] md:w-[420px] md:rounded-none md:border-l md:border-t-0 md:pb-0 md:translate-y-0",
          open ? "md:translate-x-0 md:pointer-events-auto" : "md:translate-x-full md:pointer-events-none"
        )}
      >
        {/* Mobile Drag Handle */}
        <div className="w-full pt-3 pb-1 flex justify-center md:hidden" onClick={onClose}>
          <div className="h-1.5 w-12 rounded-full bg-slate-300 active:scale-95 transition-transform" />
        </div>

        {shown && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-3.5 md:py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  Chi tiết phòng & Khách thuê
                </p>
                <div className="mt-1 flex items-center gap-2.5">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">{shown.id}</h2>
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                      meta?.badge
                    )}
                  >
                    {meta?.label}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Tầng {shown.floor} • {shown.area} m²
                </p>
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

            <div className="thin-scroll flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Người thuê & Thông tin Zalo */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                        isEmpty ? "bg-slate-200 text-slate-500" : "bg-emerald-100 text-emerald-700"
                      )}
                    >
                      {isEmpty ? <BedDouble className="w-4 h-4 shrink-0" /> : shown.tenant.split(" ").slice(-1)[0]?.charAt(0) || "P"}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {isEmpty ? "Phòng đang trống" : shown.tenant}
                      </p>
                      {shown.zaloName && !isEmpty && (
                        <p className="text-[11px] font-medium text-indigo-600">Zalo: {shown.zaloName}</p>
                      )}
                    </div>
                  </div>

                  {!isEditingTenant && (
                    <div className="flex items-center gap-1">
                      {!isEmpty ? (
                        <>
                          <button
                            type="button"
                            onClick={startEdit}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 active:scale-95"
                            title="Chỉnh sửa thông tin khách thuê"
                          >
                            <Edit3 className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                            <span>Sửa</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteTenant(true)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 active:scale-95"
                            title="Xóa khách thuê khỏi phòng (Trả phòng)"
                          >
                            <Trash2 className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                            <span>Xóa khách</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={startEdit}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 active:scale-95 shadow-2xs"
                        >
                          <UserPlus className="w-3.5 h-3.5 shrink-0" />
                          <span>Thêm khách</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Hộp thoại xác nhận xóa khách thuê */}
                {confirmDeleteTenant && (
                  <div className="my-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs animate-in fade-in duration-150">
                    <div className="flex items-start gap-2 text-rose-900 font-semibold mb-1">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>Xác nhận xóa khách & Trả phòng?</span>
                    </div>
                    <p className="text-[11px] text-rose-700 leading-relaxed mb-3">
                      Xóa thông tin khách <strong>{shown.tenant}</strong>. Phòng {shown.id} sẽ chuyển về trạng thái <strong>Trống</strong> và hủy công nợ hiện tại.
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteTenant(false)}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleExecuteRemoveTenant}
                        className="rounded-lg bg-rose-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-rose-700"
                      >
                        Đồng ý xóa khách
                      </button>
                    </div>
                  </div>
                )}

                {/* Hiển thị thông tin khách nếu không ở chế độ sửa */}
                {!isEditingTenant && !isEmpty && (
                  <div className="mt-2 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span>SĐT Zalo:</span>
                      </span>
                      {shown.phone ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openZaloAppOrWeb(shown.phone)}
                            className="font-bold text-blue-600 hover:underline flex items-center gap-1 font-mono"
                            title="Bấm để mở Zalo chat"
                          >
                            {shown.phone}
                            <MessageCircle className="w-3 h-3 shrink-0" />
                          </button>
                          <button
                            type="button"
                            onClick={() => callPhoneNumber(shown.phone)}
                            className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Bấm để gọi điện"
                          >
                            <Phone className="w-3 h-3 shrink-0" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400">Chưa có</span>
                      )}
                    </div>

                    {shown.idCard && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-500">Số CCCD:</span>
                        <span className="font-semibold text-slate-800 font-mono">{shown.idCard}</span>
                      </div>
                    )}

                    {shown.zaloNote && (
                      <div className="rounded-lg bg-white/80 p-2 text-[11px] text-slate-600 border border-slate-100 mt-1.5">
                        <span className="font-bold text-slate-700">Ghi chú Zalo: </span>
                        {shown.zaloNote}
                      </div>
                    )}
                  </div>
                )}

                {/* Khối mời thêm khách khi phòng trống */}
                {!isEditingTenant && isEmpty && (
                  <div className="mt-3 rounded-xl border border-dashed border-emerald-300 bg-white p-3 text-center">
                    <p className="text-xs font-semibold text-slate-700">Chưa có khách thuê phòng này</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 mb-2.5">
                      Giá thuê đề xuất: {formatVND(shown.roomFee)}/tháng
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={startEdit}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 active:scale-95"
                      >
                        <UserPlus className="w-3.5 h-3.5 shrink-0" />
                        <span>+ Thêm Khách Mới</span>
                      </button>
                      {onDeleteRoom && (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteRoom(true)}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50/50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-100"
                          title="Xóa phòng trống này khỏi tòa nhà 3D"
                        >
                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Xóa phòng</span>
                        </button>
                      )}
                    </div>

                    {confirmDeleteRoom && (
                      <div className="mt-3 border-t border-rose-200 pt-2 text-left">
                        <p className="text-[11px] font-bold text-rose-700 mb-1.5">
                          Xác nhận xóa hẳn phòng {shown.id} khỏi tòa nhà?
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteRoom(false)}
                            className="rounded-lg border px-2 py-0.5 text-[10px] text-slate-600"
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            onClick={handleExecuteDeleteRoom}
                            className="rounded-lg bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white"
                          >
                            Xác nhận xóa
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Form sửa / thêm thông tin khách */}
                {isEditingTenant && (
                  <div className="mt-2.5 space-y-2 border-t border-slate-200 pt-2 text-xs">
                    <div>
                      <label className="font-semibold text-slate-700">Tên khách thuê <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        value={draftTenant}
                        onChange={(e) => setDraftTenant(e.target.value)}
                        placeholder="Nhập họ và tên khách"
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-emerald-500 shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700">Số điện thoại Zalo <span className="text-rose-500">*</span></label>
                      <input
                        type="tel"
                        value={draftPhone}
                        onChange={(e) => setDraftPhone(e.target.value)}
                        placeholder="0912345678"
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-mono outline-none focus:border-emerald-500 shadow-2xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-semibold text-slate-700">Nick / Tên Zalo</label>
                        <input
                          type="text"
                          value={draftZaloName}
                          onChange={(e) => setDraftZaloName(e.target.value)}
                          placeholder="VD: Van An"
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-emerald-500 shadow-2xs"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700">Số CCCD / CMND</label>
                        <input
                          type="text"
                          value={draftIdCard}
                          onChange={(e) => setDraftIdCard(e.target.value)}
                          placeholder="Số căn cước"
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-mono outline-none focus:border-emerald-500 shadow-2xs"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-semibold text-slate-700">Tiền phòng (VNĐ)</label>
                        <input
                          type="number"
                          min={0}
                          step={50000}
                          value={draftRoomFee}
                          onChange={(e) => setDraftRoomFee(Number(e.target.value))}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-rose-600 outline-none focus:border-emerald-500 shadow-2xs"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700">Hạn thanh toán</label>
                        <input
                          type="text"
                          value={draftDueDate}
                          onChange={(e) => setDraftDueDate(e.target.value)}
                          placeholder="dd/mm/yyyy"
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-emerald-500 shadow-2xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700">Ghi chú thêm về khách</label>
                      <input
                        type="text"
                        value={draftZaloNote}
                        onChange={(e) => setDraftZaloNote(e.target.value)}
                        placeholder="Quê quán, nghề nghiệp, nơi làm..."
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-emerald-500 shadow-2xs"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingTenant(false)}
                        className="rounded-lg border px-3 py-1 text-slate-600 hover:bg-slate-100"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={saveEdit}
                        className="rounded-lg bg-emerald-600 px-4 py-1 font-bold text-white hover:bg-emerald-700 shadow-2xs"
                      >
                        Lưu Thông Tin
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Chu kỳ 1 tháng */}
              {!isEmpty && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                      <Calendar className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                      Chu kỳ thanh toán 1 tháng
                    </p>
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                        dueInfo?.isOverdue
                          ? "bg-rose-50 text-rose-700 ring-rose-200"
                          : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      )}
                    >
                      {dueInfo?.label}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs text-slate-700">
                    <div>
                      <span className="text-slate-500">Từ: </span>
                      <span className="font-bold">{shown.startDate || "Bắt đầu"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Đến hạn: </span>
                      <span className="font-bold text-slate-900">{shown.dueDate}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRenewOneMonth}
                    className="mt-2.5 flex h-7 w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-white text-[11px] font-bold text-emerald-800 shadow-2xs hover:bg-emerald-50 active:scale-95"
                  >
                    <Sparkles className="w-3 h-3 shrink-0 text-emerald-600" />
                    <span>Tự động gia hạn chu kỳ 1 tháng tiếp theo</span>
                  </button>
                </div>
              )}

              {/* Chi phí tháng này */}
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  Chi phí tháng này
                </p>
                <div className="divide-y divide-slate-100">
                  <Row
                    icon={<Home className="w-4 h-4 shrink-0" />}
                    label="Tiền phòng"
                    value={formatVND(shown.roomFee)}
                  />

                  <Row
                    icon={<Gauge className="w-4 h-4 shrink-0" />}
                    label="Tiền điện"
                    sub={`Cũ ${formatNumber(shown.electricOld)} → Mới ${formatNumber(shown.electricNew)} kWh · (${formatNumber(shown.electricNew)} − ${formatNumber(shown.electricOld)}) × ${formatNumber(settings.electricUnitPrice)}đ`}
                    value={formatVND(electricityAmount(shown, settings.electricUnitPrice))}
                    action={
                      !isEmpty ? (
                        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 text-xs">
                          <span className="font-semibold text-slate-600">Sửa số mới:</span>
                          <input
                            type="number"
                            min={shown.electricOld}
                            value={shown.electricNew}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (!Number.isNaN(val)) {
                                onUpdateElectricNew(shown.id, val);
                              }
                            }}
                            className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500"
                          />
                          <span className="text-slate-400">kWh</span>
                        </div>
                      ) : undefined
                    }
                  />

                  <Row
                    icon={<Droplets className="w-4 h-4 shrink-0" />}
                    label="Tiền nước"
                    value={formatVND(shown.waterFee)}
                  />
                  <Row
                    icon={<Wifi className="w-4 h-4 shrink-0" />}
                    label="Internet"
                    value={formatVND(shown.internetFee)}
                  />
                </div>
                {!isEmpty && (
                  <p className="mt-1 text-[11px] text-slate-400">Tiêu thụ điện: {formatNumber(kwh)} kWh</p>
                )}
              </div>

              {/* Tổng thanh toán */}
              <div className="rounded-2xl bg-slate-900 p-4 text-white shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-300">Tổng thanh toán</p>
                  <p className="text-xs text-slate-400">Hạn: {shown.dueDate}</p>
                </div>
                <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">
                  {formatVND(total)}
                </p>
                {shown.invoiceIssued && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    Hóa đơn điện tử đã xuất
                  </p>
                )}
              </div>

              {/* Nút Xác nhận đã thu tiền */}
              {!isEmpty && !isPaid && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("success");
                    onConfirmPayment(shown.id);
                  }}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white shadow-sm shadow-emerald-200 transition-all hover:bg-emerald-700 active:scale-[0.98]"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Xác nhận đã thu tiền</span>
                </button>
              )}

              {/* KHUNG TỰ ĐỘNG SOẠN TIN NHẮN THU TIỀN KÈM MÃ QR */}
              {!isEmpty && (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <QrCode className="w-4 h-4 shrink-0 text-indigo-600" />
                      <p className="text-xs font-bold text-slate-900">
                        Tin nhắn tự động kèm mã QR Zalo
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPreviewMessage((p) => !p)}
                      className="text-[11px] font-bold text-indigo-600 hover:underline"
                    >
                      {showPreviewMessage ? "Thu gọn" : "Xem nội dung"}
                    </button>
                  </div>

                  <div className="mt-3 flex items-center gap-3 bg-white p-2.5 rounded-xl border border-indigo-100 shadow-2xs">
                    {displayQr ? (
                      <img
                        src={displayQr}
                        alt={`VietQR ${shown.id}`}
                        className="h-16 w-16 shrink-0 rounded-lg border border-slate-200 object-contain bg-white"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-400">
                        <QrCode className="w-8 h-8 opacity-40 animate-pulse" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="font-bold text-slate-900 truncate">Mã VietQR động: {formatVND(total)}</p>
                      <p className="text-[11px] text-slate-500 truncate">{settings.bankName} • {settings.accountNumber}</p>
                      <button
                        type="button"
                        onClick={() => downloadQrCodeImage(shown, settings)}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800"
                      >
                        <Download className="w-3 h-3 shrink-0" />
                        <span>Tải ảnh mã QR về máy</span>
                      </button>
                    </div>
                  </div>

                  {showPreviewMessage && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-[11px] font-mono leading-relaxed text-slate-700 whitespace-pre-wrap max-h-48 overflow-y-auto thin-scroll shadow-inner">
                      {composedMessage}
                    </div>
                  )}
                </div>
              )}

              {/* TÀI LIỆU HÓA ĐƠN & ẢNH PHIẾU THU TỰ ĐỘNG BỞI AI AGENT */}
              {!isEmpty && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Bot className="w-4 h-4 shrink-0 text-amber-600" />
                      <p className="text-xs font-bold text-amber-950">
                        Hóa đơn & Ảnh phiếu thu tự động
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      <CheckCheck className="w-3 h-3 shrink-0" />
                      Agent đã tạo
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-600 bg-white p-2 rounded-xl border border-amber-100">
                    <span className="flex items-center gap-1 font-semibold text-slate-700">
                      <Zap className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      Agent Thu Tiền Tự Động:
                    </span>
                    <span className="font-bold text-slate-800">
                      {shown.reminderCount || 0} lần gửi Zalo
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleShareOrDownloadExcel}
                      className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors shadow-2xs"
                      title="Tải hoặc chia sẻ file Excel hóa đơn"
                    >
                      {isNativeMobile() ? (
                        <>
                          <Share2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                          <span>Gửi Zalo Excel (.xlsx)</span>
                        </>
                      ) : (
                        <>
                          <FileSpreadsheet className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                          <span>Tải Excel HĐ (.xlsx)</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onDownloadReceiptImage?.(shown)}
                      className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-2.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors shadow-2xs"
                      title="Tải ảnh phiếu thu PNG có dấu xác thực và mã VietQR"
                    >
                      <ImageIcon className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                      <span>Tải Ảnh Thu (PNG)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Actions: Gửi Zalo kèm QR, Copy tin nhắn + QR, Xem phiếu thu */}
            <div className="space-y-2 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                disabled={isEmpty || !shown.phone}
                onClick={() => {
                  triggerHaptic("medium");
                  onSendZaloMessage(shown);
                }}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-sm font-bold text-white shadow-sm shadow-emerald-200 transition-all hover:opacity-95 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                title="Tự động sao chép tin nhắn kèm mã VietQR và mở Zalo gửi trực tiếp cho người thuê"
              >
                <Send className="w-4 h-4 shrink-0" />
                <span>Tự động gửi Zalo kèm mã QR</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isEmpty}
                  onClick={() => {
                    triggerHaptic("light");
                    onCopyReminder(shown);
                  }}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Sao chép tin nhắn đã tự động soạn kèm link ảnh mã QR"
                >
                  <Copy className="w-4 h-4 shrink-0" />
                  <span>Chép tin + QR</span>
                </button>

                <button
                  type="button"
                  disabled={isEmpty}
                  onClick={() => {
                    triggerHaptic("light");
                    onOpenZalo(shown);
                  }}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#0068FF] text-xs font-semibold text-white shadow-sm shadow-blue-200 transition-colors hover:bg-[#0058dc] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span>Phiếu thu Zalo</span>
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}