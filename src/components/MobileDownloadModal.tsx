import { useState } from "react";
import {
  Smartphone,
  QrCode,
  Download,
  Copy,
  Check,
  X,
  ExternalLink,
  ShieldCheck,
  Layers,
  Apple,
  Terminal,
  Zap,
} from "lucide-react";
import { triggerHaptic } from "../utils/platformBridge";

interface Props {
  onClose: () => void;
}

export default function MobileDownloadModal({ onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"apk" | "ios" | "github">("apk");

  // Đường link trực tiếp đến file APK hoặc kho phát hành GitHub Releases
  const githubRepoUrl = "https://github.com/angiasmarthome/angia-smart-home-3d";
  const directApkUrl = `${githubRepoUrl}/releases/latest/download/AnGiaSmartHome3D.apk`;

  // QR Code tải trực tiếp file APK
  const qrDownloadUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&data=${encodeURIComponent(
    directApkUrl
  )}`;

  const handleCopyLink = async () => {
    triggerHaptic("medium");
    try {
      await navigator.clipboard.writeText(directApkUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-all"
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
              Tải App Native Độc Lập Cho Điện Thoại
            </h2>
            <p className="text-xs text-slate-500">
              File cài đặt gốc (.apk / .ipa) • Chạy Offline 100% không qua Safari hay Chrome
            </p>
          </div>
        </div>

        {/* Tab Lựa chọn */}
        <div className="mt-4 flex gap-1 rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("apk")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${
              activeTab === "apk"
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Android (.APK Gốc)</span>
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

          <button
            type="button"
            onClick={() => setActiveTab("github")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${
              activeTab === "github"
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Tự Động Build (CI/CD)</span>
          </button>
        </div>

        {/* TAB 1: ANDROID APK */}
        {activeTab === "apk" && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-4 rounded-2xl bg-slate-50 border border-slate-200 p-4">
              {/* QR Code */}
              <div className="relative shrink-0 rounded-xl border border-slate-200 bg-white p-2 shadow-inner">
                <img
                  src={qrDownloadUrl}
                  alt="QR Tải APK"
                  className="h-36 w-36 object-contain"
                />
                <div className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white shadow">
                  <QrCode className="w-3 h-3" />
                </div>
              </div>

              {/* Thông tin & nút tải */}
              <div className="flex-1 space-y-2 text-center sm:text-left">
                <div className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100/70 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Bản dựng Native Standalone 100%</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  AnGiaSmartHome3D.apk (v1.0.0)
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Quét mã QR bằng Camera điện thoại hoặc bấm nút bên dưới để tải trực tiếp file cài đặt APK về máy.
                </p>

                <div className="pt-1 flex flex-wrap gap-2">
                  <a
                    href={directApkUrl}
                    download="AnGiaSmartHome3D.apk"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải File .APK Về Máy</span>
                  </a>

                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Đã chép link!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Chép link tải</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Hướng dẫn 3 bước cài đặt */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3.5 text-xs text-slate-600 space-y-1.5">
              <p className="font-bold text-slate-900 mb-1">
                3 bước cài đặt file APK lên điện thoại Android:
              </p>
              <p>
                <strong>1. Tải về:</strong> Sau khi tải file <code className="font-mono bg-slate-100 px-1 rounded">AnGiaSmartHome3D.apk</code>, bấm nút <strong>Mở</strong> trên thanh thông báo.
              </p>
              <p>
                <strong>2. Cho phép cài đặt:</strong> Nếu điện thoại hiện cảnh báo nguồn ngoài, chọn <strong>Cài đặt</strong> &gt; Bật công tắc <strong>"Cho phép từ nguồn này"</strong>.
              </p>
              <p>
                <strong>3. Khởi chạy:</strong> Bấm <strong>Cài đặt</strong>. Biểu tượng ứng dụng sẽ xuất hiện ngoài màn hình chính và hoạt động độc lập 100% không phụ thuộc trình duyệt!
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: IOS IPA */}
        {activeTab === "ios" && (
          <div className="mt-4 space-y-3 text-xs text-slate-600">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Apple className="w-4 h-4 text-slate-900" />
                <span>Cách 1: Cài file IPA qua AltStore / Sideloadly (Khuyên dùng)</span>
              </div>
              <p className="mt-1 text-slate-600 leading-relaxed">
                Tải file gói <code className="font-mono bg-slate-200 px-1 rounded text-slate-800">AnGiaSmartHome3D.ipa</code> và dùng công cụ miễn phí <strong>Sideloadly</strong> hoặc <strong>AltStore</strong> để cài trực tiếp vào iPhone mà không cần jailbreak.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <span>Cách 2: Mở qua Xcode (Cho lập trình viên)</span>
              </div>
              <p className="mt-1 text-slate-600 leading-relaxed">
                Chạy lệnh <code className="font-mono bg-slate-200 px-1 rounded text-slate-800">npm run mobile:ios</code> để mở dự án trên Xcode và cắm cáp USB cài trực tiếp lên iPhone trong 1 cú click.
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: GITHUB ACTIONS CI/CD */}
        {activeTab === "github" && (
          <div className="mt-4 space-y-3 text-xs text-slate-600">
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3.5">
              <p className="font-bold text-indigo-950 flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-indigo-600" />
                Quy trình tự động xuất file APK trên GitHub Actions Cloud
              </p>
              <p className="mt-1 text-indigo-900/80 leading-relaxed">
                Hệ thống đã tạo sẵn file cấu hình CI/CD <code className="font-mono bg-white px-1 rounded text-indigo-700">.github/workflows/build-apk.yml</code>. Bạn chỉ cần đẩy code lên GitHub là máy chủ đám mây của GitHub sẽ tự động build file APK và tạo link tải trực tiếp:
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3 font-mono text-[11px] text-emerald-400 space-y-1">
              <p className="text-slate-400"># 3 lệnh đẩy code lên GitHub để nhận link tải APK tự động:</p>
              <p>git add .</p>
              <p>git commit -m "build: release native android apk"</p>
              <p>git push origin main</p>
            </div>

            <p className="text-[11px] text-slate-500">
              Ngay sau khi push, vào tab <strong>Actions</strong> trên kho GitHub của bạn để tải file <code className="font-mono text-slate-700">AnGiaSmartHome3D.apk</code> hoặc lấy link tải trực tiếp từ mục <strong>Releases</strong>.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
          <a
            href={githubRepoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Xem Kho GitHub Releases</span>
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
