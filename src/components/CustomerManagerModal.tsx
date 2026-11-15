import { useState, useMemo } from "react";
import {
  Users,
  UserPlus,
  UserMinus,
  Edit3,
  Search,
  X,
  Phone,
  MessageCircle,
  FileSpreadsheet,
  Calendar,
  AlertTriangle,
  Save,
  Trash2,
  Plus,
  ExternalLink,
} from "lucide-react";
import * as XLSX from "xlsx";
import type { Room, Settings } from "../types";
import {
  addOneMonthVN,
  buildZaloChatUrl,
  formatVND,
  getTodayVN,
  roomTotal,
  STATUS_META,
} from "../utils/format";
import { cn } from "../utils/cn";

interface Props {
  rooms: Room[];
  settings: Settings;
  onClose: () => void;
  onUpdateRoomDetails: (roomId: string, updates: Partial<Room>) => void;
  onRemoveTenant: (roomId: string) => void;
  onSelectRoom: (roomId: string) => void;
}

export default function CustomerManagerModal({
  rooms,
  settings,
  onClose,
  onUpdateRoomDetails,
  onRemoveTenant,
  onSelectRoom,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "HAS_TENANT" | "EMPTY" | "UNPAID">("ALL");

  // Form Thêm/Sửa Khách Hàng
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string>("");
  const [formData, setFormData] = useState({
    roomId: "",
    tenant: "",
    phone: "",
    zaloName: "",
    idCard: "",
    zaloNote: "",
    roomFee: 3000000,
    startDate: getTodayVN(),
    dueDate: addOneMonthVN(getTodayVN()),
  });

  // Hộp thoại xác nhận xóa khách
  const [confirmDeleteRoomId, setConfirmDeleteRoomId] = useState<string | null>(null);

  // Thống kê
  const totalRooms = rooms.length;
  const roomsWithTenant = rooms.filter((r) => r.status !== "EMPTY" && r.tenant);
  const emptyRooms = rooms.filter((r) => r.status === "EMPTY" || !r.tenant);

  // Danh sách phòng lọc theo tìm kiếm và tab
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      // Bộ lọc tab
      if (statusFilter === "HAS_TENANT" && (r.status === "EMPTY" || !r.tenant)) return false;
      if (statusFilter === "EMPTY" && r.status !== "EMPTY" && r.tenant) return false;
      if (statusFilter === "UNPAID" && (r.status === "EMPTY" || r.status === "PAID")) return false;

      // Bộ lọc từ khóa tìm kiếm
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchRoom = r.id.toLowerCase().includes(q);
      const matchTenant = r.tenant.toLowerCase().includes(q);
      const matchPhone = r.phone.toLowerCase().includes(q);
      const matchZaloName = (r.zaloName || "").toLowerCase().includes(q);
      const matchIdCard = (r.idCard || "").toLowerCase().includes(q);
      const matchNote = (r.zaloNote || "").toLowerCase().includes(q);

      return matchRoom || matchTenant || matchPhone || matchZaloName || matchIdCard || matchNote;
    });
  }, [rooms, searchQuery, statusFilter]);

  // Mở form thêm khách mới vào một phòng
  const handleOpenAdd = (targetRoomId?: string) => {
    const roomToUse =
      (targetRoomId && rooms.find((r) => r.id === targetRoomId)) ||
      emptyRooms[0] ||
      rooms[0];

    const today = getTodayVN();
    setEditingRoomId("");
    setFormData({
      roomId: roomToUse?.id || "P101",
      tenant: "",
      phone: "",
      zaloName: "",
      idCard: "",
      zaloNote: "",
      roomFee: roomToUse?.roomFee || 3200000,
      startDate: today,
      dueDate: addOneMonthVN(today),
    });
    setIsFormOpen(true);
  };

  // Mở form sửa khách hiện tại
  const handleOpenEdit = (room: Room) => {
    setEditingRoomId(room.id);
    setFormData({
      roomId: room.id,
      tenant: room.tenant || "",
      phone: room.phone || "",
      zaloName: room.zaloName || "",
      idCard: room.idCard || "",
      zaloNote: room.zaloNote || "",
      roomFee: room.roomFee || 3000000,
      startDate: room.startDate || getTodayVN(),
      dueDate: room.dueDate || addOneMonthVN(getTodayVN()),
    });
    setIsFormOpen(true);
  };

  // Lưu thông tin khách hàng
  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tenant.trim()) {
      alert("Vui lòng nhập họ và tên khách thuê!");
      return;
    }
    if (!formData.phone.trim()) {
      alert("Vui lòng nhập số điện thoại Zalo của khách thuê!");
      return;
    }

    const targetId = editingRoomId || formData.roomId;
    const targetRoom = rooms.find((r) => r.id === targetId);
    if (!targetRoom) return;

    onUpdateRoomDetails(targetId, {
      tenant: formData.tenant.trim(),
      phone: formData.phone.trim(),
      zaloName: formData.zaloName.trim() || undefined,
      idCard: formData.idCard.trim() || undefined,
      zaloNote: formData.zaloNote.trim() || undefined,
      roomFee: Number(formData.roomFee) || targetRoom.roomFee,
      startDate: formData.startDate.trim(),
      dueDate: formData.dueDate.trim(),
      status: targetRoom.status === "EMPTY" ? "PENDING" : targetRoom.status,
    });

    setIsFormOpen(false);
  };

  // Xóa khách (Trả phòng)
  const handleConfirmDelete = () => {
    if (!confirmDeleteRoomId) return;
    onRemoveTenant(confirmDeleteRoomId);
    setConfirmDeleteRoomId(null);
  };

  // Xuất danh bạ khách thuê ra Excel
  const handleExportCustomersExcel = () => {
    const data: (string | number)[][] = [
      ["DANH BÁ KHÁCH THUÊ TÒA NHÀ - AN GIA SMART HOME 3D"],
      [`Ngày kết xuất: ${new Date().toLocaleDateString("vi-VN")}`],
      [""],
      [
        "STT",
        "Mã phòng",
        "Tầng",
        "Diện tích (m²)",
        "Họ và tên khách thuê",
        "SĐT Zalo",
        "Tên Nick Zalo",
        "Số CCCD/CMND",
        "Tiền phòng/tháng (VNĐ)",
        "Ngày vào ở",
        "Hạn thanh toán",
        "Trạng thái đóng tiền",
        "Ghi chú",
      ],
    ];

    let stt = 1;
    for (const r of rooms) {
      data.push([
        stt++,
        r.id,
        r.floor,
        r.area,
        r.tenant || "(Phòng trống)",
        r.phone || "--",
        r.zaloName || "--",
        r.idCard || "--",
        r.roomFee,
        r.startDate || "--",
        r.dueDate || "--",
        STATUS_META[r.status].label,
        r.zaloNote || "",
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [
      { wch: 6 },
      { wch: 12 },
      { wch: 8 },
      { wch: 14 },
      { wch: 26 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 20 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 28 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Danh-Ba-Khach-Thue");
    XLSX.writeFile(wb, `Danh-Ba-Khach-Thue-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quản lý khách hàng & khách thuê"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-5xl flex-col rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-100 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-0"
      >
        {/* Mobile Drag Handle */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-500/50 rounded-full mx-auto my-2 shrink-0" />

        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-900/40">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Quản Lý Khách Hàng & Danh Bạ
                </h2>
                <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300 ring-1 ring-indigo-500/40">
                  {roomsWithTenant.length}/{totalRooms} phòng
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-300 line-clamp-1 sm:line-clamp-none">
                Thêm khách thuê mới vào phòng trống, chỉnh sửa Zalo / CCCD và xóa khách trả phòng
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleExportCustomersExcel}
              className="hidden sm:inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-bold text-white shadow-xs backdrop-blur-sm hover:bg-white/20 active:scale-95"
              title="Xuất toàn bộ danh bạ khách thuê ra file Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0 text-emerald-300" />
              <span>Xuất Excel</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenAdd()}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-3 sm:px-3.5 text-xs font-bold text-white shadow-sm hover:opacity-95 active:scale-95"
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">+ Thêm Khách Mới</span>
              <span className="sm:hidden">+ Thêm</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white active:scale-95 transition-all"
            >
              <X className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>

        {/* Thanh tìm kiếm & Bộ lọc nhanh */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-3 gap-3">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên khách, SĐT, mã phòng hoặc CCCD..."
              className="w-full h-9 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500 shadow-2xs"
            />
          </div>

          {/* Các nút Tab bộ lọc */}
          <div className="flex rounded-xl bg-slate-200/70 p-0.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={cn(
                "rounded-lg px-3 py-1.5 transition-all",
                statusFilter === "ALL" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              Tất cả ({totalRooms})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("HAS_TENANT")}
              className={cn(
                "rounded-lg px-3 py-1.5 transition-all",
                statusFilter === "HAS_TENANT" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              Có khách ({roomsWithTenant.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("UNPAID")}
              className={cn(
                "rounded-lg px-3 py-1.5 transition-all",
                statusFilter === "UNPAID" ? "bg-white text-rose-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              Còn nợ ({rooms.filter((r) => r.status === "PENDING" || r.status === "OVERDUE").length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("EMPTY")}
              className={cn(
                "rounded-lg px-3 py-1.5 transition-all",
                statusFilter === "EMPTY" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              Phòng trống ({emptyRooms.length})
            </button>
          </div>
        </div>

        {/* Thân danh sách khách hàng */}
        <div className="flex-1 overflow-y-auto thin-scroll p-6 bg-slate-50/40">
          {filteredRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="w-12 h-12 text-slate-300" />
              <h3 className="mt-3 text-base font-bold text-slate-700">
                Không tìm thấy khách hàng nào phù hợp
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Thử đổi từ khóa tìm kiếm hoặc bấm <strong>"+ Thêm Khách Mới"</strong> để gán khách vào phòng.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRooms.map((room) => {
                const isEmpty = room.status === "EMPTY" || !room.tenant;
                const total = roomTotal(room, settings);
                const meta = STATUS_META[room.status];

                return (
                  <div
                    key={room.id}
                    className={cn(
                      "rounded-2xl border bg-white p-4 transition-all shadow-xs flex flex-col justify-between",
                      isEmpty
                        ? "border-dashed border-slate-300 bg-slate-50/50"
                        : "border-slate-200 hover:shadow-md"
                    )}
                  >
                    <div>
                      {/* Dòng tiêu đề phòng & trạng thái */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectRoom(room.id);
                              onClose();
                            }}
                            className="text-base font-black text-slate-900 hover:text-indigo-600 flex items-center gap-1"
                            title="Bấm để mở trên mô hình 3D"
                          >
                            <span>Phòng {room.id}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </button>
                          <span className="text-[11px] text-slate-400">
                            (Tầng {room.floor} • {room.area}m²)
                          </span>
                        </div>
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                            meta.badge
                          )}
                        >
                          {meta.label}
                        </span>
                      </div>

                      {isEmpty ? (
                        /* Giao diện khi phòng trống */
                        <div className="py-5 text-center">
                          <p className="text-xs font-semibold text-slate-500">Phòng này hiện đang trống</p>
                          <p className="text-[11px] text-slate-400 mt-0.5 mb-3">
                            Giá thuê: {formatVND(room.roomFee)}/tháng
                          </p>
                          <button
                            type="button"
                            onClick={() => handleOpenAdd(room.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 active:scale-95"
                          >
                            <Plus className="w-3.5 h-3.5 shrink-0" />
                            <span>Thêm Khách Vào Phòng</span>
                          </button>
                        </div>
                      ) : (
                        /* Giao diện khi có khách thuê */
                        <div className="space-y-2 text-xs">
                          {/* Tên khách & Nick Zalo */}
                          <div className="flex items-start gap-2.5">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 font-bold text-sm shadow-2xs">
                              {room.tenant.split(" ").slice(-1)[0]?.charAt(0) || "K"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-slate-900 text-sm truncate">
                                {room.tenant}
                              </p>
                              {room.zaloName ? (
                                <p className="text-[11px] text-indigo-600 font-medium truncate">
                                  Nick Zalo: {room.zaloName}
                                </p>
                              ) : (
                                <p className="text-[11px] text-slate-400">Chưa đặt nick Zalo</p>
                              )}
                            </div>
                          </div>

                          {/* SĐT Zalo */}
                          <div className="flex items-center justify-between text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100">
                            <span className="flex items-center gap-1.5 text-slate-500">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>SĐT Zalo:</span>
                            </span>
                            <a
                              href={buildZaloChatUrl(room.phone)}
                              target="_blank"
                              rel="noreferrer"
                              className="font-bold text-blue-600 hover:underline flex items-center gap-1 font-mono"
                              title="Mở trò chuyện Zalo"
                            >
                              {room.phone}
                              <MessageCircle className="w-3 h-3 text-blue-500" />
                            </a>
                          </div>

                          {/* CCCD / CMND */}
                          {room.idCard && (
                            <div className="flex items-center justify-between text-[11px] text-slate-600 px-1">
                              <span className="text-slate-400">CCCD/CMND:</span>
                              <span className="font-mono font-semibold text-slate-800">{room.idCard}</span>
                            </div>
                          )}

                          {/* Chu kỳ & Hạn thanh toán */}
                          <div className="flex items-center justify-between text-[11px] text-slate-600 px-1">
                            <span className="flex items-center gap-1 text-slate-400">
                              <Calendar className="w-3 h-3" />
                              <span>Hạn đóng:</span>
                            </span>
                            <span className="font-bold text-slate-800">{room.dueDate}</span>
                          </div>

                          {/* Tổng tiền cần đóng */}
                          <div className="flex items-center justify-between text-[11px] border-t border-slate-100 pt-2 px-1">
                            <span className="text-slate-500">Tổng tiền tháng:</span>
                            <span className="font-black text-rose-600 tabular-nums">
                              {formatVND(total)}
                            </span>
                          </div>

                          {/* Ghi chú */}
                          {room.zaloNote && (
                            <div className="rounded-lg bg-amber-50/70 p-2 text-[11px] text-amber-900 border border-amber-200/60">
                              <span className="font-bold">Ghi chú: </span>
                              {room.zaloNote}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Thanh nút hành động bên dưới mỗi card */}
                    {!isEmpty && (
                      <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(room)}
                          className="flex-1 inline-flex h-8 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 shadow-2xs"
                          title="Sửa thông tin khách thuê"
                        >
                          <Edit3 className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                          <span>Sửa thông tin</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setConfirmDeleteRoomId(room.id)}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 active:scale-95"
                          title="Xóa khách thuê khỏi phòng (Trả phòng)"
                        >
                          <UserMinus className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                          <span>Xóa khách</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 p-4 bg-slate-50/60">
          <p className="text-xs text-slate-500">
            Quản lý khách thuê tập trung: Thêm khách mới, chỉnh sửa thông tin Zalo / CCCD và xóa khách trả phòng.
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

      {/* =========================================================================
          MODAL FORM: THÊM / SỬA KHÁCH THUÊ
          ========================================================================= */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          onClick={() => setIsFormOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-xs">
                  {editingRoomId ? <Edit3 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingRoomId ? `Sửa Thông Tin Khách (Phòng ${editingRoomId})` : "Thêm Khách Thuê Mới"}
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Cập nhật danh bạ khách thuê, số điện thoại Zalo và thiết lập chu kỳ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto thin-scroll text-xs">
              {/* Chọn phòng (chỉ hiện khi Thêm mới) */}
              {!editingRoomId && (
                <div>
                  <label className="font-bold text-slate-800 block mb-1">
                    Chọn phòng thuê <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.roomId}
                    onChange={(e) => {
                      const selId = e.target.value;
                      const selRoom = rooms.find((r) => r.id === selId);
                      setFormData((p) => ({
                        ...p,
                        roomId: selId,
                        roomFee: selRoom?.roomFee || p.roomFee,
                      }));
                    }}
                    className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 font-semibold text-slate-800 outline-none focus:border-indigo-500 shadow-2xs"
                  >
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        Phòng {r.id} (Tầng {r.floor} • {r.area}m²) {r.status === "EMPTY" || !r.tenant ? "• [Phòng Trống]" : `• [Đang có: ${r.tenant}]`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tên khách thuê & SĐT Zalo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">
                    Họ và tên khách thuê <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Nguyễn Văn An"
                    value={formData.tenant}
                    onChange={(e) => setFormData({ ...formData, tenant: e.target.value })}
                    className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 font-medium text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-800 block mb-1">
                    Số điện thoại Zalo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="VD: 0912345678"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 font-mono font-medium text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Tên Nick Zalo & Số CCCD */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">
                    Tên / Biệt danh trên Zalo
                  </label>
                  <input
                    type="text"
                    placeholder="VD: An Nguyen"
                    value={formData.zaloName}
                    onChange={(e) => setFormData({ ...formData, zaloName: e.target.value })}
                    className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 font-medium text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-800 block mb-1">
                    Số CCCD / CMND
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 001201012345"
                    value={formData.idCard}
                    onChange={(e) => setFormData({ ...formData, idCard: e.target.value })}
                    className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 font-mono font-medium text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Tiền phòng & Chu kỳ ngày */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">
                    Tiền phòng (VNĐ/tháng)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={50000}
                    value={formData.roomFee}
                    onChange={(e) => setFormData({ ...formData, roomFee: Number(e.target.value) })}
                    className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 font-bold text-rose-600 outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-800 block mb-1">
                    Ngày bắt đầu thuê
                  </label>
                  <input
                    type="text"
                    placeholder="dd/mm/yyyy"
                    value={formData.startDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({
                        ...formData,
                        startDate: val,
                        dueDate: addOneMonthVN(val),
                      });
                    }}
                    className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 font-medium text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-800 block mb-1">
                    Hạn thanh toán 1 tháng
                  </label>
                  <input
                    type="text"
                    placeholder="dd/mm/yyyy"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 font-medium text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Ghi chú khách */}
              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Ghi chú thêm về khách thuê
                </label>
                <textarea
                  rows={2}
                  placeholder="VD: Quê quán, chỗ để xe, người ở cùng, v.v..."
                  value={formData.zaloNote}
                  onChange={(e) => setFormData({ ...formData, zaloNote: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 font-medium text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              {/* Nút hành động form */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="h-9 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="h-9 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-sm hover:opacity-95 active:scale-95 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5 shrink-0" />
                  <span>{editingRoomId ? "Lưu Thay Đổi" : "Lưu Khách Mới"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL XÁC NHẬN XÓA KHÁCH THUÊ (TRẢ PHÒNG)
          ========================================================================= */}
      {confirmDeleteRoomId && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          onClick={() => setConfirmDeleteRoomId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 text-center animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 mb-4 shadow-xs">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-bold text-slate-900">
              Xác Nhận Xóa Khách Thuê (Trả Phòng)?
            </h3>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              Bạn có chắc chắn muốn xóa thông tin khách thuê khỏi{" "}
              <strong className="text-slate-900">Phòng {confirmDeleteRoomId}</strong>?
              <br />
              Phòng sẽ được chuyển ngay về trạng thái <span className="font-bold text-slate-700">Trống</span> và xóa các thông tin cá nhân liên quan.
            </p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteRoomId(null)}
                className="h-9 px-5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="h-9 px-5 rounded-xl bg-rose-600 text-xs font-bold text-white hover:bg-rose-700 active:scale-95 shadow-sm shadow-rose-200 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>Xác Nhận Xóa Khách</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}