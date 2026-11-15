import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { SplashScreen } from "@capacitor/splash-screen";
import QRCode from "qrcode";
import * as XLSX from "xlsx";

export type PlatformType = "electron" | "android" | "ios" | "web";

/**
 * 1. Nhận diện chính xác 4 nền tảng đang chạy
 */
export const getPlatform = (): PlatformType => {
  if (typeof window !== "undefined" && Boolean(window.electronAPI)) {
    return "electron";
  }
  const capPlatform = Capacitor.getPlatform();
  if (capPlatform === "android") return "android";
  if (capPlatform === "ios") return "ios";
  return "web";
};

export const isNativeMobile = (): boolean => Capacitor.isNativePlatform();
export const isElectron = (): boolean => getPlatform() === "electron";
export const isIOS = (): boolean => getPlatform() === "ios";
export const isAndroid = (): boolean => getPlatform() === "android";
export const isWeb = (): boolean => getPlatform() === "web";

/**
 * 2. Mở khóa âm thanh (Audio Unlocker) trên iOS WKWebView
 * iOS chặn phát âm thanh tự động cho tới khi người dùng có thao tác chạm đầu tiên
 */
let audioContextUnlocked = false;
let globalAudioCtx: AudioContext | null = null;

export const initAudioUnlocker = () => {
  if (typeof window === "undefined" || audioContextUnlocked) return;

  const unlock = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!globalAudioCtx) {
          globalAudioCtx = new AudioCtx();
        }
        if (globalAudioCtx.state === "suspended") {
          globalAudioCtx.resume();
        }
        // Phát một tiếng beep cực nhỏ 0.001s để mở khóa vĩnh viễn
        const osc = globalAudioCtx.createOscillator();
        const gain = globalAudioCtx.createGain();
        gain.gain.value = 0.001;
        osc.connect(gain);
        gain.connect(globalAudioCtx.destination);
        osc.start(0);
        osc.stop(0.001);
      }
      audioContextUnlocked = true;
    } catch {
      // ignore
    } finally {
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("click", unlock);
    }
  };

  window.addEventListener("touchstart", unlock, { passive: true });
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("click", unlock, { passive: true });
};

/**
 * 3. Chuông Ting Ting + Haptic Rung cảm ứng
 */
export const playTingTingNative = async () => {
  // Rung Haptic
  triggerHaptic("success");

  // Âm thanh
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    if (!globalAudioCtx) globalAudioCtx = new AudioCtx();
    if (globalAudioCtx.state === "suspended") await globalAudioCtx.resume();

    const now = globalAudioCtx.currentTime;
    const osc1 = globalAudioCtx.createOscillator();
    const osc2 = globalAudioCtx.createOscillator();
    const gainNode = globalAudioCtx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(1318.51, now); // E6
    osc1.frequency.exponentialRampToValueAtTime(1567.98, now + 0.12); // G6

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(2637.02, now); // E7
    osc2.frequency.exponentialRampToValueAtTime(3135.96, now + 0.12); // G7

    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.4, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(globalAudioCtx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.85);
    osc2.stop(now + 0.85);
  } catch {
    // fallback audio element
    try {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {
      // ignore
    }
  }
};

/**
 * 4. Rung Haptic phản hồi
 */
export const triggerHaptic = async (type: "heavy" | "medium" | "light" | "success" = "medium") => {
  if (isNativeMobile()) {
    try {
      if (type === "success") {
        await Haptics.notification({ type: NotificationType.Success });
      } else if (type === "heavy") {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } else if (type === "light") {
        await Haptics.impact({ style: ImpactStyle.Light });
      } else {
        await Haptics.impact({ style: ImpactStyle.Medium });
      }
      return;
    } catch {
      // fallback
    }
  }

  // Fallback Web Vibration API
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate(type === "success" ? [40, 60, 40] : 30);
    } catch {
      // ignore
    }
  }
};

/**
 * 5. Chuẩn hóa SĐT Zalo
 */
export const sanitizePhoneNumber = (raw: string): string => {
  let cleaned = raw.trim().replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+84")) {
    cleaned = "0" + cleaned.slice(3);
  } else if (cleaned.startsWith("84") && cleaned.length >= 10) {
    cleaned = "0" + cleaned.slice(2);
  }
  return cleaned;
};

/**
 * 6. Mở ứng dụng Zalo trên cả iOS, Android, Desktop và Web
 */
export const openZaloAppOrWeb = (rawPhone: string) => {
  const clean = sanitizePhoneNumber(rawPhone);
  if (!clean) return;

  const url = `https://zalo.me/${clean}`;
  if (isNativeMobile()) {
    // Trên điện thoại, mở URL https://zalo.me sẽ tự động kích hoạt app Zalo cài trên máy
    window.location.href = url;
  } else {
    window.open(url, "_blank");
  }
};

/**
 * 7. Lưu hoặc Chia sẻ File Hóa Đơn Excel (.xlsx) đa nền tảng
 * - Desktop: Ghi trực tiếp xuống ổ cứng Documents qua Electron IPC
 * - Mobile (Android/iOS): Ghi vào Cache và mở Native Share Sheet (gửi thẳng qua Zalo)
 * - Web: Tải xuống trình duyệt
 */
export const saveOrShareExcelWorkbook = async ({
  fileName,
  monthFolder,
  workbook,
}: {
  fileName: string;
  monthFolder: string;
  workbook: XLSX.WorkBook;
}): Promise<{ success: boolean; filePath?: string; uri?: string; error?: string }> => {
  try {
    // 1. Electron Desktop
    if (isElectron() && window.electronAPI) {
      const arrayBuf = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
      const res = await window.electronAPI.saveExcelFile(fileName, monthFolder, new Uint8Array(arrayBuf));
      return res;
    }

    // 2. Mobile Native (Android & iOS) qua Capacitor
    if (isNativeMobile()) {
      const base64Data = XLSX.write(workbook, { bookType: "xlsx", type: "base64" }) as string;
      const fileResult = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      });

      // Mở Native Share Sheet của iOS / Android để gửi thẳng qua Zalo / AirDrop
      await Share.share({
        title: "Hóa Đơn Tiền Phòng & Dịch Vụ",
        text: `Hóa đơn thanh toán tiền phòng file Excel: ${fileName}`,
        files: [fileResult.uri],
        dialogTitle: "Gửi hóa đơn qua Zalo / Tin nhắn / AirDrop",
      });

      return { success: true, uri: fileResult.uri };
    }

    // 3. Web thông thường
    const arrayBuf = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    const blob = new Blob([arrayBuf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

/**
 * 8. Ẩn Splash Screen mượt mà sau khi React 19 mount xong
 */
export const hideSplashScreen = async () => {
  if (isNativeMobile()) {
    try {
      await SplashScreen.hide({ fadeOutDuration: 300 });
    } catch {
      // ignore
    }
  }
};

/**
 * 9. Gọi điện thoại trực tiếp qua trình quay số gốc của máy
 */
export const callPhoneNumber = (rawPhone: string) => {
  const clean = sanitizePhoneNumber(rawPhone);
  if (!clean) return;
  window.location.href = `tel:${clean}`;
};

/**
 * 10. Tạo mã QR VietQR Offline cục bộ trực tiếp trên điện thoại
 * Không phụ thuộc vào kết nối mạng hay API bên ngoài
 */
export const generateQrDataUrlLocal = async (text: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(text, {
      width: 320,
      margin: 1,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    });
  } catch {
    return "";
  }
};
