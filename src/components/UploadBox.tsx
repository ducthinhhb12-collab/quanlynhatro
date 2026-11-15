import { useRef, useState, type DragEvent } from "react";
import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { cn } from "../utils/cn";

interface Props {
  onFile: (file: File) => void;
  disabled?: boolean;
}

const ACCEPT = ".xlsx,.xls,.csv";

export default function UploadBox({ onFile, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Kéo thả file điện nước"
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "group flex h-11 w-[340px] cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3 transition-colors",
        dragging
          ? "border-emerald-500 bg-emerald-50"
          : "border-slate-300 bg-slate-50 hover:border-emerald-400 hover:bg-white",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <UploadCloud
        className={cn(
          "w-5 h-5 shrink-0 transition-colors",
          dragging ? "text-emerald-600" : "text-slate-400 group-hover:text-emerald-600"
        )}
      />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-xs font-semibold text-slate-700">
          Kéo thả file điện/nước .xlsx/.csv
        </p>
        <p className="truncate text-[11px] text-slate-400">hoặc bấm để chọn file</p>
      </div>
      <FileSpreadsheet className="ml-auto w-5 h-5 shrink-0 text-slate-300" />
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
