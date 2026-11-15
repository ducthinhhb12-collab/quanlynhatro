import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { SplashScreen } from "@capacitor/splash-screen";
import { invoke } from "@tauri-apps/api/core";
import QRCode from "qrcode";
import * as XLSX from "xlsx";
import type { Room, Settings } from "../types";
import {
  buildReminderMessage,
  buildVietQrUrl,
  electricityAmount,
  formatNumber,
  formatVND,
  getDueStatusInfo,
  roomTotal,
} from "./format";
import { generateRoomInvoiceWorkbook } from "./invoiceGenerator";

export type PlatformType = "tauri" | "electron" | "android" | "ios" | "web";

/**
 * 1. Nhận diện chính xác 5 nền tảng đang chạy (Tauri v2, Electron, Android, iOS, Web)
 */
export const isTauri = (): boolean => {
  return typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);
};

export const getPlatform = (): PlatformType => {
  if (isTauri()) return "tauri";
  if (typeof window !== "undefined" && Boolean(window.electronAPI)) {
    return "electron";
  }
  const capPlatform = Capacitor.getPlatform();
  if (capPlatform === "android") return "android";
  if (capPlatform === "ios") return "ios";
  return "web";
};

export const isNativeMobile = (): boolean => !isTauri() && Capacitor.isNativePlatform();
export const isElectron = (): boolean => getPlatform() === "electron";
export const isIOS = (): boolean => getPlatform() === "ios";
export const isAndroid = (): boolean => getPlatform() === "android";
export const isWeb = (): boolean => getPlatform() === "web";

/**
 * 2. CẦU NỐI TAURI V2 PURE RUST (CÓ FALLBACK WEB & CAPACITOR AN TOÀN)
 */
export interface NativeRoomCalculation {
  room_id: string;
  tenant: string;
  phone: string;
  status: string;
  kwh_used: number;
  electric_amount: number;
  water_fee: number;
  internet_fee: number;
  room_fee: number;
  total_amount: number;
  total_formatted: string;
  total_in_words: string;
  vietqr_url: string;
  vietqr_emvco_payload: string;
  reminder_message: string;
  is_overdue: boolean;
  overdue_days: number;
  due_date: string;
  cycle_text: string;
}

export interface NativeBuildingSummary {
  total_rooms: number;
  occupied_rooms: number;
  empty_rooms: number;
  paid_rooms: number;
  pending_rooms: number;
  overdue_rooms: number;
  total_revenue: number;
  total_collected: number;
  total_outstanding: number;
  total_electricity_kwh: number;
  total_electricity_amount: number;
  calculations: NativeRoomCalculation[];
}

export interface NativeHealthStatus {
  engine: string;
  version: string;
  arch: string;
  os: string;
  rustc: string;
  tauri: string;
  active_modules: string[];
}

/** Gọi hàm tính tiền phòng bằng lõi Rust tốc độ cao */
export const invokeRoomBillingNative = async (
  room: Room,
  settings: Settings
): Promise<NativeRoomCalculation> => {
  if (isTauri()) {
    try {
      return await invoke<NativeRoomCalculation>("calculate_room_billing", {
        room,
        settings,
      });
    } catch (err) {
      console.warn("[Tauri Rust] Fallback tính toán tiền phòng nội bộ:", err);
    }
  }

  // Fallback TypeScript
  const total = roomTotal(room, settings);
  const kwh = Math.max(0, room.electricNew - room.electricOld);
  const elecFee = electricityAmount(room, settings.electricUnitPrice);
  const dueInfo = getDueStatusInfo(room.dueDate);

  return {
    room_id: room.id,
    tenant: room.tenant,
    phone: room.phone,
    status: room.status,
    kwh_used: kwh,
    electric_amount: elecFee,
    water_fee: room.waterFee,
    internet_fee: room.internetFee,
    room_fee: room.roomFee,
    total_amount: total,
    total_formatted: formatVND(total),
    total_in_words: `${formatNumber(total)} đồng`,
    vietqr_url: buildVietQrUrl(room, settings),
    vietqr_emvco_payload: "",
    reminder_message: buildReminderMessage(room, settings),
    is_overdue: dueInfo.isOverdue,
    overdue_days: Math.abs(dueInfo.days),
    due_date: room.dueDate,
    cycle_text: room.startDate ? `Từ ${room.startDate} đến ${room.dueDate}` : `Hạn ${room.dueDate}`,
  };
};

