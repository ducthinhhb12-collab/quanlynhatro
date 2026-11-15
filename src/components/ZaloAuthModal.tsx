import { useState, useEffect, useRef, type ChangeEvent } from "react";
import {
  Bot,
  Globe,
  UserCheck,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Upload,
  Phone,
  User,
  Key,
  ShieldCheck,
  LogOut,
  Sparkles,
  QrCode,
  Laptop,
  Check,
  Info,
} from "lucide-react";
import QRCode from "qrcode";
import type { ZaloHostSession, ZaloAuthMode } from "../types/swarmContracts";
import {
  getStoredZaloHostSession,
  saveZaloHostSession,
  clearZaloHostSession,
  subscribeZaloSessionChange,
  isZaloHostAuthorized,
} from "../utils/zaloSession";
import { cn } from "../utils/cn";

export interface ZaloAuthModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onSessionChange?: (session: ZaloHostSession) => void;
  initialMode?: ZaloAuthMode;
}

export default function ZaloAuthModal({
  isOpen = true,
  onClose,
  onSessionChange,
  initialMode,
}: ZaloAuthModalProps) {
  if (!isOpen) return null;

  const isElectronApp = typeof window !== "undefined" && Boolean(window.electronAPI);

  // Current session from storage
  const [session, setSession] = useState<ZaloHostSession>(() => getStoredZaloHostSession());

  // Active tab mode
  const [activeMode, setActiveMode] = useState<ZaloAuthMode>(
    initialMode || session.authMode || (isElectronApp ? "desktop_rpa" : "profile_verified")
  );

  // Form states for Mode 2 (Webhook)
  const [webhookUrl, setWebhookUrl] = useState(session.webhookUrl || "");
  const [oaAccessToken, setOaAccessToken] = useState(session.oaAccessToken || "");
  const [oaRefreshToken, setOaRefreshToken] = useState(session.oaRefreshToken || "");
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [webhookTestStatus, setWebhookTestStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Form states for Mode 3 (Profile & QR)
  const [hostName, setHostName] = useState(session.hostName || "Lê Văn An (Chủ Nhà)");
  const [hostPhone, setHostPhone] = useState(session.hostPhone || "0901234567");
  const [avatarUrl, setAvatarUrl] = useState(session.avatarUrl || "");
  const [personalQrCode, setPersonalQrCode] = useState<string>("");

  // RPA action state
  const [isOpeningRpa, setIsOpeningRpa] = useState(false);
  const [rpaFeedback, setRpaFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Toast / feedback message
  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync session changes from global store
  useEffect(() => {
    const unsubscribe = subscribeZaloSessionChange((newSession) => {
      setSession(newSession);
      if (onSessionChange) {
        onSessionChange(newSession);
      }
    });
    return () => unsubscribe();
  }, [onSessionChange]);

  // Generate QR code whenever host phone changes in Mode 3
  useEffect(() => {
    let isMounted = true;
    const cleanPhone = hostPhone.replace(/[^\d]/g, "");
    const targetUrl = cleanPhone ? `https://zalo.me/${cleanPhone}` : "https://zalo.me";

    QRCode.toDataURL(targetUrl, {
      margin: 1,
      width: 220,
      color: {
        dark: "#0068ff",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (isMounted) setPersonalQrCode(url);
      })
      .catch((err) => {
        console.error("Error generating personal Zalo QR:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [hostPhone]);

  // Handle RPA 1-time Host QR Scan
  const handleOpenDesktopRpaSession = async () => {
    if (!window.electronAPI) {
      setRpaFeedback({
        success: false,
        message: "Tính năng Robot RPA Zalo chỉ khả dụng trên ứng dụng Desktop Native (.exe trên Windows)!",
      });
      return;
    }

    setIsOpeningRpa(true);
    setRpaFeedback({
      success: true,
      message: "Đang mở trình duyệt Zalo Web. Vui lòng quét mã QR trên ứng dụng Zalo điện thoại...",
    });

    try {
      const res = await window.electronAPI.openZaloSession();
      if (res.success) {
        const updated = await saveZaloHostSession({
          isConnected: true,
          authMode: "desktop_rpa",
          lastConnectedAt: new Date().toISOString(),
        });
        setSession(updated);
        setRpaFeedback({
          success: true,
          message: "✅ " + (res.message || "Đã kết nối phiên Zalo Web thành công!"),
        });
      } else {
        setRpaFeedback({
          success: false,
          message: "⚠️ " + (res.message || "Không thể kết nối phiên Zalo."),
        });
      }
    } catch (err: any) {
      setRpaFeedback({
        success: false,
        message: "❌ Lỗi: " + (err?.message || "Không thể khởi chạy trình duyệt Zalo."),
      });
    } finally {
      setIsOpeningRpa(false);
    }
  };

  // Test Webhook API connection
  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) {
      setWebhookTestStatus({
        success: false,
        message: "Vui lòng nhập Webhook URL trước khi kiểm tra.",
      });
      return;
    }

    setIsTestingWebhook(true);
    setWebhookTestStatus(null);

    try {
      // Validate URL shape
      new URL(webhookUrl);

      // Perform a ping test
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(oaAccessToken.trim() ? { Authorization: `Bearer ${oaAccessToken.trim()}` } : {}),
        },
        body: JSON.stringify({
          action: "PING_TEST",
          sender: "An Gia Smart Home 3D",
          timestamp: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        setWebhookTestStatus({
          success: true,
          message: `Kết nối Webhook thành công (HTTP ${res.status} OK)!`,
        });
      } else {
        setWebhookTestStatus({
          success: false,
          message: `Máy chủ phản hồi mã lỗi HTTP ${res.status}. Vui lòng kiểm tra quyền truy cập.`,
        });
      }
    } catch (err: any) {
      setWebhookTestStatus({
        success: false,
        message: `Lỗi kết nối Webhook: ${err?.message || "Không thể gửi yêu cầu"}`,
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  // Save Mode 2 (Webhook / OA)
  const handleSaveWebhookSession = async () => {
    if (!webhookUrl.trim() && !oaAccessToken.trim()) {
      setWebhookTestStatus({
        success: false,
        message: "Vui lòng điền Webhook URL hoặc OA Access Token.",
      });
      return;
    }

    const updated = await saveZaloHostSession({
      isConnected: true,
      authMode: "webhook_api",
      webhookUrl: webhookUrl.trim(),
      oaAccessToken: oaAccessToken.trim(),
      oaRefreshToken: oaRefreshToken.trim(),
      lastConnectedAt: new Date().toISOString(),
    });

    setSession(updated);
    showSavedSuccess("Đã lưu cấu hình Zalo Webhook / OA API thành công!");
  };

  // Handle Avatar file selection
  const handleAvatarFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Dung lượng ảnh tối đa là 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Save Mode 3 (Profile & QR)
  const handleSaveProfileSession = async () => {
    if (!hostName.trim()) {
      alert("Vui lòng nhập tên hiển thị của chủ nhà.");
      return;
    }
    const cleanPhone = hostPhone.replace(/[^\d]/g, "");
    if (cleanPhone.length < 9) {
      alert("Số điện thoại Zalo chủ nhà không hợp lệ.");
      return;
    }

    const updated = await saveZaloHostSession({
      isConnected: true,
      authMode: "profile_verified",
      hostName: hostName.trim(),
      hostPhone: cleanPhone,
      avatarUrl: avatarUrl.trim(),
      lastConnectedAt: new Date().toISOString(),
    });

    setSession(updated);
    showSavedSuccess("Đã cập nhật hồ sơ định danh & chữ ký số chủ nhà thành công!");
  };

  // Disconnect / Clear Session
  const handleDisconnect = async () => {
    if (window.confirm("Bạn có chắc chắn muốn ngắt kết nối và xóa phiên Zalo chủ nhà hiện tại không?")) {
      const cleared = await clearZaloHostSession();
      setSession(cleared);
      setRpaFeedback(null);
      setWebhookTestStatus(null);
      showSavedSuccess("Đã ngắt kết nối phiên Zalo.");
    }
  };

  const showSavedSuccess = (msg: string) => {
    setSavedSuccessMessage(msg);
    setTimeout(() => {
      setSavedSuccessMessage(null);
    }, 4000);
  };

  const isCurrentAuthorized = isZaloHostAuthorized(session);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl rounded-3xl border border-slate-200/80 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-label="Xác thực & Phiên Zalo Chủ Nhà"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-blue-50/80 via-white to-slate-50/50 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/25">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Xác Thực & Quản Lý Phiên Zalo Chủ Nhà
                </h2>
                {isCurrentAuthorized ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3" />
                    Đã Kết Nối
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 border border-amber-200">
                    <AlertCircle className="h-3 w-3" />
                    Chưa Xác Thực
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Cấu hình phiên làm việc để Robot AI tự động gửi hóa đơn 4-trong-1 và ký số điện tử.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Đóng modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Success toast notification */}
        {savedSuccessMessage && (
          <div className="bg-emerald-500 text-white px-6 py-2.5 text-xs font-semibold flex items-center justify-between animate-in slide-in-from-top-2">
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              {savedSuccessMessage}
            </span>
            <button
              type="button"
              onClick={() => setSavedSuccessMessage(null)}
              className="text-white/80 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab Selection Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/60 p-2 gap-1.5 shrink-0 overflow-x-auto">
          {/* Mode 1 Tab */}
          <button
            type="button"
            onClick={() => setActiveMode("desktop_rpa")}
            className={cn(
              "flex flex-1 min-w-[150px] items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-bold transition-all",
              activeMode === "desktop_rpa"
                ? "bg-white text-blue-600 shadow-sm border border-slate-200/80"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
            )}
          >
            <Laptop className="h-4 w-4 shrink-0" />
            <div className="text-left">
              <div className="leading-tight">Robot RPA Desktop</div>
              <span className="text-[10px] font-medium text-slate-400 block">Quét QR 1 lần (Native)</span>
            </div>
          </button>

          {/* Mode 2 Tab */}
          <button
            type="button"
            onClick={() => setActiveMode("webhook_api")}
            className={cn(
              "flex flex-1 min-w-[150px] items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-bold transition-all",
              activeMode === "webhook_api"
                ? "bg-white text-blue-600 shadow-sm border border-slate-200/80"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
            )}
          >
            <Globe className="h-4 w-4 shrink-0" />
            <div className="text-left">
              <div className="leading-tight">Zalo OA & Webhook</div>
              <span className="text-[10px] font-medium text-slate-400 block">Máy chủ Bot API 24/7</span>
            </div>
          </button>

          {/* Mode 3 Tab */}
          <button
            type="button"
            onClick={() => setActiveMode("profile_verified")}
            className={cn(
              "flex flex-1 min-w-[150px] items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-bold transition-all",
              activeMode === "profile_verified"
                ? "bg-white text-blue-600 shadow-sm border border-slate-200/80"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
            )}
          >
            <UserCheck className="h-4 w-4 shrink-0" />
            <div className="text-left">
              <div className="leading-tight">Hồ Sơ & QR Ký Số</div>
              <span className="text-[10px] font-medium text-slate-400 block">Định danh chính chủ</span>
            </div>
          </button>
        </div>

        {/* Modal Scrollable Content Area */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          {/* ================= MODE 1: DESKTOP RPA SESSION ================= */}
          {activeMode === "desktop_rpa" && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                    <Laptop className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">
                      Chế độ Robot RPA Zalo Tự Động Hóa (Playwright)
                    </h3>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      Phần mềm sử dụng trình duyệt Chromium/Edge an toàn tích hợp sẵn. Bạn chỉ cần
                      dùng ứng dụng Zalo trên điện thoại quét mã QR 1 lần duy nhất để kết nối phiên.
                      Toàn bộ dữ liệu cookie được lưu vĩnh viễn trong máy của bạn.
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Box */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Trạng thái phiên làm việc Desktop
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          session.isConnected && session.authMode === "desktop_rpa"
                            ? "bg-emerald-500 animate-pulse"
                            : "bg-slate-300"
                        )}
                      />
                      <span className="text-sm font-bold text-slate-800">
                        {session.isConnected && session.authMode === "desktop_rpa"
                          ? "Đang kết nối phiên Zalo Web"
                          : "Chưa mở phiên hoặc phiên đã hết hạn"}
                      </span>
                    </div>
                    {session.lastConnectedAt && session.authMode === "desktop_rpa" && (
                      <p className="text-[11px] text-slate-400">
                        Đăng nhập lần cuối: {new Date(session.lastConnectedAt).toLocaleString("vi-VN")}
                      </p>
                    )}
                  </div>

                  {session.isConnected && session.authMode === "desktop_rpa" && (
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 transition"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Ngắt kết nối
                    </button>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              {isElectronApp ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleOpenDesktopRpaSession}
                    disabled={isOpeningRpa}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700 active:scale-[0.99] transition disabled:opacity-50"
                  >
                    {isOpeningRpa ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Đang mở trình duyệt Zalo Web...
                      </>
                    ) : (
                      <>
                        <QrCode className="h-4 w-4" />
                        Mở Cửa Sổ Zalo Web Để Quét Mã QR (1 Lần Duy Nhất)
                      </>
                    )}
                  </button>

                  {rpaFeedback && (
                    <div
                      className={cn(
                        "rounded-xl p-3 text-xs font-medium border leading-relaxed",
                        rpaFeedback.success
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : "bg-rose-50 border-rose-200 text-rose-800"
                      )}
                    >
                      {rpaFeedback.message}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-800 space-y-1">
                      <p className="font-bold">Bạn đang chạy phiên bản Web hoặc Di Động</p>
                      <p>
                        Tính năng Robot RPA tự động mở trình duyệt và tự gõ Zalo yêu cầu chạy trực tiếp
                        trên ứng dụng <strong>An Gia Smart Home Desktop (.exe trên Windows)</strong>.
                      </p>
                      <p className="mt-2 text-slate-600">
                        Gợi ý: Quý khách có thể chuyển sang tab <strong>Zalo OA & Webhook</strong> hoặc{" "}
                        <strong>Hồ Sơ & QR Ký Số</strong> để phát hóa đơn 4-trong-1 trên điện thoại!
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveMode("profile_verified")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 transition"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    Chuyển sang Hồ Sơ & QR Ký Số
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ================= MODE 2: ZALO OA & WEBHOOK API ================= */}
          {activeMode === "webhook_api" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
                    <Globe className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">
                      Tích Hợp Zalo Official Account (OA) / Server Webhook
                    </h3>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      Phù hợp cho quản lý từ xa qua điện thoại hoặc tích hợp với n8n, Node.js, Python bot
                      để gửi tin nhắn thông báo tiền phòng tự động 24/7 không cần giữ máy tính bật.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Webhook URL nhận thông điệp (POST Endpoint)
                  </label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://api.yourdomain.com/zalo/webhook"
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Hệ thống sẽ gửi gói tin JSON gồm số điện thoại, số tiền, bảng kê chi tiết tới URL này.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Zalo OA Access Token / Secret Key (Bearer Token)
                  </label>
                  <div className="relative mt-1">
                    <input
                      type="password"
                      value={oaAccessToken}
                      onChange={(e) => setOaAccessToken(e.target.value)}
                      placeholder="Nhập Access Token Zalo OA..."
                      className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 pr-10"
                    />
                    <Key className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    OA Refresh Token (Tùy chọn)
                  </label>
                  <input
                    type="password"
                    value={oaRefreshToken}
                    onChange={(e) => setOaRefreshToken(e.target.value)}
                    placeholder="Nhập Refresh Token nếu sử dụng Zalo OAuth2..."
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {/* Webhook test feedback */}
                {webhookTestStatus && (
                  <div
                    className={cn(
                      "rounded-xl p-3 text-xs font-medium border leading-relaxed",
                      webhookTestStatus.success
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-rose-50 border-rose-200 text-rose-800"
                    )}
                  >
                    {webhookTestStatus.message}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleTestWebhook}
                    disabled={isTestingWebhook || !webhookUrl.trim()}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
                  >
                    {isTestingWebhook ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                    )}
                    Kiểm Tra Kết Nối (Ping)
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveWebhookSession}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Lưu & Kích Hoạt Webhook
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= MODE 3: HOST PROFILE & PERSONAL QR ================= */}
          {activeMode === "profile_verified" && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">
                      Hồ Sơ Chính Chủ & Ký Số Điện Tử Hóa Đơn
                    </h3>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      Thông tin danh tính và mã QR cá nhân của chủ nhà được đóng dấu bảo chứng trực tiếp
                      vào Phiếu Thu 2x Retina, Tin nhắn chuẩn hóa và File Excel hóa đơn.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Form fields */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Họ và Tên Chủ Nhà (Ký hóa đơn)
                    </label>
                    <div className="relative mt-1">
                      <input
                        type="text"
                        value={hostName}
                        onChange={(e) => setHostName(e.target.value)}
                        placeholder="VD: Lê Văn An (Chủ Nhà)"
                        className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 pl-9"
                      />
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Số Điện Thoại Zalo Chính Chủ
                    </label>
                    <div className="relative mt-1">
                      <input
                        type="tel"
                        value={hostPhone}
                        onChange={(e) => setHostPhone(e.target.value)}
                        placeholder="VD: 0901234567"
                        className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 pl-9"
                      />
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Ảnh Đại Diện / Con Dấu Chủ Nhà
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        placeholder="Đường dẫn ảnh hoặc tải ảnh lên..."
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shrink-0"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Tải ảnh
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarFileChange}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveProfileSession}
                    className="w-full mt-2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 transition"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Lưu & Xác Thực Hồ Sơ Chính Chủ
                  </button>
                </div>

                {/* Live Preview Card */}
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/40 p-4 flex flex-col items-center justify-center text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Xem Trước Thẻ Định Danh Ký Số
                  </div>

                  <div className="relative mb-3">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Avatar chủ nhà"
                        className="h-16 w-16 rounded-2xl object-cover border-2 border-white shadow-md"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xl shadow-md border-2 border-white">
                        {hostName.charAt(0) || "A"}
                      </div>
                    )}
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white border-2 border-white">
                      <ShieldCheck className="h-3 w-3" />
                    </span>
                  </div>

                  <div className="font-bold text-sm text-slate-800">{hostName || "Chưa đặt tên"}</div>
                  <div className="text-xs font-medium text-blue-600 mt-0.5">
                    Zalo: {hostPhone || "Chưa có SĐT"}
                  </div>

                  {/* QR Code preview */}
                  {personalQrCode && (
                    <div className="mt-3 p-2 bg-white rounded-xl shadow-sm border border-slate-200/70 inline-block">
                      <img
                        src={personalQrCode}
                        alt="Mã QR Zalo chủ nhà"
                        className="h-28 w-28 object-contain"
                      />
                      <div className="text-[10px] font-semibold text-slate-500 mt-1">
                        Quét kết nối Zalo
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Mã hóa bảo mật cục bộ trên thiết bị của bạn</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
          >
            Hoàn Tất & Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
