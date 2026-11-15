import { Filter, X } from "lucide-react";
import { STATUS_META } from "../utils/format";
import type { RoomStatus } from "../types";
import { cn } from "../utils/cn";
import { triggerHaptic } from "../utils/platformBridge";

interface Props {
  counts: Record<RoomStatus, number>;
  filterStatus: RoomStatus | null;
  onToggleFilterStatus: (status: RoomStatus) => void;
  onOpenAgentCompany?: () => void;
}

const LEGEND_ORDER: RoomStatus[] = ["PAID", "PENDING", "OVERDUE", "EMPTY"];

export default function Legend({
  counts,
  filterStatus,
  onToggleFilterStatus,
}: Props) {
  return (
    <div className="pointer-events-none absolute bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-5 left-3 md:left-5 z-20 flex flex-col items-start gap-3">
      {/* Khối chú thích trạng thái & bộ lọc trực tiếp trên 3D */}
      <div className="pointer-events-auto w-[260px] sm:w-72 rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-lg shadow-slate-200/60 backdrop-blur">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <Filter className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            Lọc theo trạng thái
          </p>
          {filterStatus && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onToggleFilterStatus(filterStatus);
              }}
              className="flex min-h-[32px] items-center gap-1 text-[11px] font-semibold text-rose-500 hover:text-rose-700 active:scale-95 px-1.5 rounded-lg"
              title="Bỏ lọc"
            >
              <span>Xóa lọc</span>
              <X className="w-3.5 h-3.5 shrink-0" />
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
                onClick={() => {
                  triggerHaptic("light");
                  onToggleFilterStatus(s);
                }}
                className={cn(
                  "flex min-h-[44px] items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-xs transition-all active:scale-[0.96] duration-150 select-none",
                  isSelected
                    ? "border-slate-900 bg-slate-900 text-white shadow-sm ring-1 ring-slate-900"
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
    </div>
  );
}