/** Gọi hàm tổng hợp công nợ 12 phòng bằng lõi Rust */
export const invokeBuildingSummaryNative = async (
  rooms: Room[],
  settings: Settings
): Promise<NativeBuildingSummary> => {
  if (isTauri()) {
    try {
      return await invoke<NativeBuildingSummary>("calculate_building_summary", {
        rooms,
        settings,
      });
    } catch (err) {
      console.warn("[Tauri Rust] Fallback tổng hợp tòa nhà nội bộ:", err);
    }
  }

  // Fallback TypeScript
  let totalRevenue = 0;
  let totalCollected = 0;
  let totalOutstanding = 0;
  let totalKwh = 0;
  let totalElecAmt = 0;
  let occupiedRooms = 0;
  let emptyRooms = 0;
  let paidRooms = 0;
  let pendingRooms = 0;
  let overdueRooms = 0;

  const calculations: NativeRoomCalculation[] = [];

  for (const r of rooms) {
    const calc = await invokeRoomBillingNative(r, settings);
    if (r.status === "EMPTY") {
      emptyRooms++;
    } else {
      occupiedRooms++;
      totalRevenue += calc.total_amount;
      totalKwh += calc.kwh_used;
      totalElecAmt += calc.electric_amount;

      if (r.status === "PAID") {
        paidRooms++;
        totalCollected += calc.total_amount;
      } else {
        totalOutstanding += calc.total_amount;
        if (calc.is_overdue || r.status === "OVERDUE") {
          overdueRooms++;
        } else {
          pendingRooms++;
        }
      }
    }
    calculations.push(calc);
  }

  return {
    total_rooms: rooms.length,
    occupied_rooms: occupiedRooms,
    empty_rooms: emptyRooms,
    paid_rooms: paidRooms,
    pending_rooms: pendingRooms,
    overdue_rooms: overdueRooms,
    total_revenue: totalRevenue,
    total_collected: totalCollected,
    total_outstanding: totalOutstanding,
    total_electricity_kwh: totalKwh,
    total_electricity_amount: totalElecAmt,
    calculations,
  };
};

/** Tạo chuỗi payload VietQR chuẩn Napas bằng lõi Rust */
export const invokeVietQrPayloadNative = async (
  room: Room,
  settings: Settings
): Promise<string> => {
  if (isTauri()) {
    try {
      return await invoke<string>("generate_vietqr_payload", { room, settings });
    } catch (err) {
      console.warn("[Tauri Rust] Fallback VietQR URL:", err);
    }
  }
  return buildVietQrUrl(room, settings);
};

