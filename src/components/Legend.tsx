import {
  Box,
  Calculator,
  MessageCircle,
  Wallet,
  Filter,
  X,
  FileSpreadsheet,
  Send,
} from "lucide-react";
import { STATUS_META } from "../utils/format";
import type { RoomStatus } from "../types";
import { cn } from "../utils/cn";

interface Props {
  counts: Record<RoomStatus, number>;
  filterStatus: RoomStatus | null;
  onToggleFilterStatus: (status: RoomStatus) => void;
  onOpenAgentCompany?: () => void;
}

const LEGEND_ORDER: RoomStatus[] = ["PAID", "PENDING", "OVERDUE", "EMPTY"];

const DEPARTMENTS = [
  { label: "Lập Hóa Đơn", Icon: FileSpreadsheet, tone: "text-amber-600 bg-amber-50" },
  { label: "Thu Nợ 100% Rảnh Tay", Icon: Send, tone: "text-rose-600 bg-rose-50" },
  { label: "Phòng Kế toán", Icon: Calculator, tone: "text-sky-600 bg-sky-50" },
  { label: "Phòng CSKH Zalo", Icon: MessageCircle, tone: "text-blue-600 bg-blue-50" },
  { label: "Phòng Ngân quỹ", Icon: Wallet, tone: "text-emerald-600 bg-emerald-50" },
  { label: "Phòng 3D", Icon: Box, tone: "text-indigo-600 bg-indigo-50" },
];

export default function Legend({
  counts,
  filterStatus,
  onToggleFilterStatus,
  onOpenAgentCompany,
}: Props) {
  return (
    <div className="pointer-events-none absolute bottom-5 left-5 z-10 flex flex-col items-start gap-3">
      {/* Khối chú thích trạng thái & bộ lọc trực tiếp trên 3D */}
      <div className="pointer-events-auto w-72 rounded-2xl border border-slate-200/90 bg-white/95 p-3.5 shadow-lg shadow-slate-200/60 backdrop-blur">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <Filter className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            Lọc theo trạng thái
          </p>
          {filterStatus && (
            <button
              type="button"
              onClick={() => onToggleFilterStatus(filterStatus)}
              className="flex items-center gap-1 text-[10px] font-semibold text-rose-500 hover:text-rose-700"
              title="Bỏ lọc"
            >
              <span>Xóa lọc</span>
              <X className="w-3 h-3 shrink-0" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {LEGEND_ORDER.map((s) => {
            const isSelected = filterStatus === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onToggleFilterStatus(s)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-xs transition-all",
                  isSelected
                    ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                    : "border-slate-100 bg-slate-50/70 text-slate-700 hover:border-slate-200 hover:bg-slate-100/80"
                )}
                title={`Nhấn để làm nổi bật phòng ${STATUS_META[s].label}`}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-[4px]"
                  style={{ backgroundColor: STATUS_META[s].hex }}
                />
                <span className="truncate font-medium">{STATUS_META[s].label}</span>
                <span
                  className={cn(
                    "ml-auto text-[11px] font-bold tabular-nums",
                    isSelected ? "text-slate-200" : "text-slate-500"
                  )}
                >
                  {counts[s]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 huy hiệu phòng ban góc dưới trái - click để mở Công ty Agent */}
      <div className="pointer-events-auto flex flex-wrap gap-2 max-w-[520px]">
        {DEPARTMENTS.map(({ label, Icon, tone }) => (
          <button
            key={label}
            type="button"
            onClick={onOpenAgentCompany}
            className="group flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 py-1.5 pl-1.5 pr-3 text-xs font-medium text-slate-700 shadow-sm backdrop-blur transition-all hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-900 active:scale-95"
            title={`Bấm để mở AI Agent điều hành ${label}`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-transform group-hover:scale-110 ${tone}`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
            </span>
            <span>{label}</span>
            <span className="ml-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
          </button>
        ))}
      </div>
    </div>
  );
}
