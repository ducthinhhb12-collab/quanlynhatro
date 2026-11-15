import { useState } from "react";
import {
  Building2,
  ChevronLeft,
  Landmark,
  MoreHorizontal,
  Smartphone,
  Wallet,
  Wifi,
  X,
  BatteryFull,
  Signal,
  ShieldCheck,
} from "lucide-react";
import type { Room, Settings } from "../types";
import {
  buildVietQrUrl,
  electricityAmount,
  formatNumber,
  formatVND,
  roomTotal,
} from "../utils/format";
import { cn } from "../utils/cn";

interface Props {
  room: Room;
  settings: Settings;
  onClose: () => void;
  onLaunch: (appName: string) => void;
}

const BILL_PERIOD = "Tháng 05/2026";

function LineItem({ label, sub, value }: { label: string; sub?: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-[13px] text-slate-700">{label}</p>
        {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
      </div>
      <p className="shrink-0 text-[13px] font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

export default function ZaloMiniAppModal({ room, settings, onClose, onLaunch }: Props) {
  const [qrFailed, setQrFailed] = useState(false);
  const total = roomTotal(room, settings);
  const qrUrl = buildVietQrUrl(room, settings);
  const kwh = Math.max(0, room.electricNew - room.electricOld);
  const billNo = `HD${room.id}${room.invoiceIssued ? "-EINV" : "-0526"}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Phiếu thu Zalo Mini App"
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-[min(760px,calc(100vh-32px))] w-full max-w-[380px] flex-col overflow-hidden rounded-[2.75rem] border-[10px] border-slate-900 bg-slate-100 shadow-2xl"
      >
        {/* Status bar + notch */}
        <div className="relative flex h-9 shrink-0 items-center justify-between bg-[#0068FF] px-6 pt-1 text-[11px] font-semibold text-white">
          <span>9:41</span>
          <span className="absolute left-1/2 top-0 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-slate-900" />
          <span className="flex items-center gap-1">
            <Signal className="w-3.5 h-3.5 shrink-0" />
            <Wifi className="w-3.5 h-3.5 shrink-0" />
            <BatteryFull className="w-4 h-4 shrink-0" />
          </span>
        </div>

        {/* Zalo Mini App navbar */}
        <div className="flex h-12 shrink-0 items-center gap-2 bg-[#0068FF] px-2 text-white">
          <button
            type="button"
            onClick={onClose}
            aria-label="Quay lại"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-white/15"
          >
            <ChevronLeft className="w-5 h-5 shrink-0" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Phiếu thu tiền phòng</p>
          </div>
          <button
            type="button"
            aria-label="Thêm"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-white/15"
          >
            <MoreHorizontal className="w-5 h-5 shrink-0" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-white/15"
          >
            <X className="w-4 h-4 shrink-0" />
          </button>
        </div>

        {/* Body */}
        <div className="thin-scroll flex-1 space-y-3 overflow-y-auto p-3.5">
          {/* Thương hiệu */}
          <div className="flex items-center gap-2.5 rounded-2xl bg-white p-3 shadow-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600">
              <Building2 className="w-[18px] h-[18px] shrink-0 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">An Gia Smart Home</p>
              <p className="flex items-center gap-1 text-[11px] text-slate-500">
                <ShieldCheck className="w-3 h-3 shrink-0 text-emerald-600" />
                Hóa đơn điện tử đã xác thực
              </p>
            </div>
          </div>

          {/* Bill card */}
          <div className="relative overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="border-b border-dashed border-slate-200 px-4 pb-3 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  Phiếu thu • {BILL_PERIOD}
                </p>
                <p className="text-[10px] font-medium text-slate-400">#{billNo}</p>
              </div>
              <div className="mt-2 flex items-end justify-between">
                <div className="min-w-0">
                  <p className="text-lg font-bold text-slate-900">Phòng {room.id}</p>
                  <p className="truncate text-xs text-slate-500">{room.tenant}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400">Hạn thanh toán</p>
                  <p className="text-xs font-semibold text-slate-700">{room.dueDate}</p>
                </div>
              </div>
            </div>

            <div className="px-4 py-1">
              <LineItem label="Tiền phòng" value={formatVND(room.roomFee)} />
              <LineItem
                label="Tiền điện"
                sub={`${formatNumber(kwh)} kWh × ${formatNumber(settings.electricUnitPrice)}đ`}
                value={formatVND(electricityAmount(room, settings.electricUnitPrice))}
              />
              <LineItem label="Tiền nước" value={formatVND(room.waterFee)} />
              <LineItem label="Internet" value={formatVND(room.internetFee)} />
            </div>

            <div className="flex items-center justify-between bg-emerald-50/70 px-4 py-3">
              <p className="text-sm font-semibold text-slate-700">Tổng cộng</p>
              <p className="text-lg font-bold tabular-nums text-emerald-700">
                {formatVND(total)}
              </p>
            </div>

            {room.invoiceIssued && (
              <div
                aria-label="Đã xuất hóa đơn điện tử"
                className="animate-seal-in pointer-events-none absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap rounded-xl border-[3px] border-emerald-600/90 bg-white/40 px-3 py-1.5 text-center text-sm font-black tracking-wider text-emerald-600 shadow-[inset_0_0_0_1px_rgba(5,150,105,0.25)] mix-blend-multiply"
              >
                ĐÃ XUẤT HĐĐT
                <span className="block text-[9px] font-semibold tracking-widest">
                  HÓA ĐƠN ĐIỆN TỬ
                </span>
              </div>
            )}
          </div>

          {/* QR */}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Quét mã VietQR để thanh toán
            </p>
            <div className="mx-auto flex h-48 w-48 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
              {qrFailed ? (
                <p className="px-4 text-center text-xs text-slate-400">
                  Không tải được mã QR. Vui lòng chuyển khoản theo thông tin bên dưới.
                </p>
              ) : (
                <img
                  src={qrUrl}
                  alt={`Mã VietQR phòng ${room.id}`}
                  className="h-48 w-48 shrink-0 object-contain"
                  onError={() => setQrFailed(true)}
                />
              )}
            </div>
            <dl className="mt-3 space-y-1.5 text-[12px]">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Ngân hàng</dt>
                <dd className="truncate font-semibold text-slate-800">{settings.bankName}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Số tài khoản</dt>
                <dd className="font-semibold tabular-nums text-slate-800">{settings.accountNumber}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Chủ tài khoản</dt>
                <dd className="truncate font-semibold text-slate-800">{settings.accountName}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Nội dung CK</dt>
                <dd className="font-semibold text-blue-700">THANHTOAN {room.id}</dd>
              </div>
            </dl>
          </div>

          {/* Quick launch */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { name: "App ngân hàng", Icon: Landmark, tone: "text-emerald-700 bg-emerald-50" },
              { name: "MoMo", Icon: Wallet, tone: "text-pink-600 bg-pink-50" },
              { name: "ZaloPay", Icon: Smartphone, tone: "text-blue-600 bg-blue-50" },
            ].map(({ name, Icon, tone }) => (
              <button
                key={name}
                type="button"
                onClick={() => onLaunch(name)}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-white px-2 py-3 text-center shadow-sm transition-transform hover:-translate-y-0.5 active:scale-95"
              >
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", tone)}>
                  <Icon className="w-4 h-4 shrink-0" />
                </span>
                <span className="text-[11px] font-medium text-slate-700">{name}</span>
              </button>
            ))}
          </div>
          <p className="pb-2 text-center text-[10px] text-slate-400">
            Mã phiếu {billNo} • Cung cấp bởi An Gia Smart Home
          </p>
        </div>
      </div>
    </div>
  );
}
