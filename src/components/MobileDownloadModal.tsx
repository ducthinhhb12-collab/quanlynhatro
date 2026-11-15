import { useState, useEffect } from "react";
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
import { triggerHaptic, generateQrDataUrlLocal } from "../utils/platformBridge";

interface Props {
  onClose: () => void;
}

export default function MobileDownloadModal({ onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [copiedIos, setCopiedIos] = useState(false);
  const [activeTab, setActiveTab] = useState<"apk" | "ios" | "github">("ios");
  const [localQrUrl, setLocalQrUrl] = useState<string>("");
  const [localIosQrUrl, setLocalIosQrUrl] = useState<string>("");

  // Đường link trực tiếp đến file APK Signed Release trên GitHub Releases
  const githubRepoUrl = "https://github.com/ducthinhhb12-collab/quanlynhatro";
  const directApkUrl = `${githubRepoUrl}/releases/download/v1.0.1/AnGiaSmartHome3D-release.apk`;
  const directIpaUrl = `${githubRepoUrl}/releases/download/v1.0.1/AnGiaSmartHome3D.ipa`;
  const releasesPageUrl = `${githubRepoUrl}/releases/latest`;
  const iosAppUrl = "https://ducthinhhb12-collab.github.io/quanlynhatro/";

  // QR Code tải trực tiếp file APK tạo cục bộ (100% offline không cần API bên ngoài)
  useEffect(() => {
    generateQrDataUrlLocal(directApkUrl).then((url) => {
      if (url) setLocalQrUrl(url);
    });
    generateQrDataUrlLocal(iosAppUrl).then((url) => {
      if (url) setLocalIosQrUrl(url);
    });
  }, [directApkUrl, iosAppUrl]);

  const qrDownloadUrl = localQrUrl || `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&data=${encodeURIComponent(
    directApkUrl
  )}`;

  const qrIosUrl = localIosQrUrl || `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&data=${encodeURIComponent(
    iosAppUrl
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

  const handleCopyIosLink = async () => {
    triggerHaptic("medium");
    try {
      await navigator.clipboard.writeText(iosAppUrl);
      setCopiedIos(true);
      setTimeout(() => setCopiedIos(false), 2500);
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
                  AnGiaSmartHome3D-release.apk (v1.0.1)
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Bản phát hành chính thức đã ký số Keystore RSA-4096 production. Quét mã QR bằng Camera điện thoại hoặc bấm nút bên dưới để tải trực tiếp file cài đặt APK về máy.
                </p>

                <div className="pt-1 flex flex-wrap gap-2">
                  <a
                    href={directApkUrl}
                    download="AnGiaSmartHome3D-release.apk"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải Bản Ký Số .APK</span>
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

        {/* TAB 2: IOS IPA & STANDALONE APP */}
        {activeTab === "ios" && (
          <div className="mt-4 space-y-4">
            {/* Phương pháp 1: Cài đặt App Độc Lập qua Màn hình chính (Không cần máy tính, chạy 4G/5G) */}
            <div className="flex flex-col sm:flex-row items-center gap-4 rounded-2xl bg-slate-50 border border-slate-200 p-4">
              {/* QR Code iPhone */}
              <div className="relative shrink-0 rounded-xl border border-slate-200 bg-white p-2 shadow-inner">
                <img
                  src={qrIosUrl}
                  alt="QR Cài đặt iPhone"
                  className="h-36 w-36 object-contain"
                />
                <div className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white shadow">
                  <Apple className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Thông tin & nút thao tác */}
              <div className="flex-1 space-y-2 text-center sm:text-left">
                <div className="inline-flex items-center gap-1.5 rounded-md bg-indigo-100/70 px-2 py-0.5 text-[11px] font-bold text-indigo-800">
                  <Apple className="w-3.5 h-3.5 text-slate-900" />
                  <span>Cách 1: Cài App Độc Lập (Chạy 4G/5G, Không Cần Máy Tính)</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  Phần Mềm Độc Lập "An Gia 3D" Cho iPhone
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Quét mã QR bằng Camera iPhone để mở link cài đặt, sau đó thêm vào màn hình chính để dùng như app gốc (không thanh địa chỉ trình duyệt, chạy trên mọi mạng di động).
                </p>

                <div className="pt-1 flex flex-wrap gap-2">
                  <a
                    href={iosAppUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 active:scale-95 transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Mở Link Cài Đặt</span>
                  </a>

                  <button
                    type="button"
                    onClick={handleCopyIosLink}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95"
                  >
                    {copiedIos ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Đã chép link!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Chép link iPhone</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Hướng dẫn 3 bước cài đặt trên iPhone */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3.5 text-xs text-slate-600 space-y-1.5">
              <p className="font-bold text-slate-900 mb-1">
                📱 3 bước ghim phần mềm độc lập lên màn hình iPhone:
              </p>
              <p>
                <strong>1. Mở link:</strong> Dùng Camera iPhone quét mã QR ở trên hoặc mở link <code className="font-mono bg-slate-100 px-1 rounded text-indigo-700">{iosAppUrl}</code> bằng Safari.
              </p>
              <p>
                <strong>2. Thêm vào Màn hình chính:</strong> Bấm biểu tượng <strong>Chia sẻ (hộp có mũi tên hướng lên 📤)</strong> ở thanh dưới Safari &gt; Cuộn xuống chọn <strong>"Thêm vào MH chính" (Add to Home Screen ⊞)</strong> &gt; Bấm <strong>Thêm</strong>.
              </p>
              <p>
                <strong>3. Khởi chạy như phần mềm gốc:</strong> Biểu tượng <strong>"An Gia 3D"</strong> sẽ xuất hiện trên màn hình iPhone. Khi mở lên, app chạy **100% toàn màn hình độc lập (không thanh web Safari)**, tốc độ 60fps, hỗ trợ mạng 4G/5G và chạy offline không cần bật máy tính!
              </p>
            </div>

            {/* Cách 2: File .IPA cho AltStore / Sideloadly */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>Cách 2: Tải File Native Gốc AnGiaSmartHome3D.ipa</span>
                </div>
                <a
                  href={directIpaUrl}
                  target="_blank"
                  rel="noreferrer"
                  download="AnGiaSmartHome3D.ipa"
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-indigo-700 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  <span>Tải File .IPA</span>
                </a>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Tải file gói <code className="font-mono bg-slate-200 px-1 rounded text-slate-800">AnGiaSmartHome3D.ipa</code> và dùng công cụ miễn phí <strong>Sideloadly</strong>, <strong>AltStore</strong> hoặc <strong>TrollStore</strong> để cài trực tiếp vào iPhone mà không cần tài khoản Apple Developer trả phí.
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
