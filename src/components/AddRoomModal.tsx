import { useState, type FormEvent } from "react";
import { Plus, X, Calendar, Sparkles } from "lucide-react";
import type { Room } from "../types";
import { addOneMonthVN, getTodayVN } from "../utils/format";

interface Props {
  existingRooms: Room[];
  onAddRoom: (room: Room) => void;
  onClose: () => void;
}

const inputCls =
  "mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";

export default function AddRoomModal({ existingRooms, onAddRoom, onClose }: Props) {
  const today = getTodayVN();
  const initialDueDate = addOneMonthVN(today);

  const [floor, setFloor] = useState<number>(1);
  const [roomId, setRoomId] = useState<string>(() => {
    // Tự động gợi ý mã phòng tiếp theo của tầng 1
    const count = existingRooms.filter((r) => r.floor === 1).length;
    return `P10${count + 1}`;
  });

  const [area, setArea] = useState<number>(25);
  const [tenant, setTenant] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [zaloName, setZaloName] = useState<string>("");
  const [idCard, setIdCard] = useState<string>("");
  const [zaloNote, setZaloNote] = useState<string>("");

  const [roomFee, setRoomFee] = useState<number>(3200000);
  const [startDate, setStartDate] = useState<string>(today);
  const [dueDate, setDueDate] = useState<string>(initialDueDate);

  const [electricOld, setElectricOld] = useState<number>(1000);
  const [electricNew, setElectricNew] = useState<number>(1000);
  const [waterFee, setWaterFee] = useState<number>(100000);
  const [internetFee, setInternetFee] = useState<number>(100000);

  const [error, setError] = useState<string | null>(null);

  const handleFloorChange = (f: number) => {
    setFloor(f);
    const count = existingRooms.filter((r) => r.floor === f).length;
    const nextCol = count + 1;
    setRoomId(`P${f}${nextCol < 10 ? "0" + nextCol : nextCol}`);
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    // Tự động tính hạn thanh toán 1 tháng
    const autoDue = addOneMonthVN(val);
    setDueDate(autoDue);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanId = roomId.trim().toUpperCase();
    if (!cleanId) {
      setError("Vui lòng nhập mã phòng (ví dụ P105, P205).");
      return;
    }

    if (existingRooms.some((r) => r.id === cleanId)) {
      setError(`Mã phòng "${cleanId}" đã tồn tại trong tòa nhà! Vui lòng chọn mã khác.`);
      return;
    }

    const roomsOnFloor = existingRooms.filter((r) => r.floor === floor);
    const newCol = roomsOnFloor.length;

    const hasTenant = tenant.trim().length > 0;

    const newRoom: Room = {
      id: cleanId,
      floor: floor as 1 | 2 | 3,
      col: newCol,
      area: Number(area) || 20,
      tenant: tenant.trim(),
      phone: phone.trim(),
      zaloName: zaloName.trim() || undefined,
      idCard: idCard.trim() || undefined,
      zaloNote: zaloNote.trim() || undefined,
      roomFee: Number(roomFee) || 0,
      electricOld: Number(electricOld) || 0,
      electricNew: Number(electricNew) || 0,
      waterFee: Number(waterFee) || 0,
      internetFee: Number(internetFee) || 0,
      status: hasTenant ? "PENDING" : "EMPTY",
      invoiceIssued: false,
      startDate: hasTenant ? startDate : undefined,
      dueDate: hasTenant ? dueDate : "--",
    };

    onAddRoom(newRoom);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Thêm phòng mới"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl overflow-hidden pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-0"
      >
        {/* Mobile Drag Handle */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2.5 shrink-0" />

        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm shadow-emerald-200">
              <Plus className="w-5 h-5 shrink-0" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Thêm phòng mới vào tòa nhà</h2>
              <p className="text-xs text-slate-500 line-clamp-1 sm:line-clamp-none">
                Nhập thông tin phòng, thông tin Zalo khách thuê và chu kỳ 1 tháng
              </p>
            </div>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="thin-scroll flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 border border-rose-200">
              {error}
            </div>
          )}

          {/* Phần 1: Cấu hình phòng & Tầng */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              1. Thông tin vị trí phòng
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Tầng</label>
                <select
                  value={floor}
                  onChange={(e) => handleFloorChange(Number(e.target.value))}
                  className={inputCls}
                >
                  <option value={1}>Tầng 1</option>
                  <option value={2}>Tầng 2</option>
                  <option value={3}>Tầng 3</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Mã phòng</label>
                <input
                  type="text"
                  required
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  placeholder="Ví dụ: P105"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Diện tích (m²)</label>
                <input
                  type="number"
                  min={10}
                  value={area}
                  onChange={(e) => setArea(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Phần 2: Khách thuê & Thông tin Zalo */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50/30 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                2. Khách thuê & Thông tin Zalo liên hệ
              </p>
              <span className="text-[10px] text-slate-400">(Để trống nếu phòng trống)</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-700">Họ và tên khách thuê</label>
                <input
                  type="text"
                  value={tenant}
                  onChange={(e) => setTenant(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn Hùng"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Số điện thoại Zalo</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0912345678"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Tên / Biệt danh Zalo</label>
                <input
                  type="text"
                  value={zaloName}
                  onChange={(e) => setZaloName(e.target.value)}
                  placeholder="Ví dụ: Hùng Zalo / Khách VIP"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Số CCCD / CMND</label>
                <input
                  type="text"
                  value={idCard}
                  onChange={(e) => setIdCard(e.target.value)}
                  placeholder="12 chữ số"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs font-semibold text-slate-700">Ghi chú Zalo / Yêu cầu thêm</label>
              <input
                type="text"
                value={zaloNote}
                onChange={(e) => setZaloNote(e.target.value)}
                placeholder="Ví dụ: Nuôi mèo, gửi 2 xe máy, nhận tin nhắn sau 18h..."
                className={inputCls}
              />
            </div>
          </div>

          {/* Phần 3: Chu kỳ tính tiền tự động 1 tháng & Giá dịch vụ */}
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                <Sparkles className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                3. Tự động tính chu kỳ 1 tháng & Bảng phí
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                  <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  Ngày bắt đầu chu kỳ (dd/mm/yyyy)
                </label>
                <input
                  type="text"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  placeholder="13/11/2026"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Hạn thanh toán (+1 tháng tự động)</span>
                  <span className="text-[10px] font-bold text-emerald-600">Đủ 1 tháng</span>
                </label>
                <input
                  type="text"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  placeholder="13/12/2026"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Tiền phòng (VNĐ/tháng)</label>
                <input
                  type="number"
                  step={50000}
                  value={roomFee}
                  onChange={(e) => setRoomFee(Number(e.target.value))}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Tiền nước (VNĐ/tháng)</label>
                <input
                  type="number"
                  step={10000}
                  value={waterFee}
                  onChange={(e) => setWaterFee(Number(e.target.value))}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Chỉ số điện ban đầu (kWh)</label>
                <input
                  type="number"
                  value={electricOld}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setElectricOld(v);
                    setElectricNew(v);
                  }}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Internet (VNĐ/tháng)</label>
                <input
                  type="number"
                  step={10000}
                  value={internetFee}
                  onChange={(e) => setInternetFee(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-600 px-5 text-xs font-bold text-white shadow-sm shadow-emerald-200 transition-all hover:bg-emerald-700 active:scale-95"
            >
              <Plus className="w-4 h-4 shrink-0" />
              Thêm phòng vào tòa nhà
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

