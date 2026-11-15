import { useState } from "react";
import {
  Smartphone,
  QrCode,
  Copy,
  Check,
  X,
  ExternalLink,
  Wifi,
  Apple,
  Layers,
} from "lucide-react";
import { triggerHaptic } from "../utils/platformBridge";

interface Props {
  onClose: () => void;
}

export default function MobileAppQrModal({ onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"qr" | "android" | "ios">("qr");

  // Lấy IP mạng nội bộ hoặc origin hiện tại
  const origin = typeof window !== "undefined" ? window.location.origin : "http://192.168.1.12:5173";
  // Nếu đang mở trên localhost thì ưu tiên IP 192.168.1.12 để điện thoại cùng Wi-Fi vào được
  const mobileUrl = origin.includes("localhost")
    ? origin.replace("localhost", "192.168.1.12")
    : origin;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&data=${encodeURIComponent(
    mobileUrl
  )}`;

  const handleCopy = async () => {
    triggerHaptic("medium");
    try {
      await navigator.clipboard.writeText(mobileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = mobileUrl;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nút đóng */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Modal */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-200">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">
              Tải & Mở Ứng Dụng Trên Điện Thoại
            </h2>
            <p className="text-xs text-slate-500">
              Mở trực tiếp trên iPhone, Android hoặc cài thành App ngoài màn hình chính
            </p>
          </div>
        </div>

        {/* Tab lựa chọn */}
        <div className="mt-4 flex gap-1 rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("qr")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${
              activeTab === "qr"
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Quét Mã QR</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("android")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${
              activeTab === "android"
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Android (APK / PWA)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ios")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${
              activeTab === "ios"
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Apple className="w-3.5 h-3.5" />
            <span>iOS (iPhone / iPad)</span>
          </button>
        </div>

        {/* Nội dung Tab 1: Mã QR Code */}
        {activeTab === "qr" && (
          <div className="mt-5 flex flex-col items-center">
            {/* Box QR Code */}
            <div className="relative rounded-2xl border-2 border-emerald-500/30 bg-slate-50 p-3 shadow-inner">
              <img
                src={qrImageUrl}
                alt="QR Code An Gia Smart Home"
                className="h-56 w-56 rounded-xl object-contain shadow-sm"
              />
              <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md">
                <Smartphone className="w-4 h-4" />
              </div>
            </div>

            <p className="mt-3 text-center text-xs font-medium text-slate-600">
              Dùng <strong>Camera điện thoại</strong> hoặc <strong>Zalo</strong> để quét mã mở ngay
            </p>

            {/* Lưu ý Wi-Fi */}
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
              <Wifi className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Điện thoại cần kết nối chung Wi-Fi với máy tính này để truy cập.</span>
            </div>
          </div>
        )}

        {/* Nội dung Tab 2: Android */}
        {activeTab === "android" && (
          <div className="mt-4 space-y-3 text-xs text-slate-600">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-black text-white">
                  1
                </span>
                Cài đặt làm App ngoài màn hình chính (Khuyên dùng - Nhanh nhất)
              </p>
              <ol className="mt-2 space-y-1 pl-6 list-decimal text-slate-600">
                <li>Mở trình duyệt Chrome trên Android và vào link bên dưới.</li>
                <li>Bấm biểu tượng <strong>Menu 3 chấm (⋮)</strong> ở góc trên bên phải.</li>
                <li>
                  Chọn <strong>"Cài đặt ứng dụng"</strong> (Install App) hoặc "Thêm vào màn hình chính".
                </li>
                <li>Ứng dụng sẽ tự động được đóng gói thành App độc lập có icon ngoài màn hình!</li>
              </ol>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-black text-white">
                  2
                </span>
                Đóng gói file cài đặt (.apk) qua Android Studio
              </p>
              <p className="mt-1 text-slate-600 pl-6">
                Chạy lệnh <code className="rounded bg-slate-200 px-1 font-mono text-[11px]">npm run mobile:android</code> trên máy tính để mở Android Studio và xuất file <code className="font-mono text-indigo-700">.apk</code>.
              </p>
            </div>
          </div>
        )}

        {/* Nội dung Tab 3: iOS */}
        {activeTab === "ios" && (
          <div className="mt-4 space-y-3 text-xs text-slate-600">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-black text-white">
                  1
                </span>
                Cài đặt lên iPhone / iPad (Safari)
              </p>
              <ol className="mt-2 space-y-1.5 pl-6 list-decimal text-slate-600">
                <li>
                  Mở trình duyệt <strong>Safari</strong> trên iPhone và truy cập link bên dưới.
                </li>
                <li>
                  Bấm biểu tượng <strong>Chia sẻ (Share - ô vuông có mũi tên hướng lên)</strong> ở thanh dưới cùng.
                </li>
                <li>
                  Cuộn xuống chọn <strong>"Thêm vào MH chính" (Add to Home Screen)</strong>.
                </li>
                <li>
                  Bấm <strong>Thêm</strong> ở góc trên. App 3D sẽ xuất hiện ngoài màn hình chính, chạy full màn hình 100% không vướng thanh địa chỉ!
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* Ô link & Nút Copy Link */}
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <span>Đường link truy cập trên điện thoại</span>
            <span className="text-emerald-600 font-semibold flex items-center gap-1">
              <Wifi className="w-3 h-3" /> Wi-Fi LAN
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={mobileUrl}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-800 shadow-inner select-all focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shadow-sm ${
                copied
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-900 text-white hover:bg-slate-800 active:scale-95"
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Đã sao chép!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sao chép link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Nút đóng & Mở trên tab mới */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <a
            href={mobileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Mở thử tab mới</span>
          </a>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