/** Xuất hóa đơn Excel trực tiếp bằng engine thuần Rust `rust_xlsxwriter` */
export const invokeGenerateRoomInvoiceExcelNative = async (
  room: Room,
  settings: Settings,
  outputDir?: string
): Promise<{ success: boolean; filePath?: string; error?: string }> => {
  if (isTauri()) {
    try {
      const filePath = await invoke<string>("generate_room_invoice_excel", {
        room,
        settings,
        outputDir,
      });
      return { success: true, filePath };
    } catch (err: any) {
      return { success: false, error: err.toString() };
    }
  }

  // Fallback qua trình duyệt Web
  try {
    const wb = generateRoomInvoiceWorkbook(room, settings);
    const fileName = `Hoa-Don-Phong-${room.id}.xlsx`;
    return await saveOrShareExcelWorkbook({ fileName, monthFolder: "invoices", workbook: wb });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

/** Xuất báo cáo tổng hợp tòa nhà 12 phòng bằng `rust_xlsxwriter` */
export const invokeGenerateBuildingExcelNative = async (
  rooms: Room[],
  settings: Settings,
  outputDir?: string
): Promise<{ success: boolean; filePath?: string; error?: string }> => {
  if (isTauri()) {
    try {
      const filePath = await invoke<string>("generate_building_excel", {
        rooms,
        settings,
        outputDir,
      });
      return { success: true, filePath };
    } catch (err: any) {
      return { success: false, error: err.toString() };
    }
  }
  return { success: false, error: "Chức năng chỉ khả dụng trên môi trường Tauri Native Engine" };
};

/** Gửi thông báo Zalo bất đồng bộ an toàn bộ nhớ qua Rust reqwest + tokio */
export const invokeSendZaloNotificationNative = async (
  room: Room,
  settings: Settings,
  payload: {
    phone: string;
    message: string;
    vietqrUrl?: string;
    receiptImageBase64?: string;
    excelPath?: string;
  }
): Promise<{ success: boolean; message: string; timestamp: string }> => {
  if (isTauri()) {
    try {
      return await invoke<{ success: boolean; message: string; timestamp: string }>(
        "send_zalo_notification",
        {
          room,
          settings,
          payload,
        }
      );
    } catch (err: any) {
      return {
        success: false,
        message: `Lỗi gửi qua Rust Zalo Service: ${err}`,
        timestamp: new Date().toLocaleTimeString(),
      };
    }
  }

  // Fallback Simulated
  return {
    success: true,
    message: `Đã mô phỏng gửi thành công qua Web/Mobile tới ${room.phone}`,
    timestamp: new Date().toLocaleTimeString(),
  };
};

/** Kiểm tra sức khỏe hệ thống lõi Native Rust */
export const invokeCheckNativeHealth = async (): Promise<NativeHealthStatus> => {
  if (isTauri()) {
    try {
      return await invoke<NativeHealthStatus>("check_native_health");
    } catch {
      // ignore
    }
  }

  return {
    engine: isElectron() ? "Electron Desktop" : isNativeMobile() ? "Capacitor Mobile Native" : "Web Engine",
    version: "1.0.0",
    arch: "client-side",
    os: getPlatform(),
    rustc: "Rust Tauri v2 Ready",
    tauri: "2.12.5",
    active_modules: ["billing", "excel", "zalo", "canvas_receipt", "vietqr"],
  };
};

/**
 * 3. Mở khóa âm thanh (Audio Unlocker) trên iOS WKWebView
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
 * 4. Chuông Ting Ting + Haptic Rung cảm ứng
 */
export const playTingTingNative = async () => {
  triggerHaptic("success");

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
    osc1.frequency.setValueAtTime(1318.51, now);
    osc1.frequency.exponentialRampToValueAtTime(1567.98, now + 0.12);

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(2637.02, now);
    osc2.frequency.exponentialRampToValueAtTime(3135.96, now + 0.12);

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
    // Không nạp file ngoài để đảm bảo 100% offline không lỗi mạng
  }
};

/**
 * 5. Rung Haptic phản hồi
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

  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate(type === "success" ? [40, 60, 40] : 30);
    } catch {
      // ignore
    }
  }
};

/**
 * 6. Chuẩn hóa SĐT Zalo
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
 * 7. Mở ứng dụng Zalo trên cả Tauri, iOS, Android, Desktop và Web
 */
export const openZaloAppOrWeb = (rawPhone: string) => {
  const clean = sanitizePhoneNumber(rawPhone);
  if (!clean) return;

  const url = `https://zalo.me/${clean}`;
  if (isNativeMobile()) {
    window.location.href = url;
  } else {
    window.open(url, "_blank");
  }
};

/**
 * 8. Lưu hoặc Chia sẻ File Hóa Đơn Excel (.xlsx) đa nền tảng
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

      await Share.share({
        title: "Hóa Đơn Tiền Phòng & Dịch Vụ",
        text: `Hóa đơn thanh toán tiền phòng file Excel: ${fileName}`,
        files: [fileResult.uri],
        dialogTitle: "Gửi hóa đơn qua Zalo / Tin nhắn / AirDrop",
      });

      return { success: true, uri: fileResult.uri };
    }

    // 3. Web thông thường & Tauri WebView
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
 * 9. Ẩn Splash Screen mượt mà sau khi React mount xong
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
 * 10. Gọi điện thoại trực tiếp qua trình quay số gốc của máy
 */
export const callPhoneNumber = (rawPhone: string) => {
  const clean = sanitizePhoneNumber(rawPhone);
  if (!clean) return;
  window.location.href = `tel:${clean}`;
};

/**
 * 11. Tạo mã QR VietQR Offline cục bộ trực tiếp trên điện thoại
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
