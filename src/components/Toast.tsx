import { CheckCircle2, Info, XCircle } from "lucide-react";
import type { ToastState } from "../types";

interface Props {
  toast: ToastState | null;
}

const TONE = {
  success: { cls: "bg-emerald-600", Icon: CheckCircle2 },
  info: { cls: "bg-slate-900", Icon: Info },
  error: { cls: "bg-red-600", Icon: XCircle },
} as const;

export default function Toast({ toast }: Props) {
  if (!toast) return null;
  const { cls, Icon } = TONE[toast.tone];
  return (
    <div
      key={toast.id}
      role="status"
      className={`animate-toast-in fixed bottom-6 left-1/2 z-[60] flex max-w-[90vw] items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl ${cls}`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span>{toast.message}</span>
    </div>
  );
}
