/**
 * ĐƯỜNG ỐNG ĐIỀU PHỐI ĐA PHƯƠNG TIỆN 4-TRONG-1 TỰ ĐỘNG (WORKER 3)
 * An Gia Smart Home 3D - 4-in-1 Multimedia Automated Dispatch Pipeline
 * 
 * Tạo và gửi trọn gói 4 thành phần chứng từ chuyên nghiệp:
 * (1) Tin nhắn văn bản chuẩn hóa (kèm số tiền đọc bằng chữ tiếng Việt)
 * (2) Ảnh mã VietQR động 24/7 (offline local QR fallback)
 * (3) Ảnh Phiếu Thu 2x Retina (1080x1520) có dấu mộc điện tử và chữ ký chủ nhà
 * (4) Bảng tính Excel chi tiết (.xlsx) theo chuẩn kế toán
 * 
 * Hỗ trợ thông minh đa nền tảng:
 * - Mobile Native (Android & iOS): Copy clipboard, lưu file Cache qua Filesystem, mở Native Share Sheet.
 * - Electron Desktop: Lưu file Documents qua Electron RPA IPC, bật Zalo Desktop & thông báo.
 * - Web Browser: Tự động tải file chứng từ, copy nội dung và mở trực tiếp link chat Zalo.
 */

import type { Room, Settings } from "../types";
import type { InvoiceBundle4In1, DispatchResult4In1, ZaloHostSession } from "../types/swarmContracts";
import { formatNumber, formatVND, electricityAmount, roomTotal, buildVietQrUrl } from "./format";
import { generateRoomInvoiceWorkbook } from "./invoiceGenerator";
import { renderReceiptCanvas, readVNDToWords } from "./receiptCanvasRenderer";
import {
  isNativeMobile,
  isElectron,
  triggerHaptic,
  playTingTingNative,
  openZaloAppOrWeb,
} from "./platformBridge";
import { copyTextToClipboard } from "./zalo";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import QRCode from "qrcode";
import * as XLSX from "xlsx";

export interface DispatchOptions4In1 {
  openZalo?: boolean;
  copyClipboard?: boolean;
  saveFiles?: boolean;
  hostSession?: ZaloHostSession;
}

/**
 * Sao chép an toàn nội dung văn bản vào bộ nhớ đệm
 * Hỗ trợ native Capacitor clipboard nếu có, fallback navigator.clipboard và execCommand
 */
export const copyToClipboardSmart = async (text: string): Promise<boolean> => {
  // 1. Thử qua Capacitor Clipboard Plugin nếu môi trường native đã nạp
  try {
    const cap = (window as any).Capacitor;
    if (cap?.Plugins?.Clipboard) {
      await cap.Plugins.Clipboard.write({ string: text });
      return true;
    }
  } catch {
    // tiếp tục fallback
  }

  // 2. Fallback qua hàm chuẩn copyTextToClipboard
  return await copyTextToClipboard(text);
};

/**
 * TẠO MÃ VIETQR ĐỘNG ĐỊNH DẠNG BASE64 PNG
 * Hoạt động 100% offline không cần mạng, không lỗi CORS
 */
export const buildVietQrDataUrl = async (
  room: Room,
  settings: Settings
): Promise<string> => {
  const qrTarget = buildVietQrUrl(room, settings);
  try {
    return await QRCode.toDataURL(qrTarget, {
      width: 480,
      margin: 1,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    });
  } catch (err) {
    console.error("Lỗi tạo mã QR VietQR:", err);
    return "";
  }
};

/**
 * XÂY DỰNG GÓI DỮ LIỆU HÓA ĐƠN ĐA PHƯƠNG TIỆN 4-TRONG-1
 * Tổng hợp đầy đủ 4 thành phần chứng từ độc lập
 */
export const buildRoomInvoiceBundle4In1 = async (
  room: Room,
  settings: Settings,
  session?: ZaloHostSession
): Promise<InvoiceBundle4In1> => {
  const totalAmount = Math.round(roomTotal(room, settings));
  const totalAmountWords = readVNDToWords(totalAmount);
  const kwh = Math.max(0, room.electricNew - room.electricOld);
  const elecFee = electricityAmount(room, settings.electricUnitPrice);

  const billingPeriod = room.startDate
    ? `Từ ngày ${room.startDate} đến ngày ${room.dueDate}`
    : `Hạn thanh toán: ${room.dueDate}`;

  // THÀNH PHẦN 1: Tin nhắn văn bản chuẩn hóa
  const hostSignInfo = session?.hostName
    ? `Đại diện BQL: ${session.hostName} (SĐT: ${session.hostPhone || "0901 234 567"})`
    : `Đại diện BQL: ${settings.accountName}`;

  const textLines = [
    `🔔 THÔNG BÁO TIỀN PHÒNG & DỊCH VỤ - CĂN HỘ ${room.id}`,
    `🏢 HỆ THỐNG AN GIA SMART HOME`,
    `Kính gửi bạn: ${room.tenant || "Quý khách"}${room.phone ? ` (${room.phone})` : ""}`,
    `🗓 Kỳ thanh toán: ${billingPeriod}`,
    `----------------------------------------`,
    `1. Tiền thuê phòng: ${formatVND(room.roomFee)}`,
    `2. Tiền điện sinh hoạt: ${formatVND(elecFee)}`,
    `   (Số cũ: ${formatNumber(room.electricOld)} ➔ Số mới: ${formatNumber(room.electricNew)} | Đã dùng: ${formatNumber(kwh)} kWh × ${formatNumber(settings.electricUnitPrice)}đ)`,
    `3. Tiền nước sinh hoạt: ${formatVND(room.waterFee)}`,
    `4. Internet WiFi & Rác: ${formatVND(room.internetFee)}`,
    `----------------------------------------`,
    `👉 TỔNG TIỀN PHẢI THANH TOÁN: ${formatVND(totalAmount)}`,
    `✍️ Bằng chữ: ${totalAmountWords}`,
    `⏰ Hạn thanh toán: ${room.dueDate}`,
    ``,
    `💳 THÔNG TIN CHUYỂN KHOẢN VIETQR 24/7:`,
    `- Ngân hàng: ${settings.bankName}`,
    `- Số tài khoản: ${settings.accountNumber}`,
    `- Chủ tài khoản: ${settings.accountName}`,
    `- Cú pháp CK bắt buộc: THANHTOAN ${room.id}`,
    ``,
    `📁 BỘ CHỨNG TỪ 4-TRONG-1 GỒM:`,
    `1. Bảng kê chi phí dạng tin nhắn`,
    `2. Ảnh mã VietQR thanh toán tự điền thông tin`,
    `3. Ảnh Phiếu Thu 2x Retina có dấu mộc điện tử`,
    `4. File bảng tính Excel (.xlsx) lưu trữ`,
    room.zaloNote ? `📌 Ghi chú: ${room.zaloNote}\n` : "",
    `Xin chân thành cảm ơn Quý khách!`,
    `(${hostSignInfo})`,
  ];

  const textMessage = textLines.filter(Boolean).join("\n");

  // THÀNH PHẦN 2: Ảnh mã VietQR động (.png Base64)
  const vietQrDataUrl = await buildVietQrDataUrl(room, settings);

  // THÀNH PHẦN 3: Ảnh Phiếu Thu 2x Retina 1080x1520 (.png Base64)
  const receiptPngDataUrl = await renderReceiptCanvas(room, settings, session);

  // THÀNH PHẦN 4: Bảng tính Excel Workbook (.xlsx)
  const excelWorkbook = generateRoomInvoiceWorkbook(room, settings);
  const excelFileName = `Hoa-Don-Phong-${room.id}.xlsx`;

  return {
    roomId: room.id,
    tenantName: room.tenant || "Phòng trống",
    phone: room.phone || "",
    totalAmount,
    totalAmountWords,
    dueDate: room.dueDate,
    billingPeriod,
    textMessage,
    vietQrDataUrl,
    receiptPngDataUrl,
    excelWorkbook,
    excelFileName,
  };
};

/**
 * ĐIỀU PHỐI GỬI TRỌN GÓI 4-TRONG-1 THEO TỪNG NỀN TẢNG (DISPATCH PIPELINE)
 */
export const dispatchBundle4In1 = async (
  bundle: InvoiceBundle4In1,
  options: DispatchOptions4In1 = { openZalo: true, copyClipboard: true, saveFiles: true }
): Promise<DispatchResult4In1> => {
  const timeNow = new Date().toLocaleTimeString("vi-VN");

  // 1. Luôn sao chép nội dung tin nhắn vào clipboard trước tiên
  let textCopied = false;
  if (options.copyClipboard !== false) {
    textCopied = await copyToClipboardSmart(bundle.textMessage);
  }

  // 2. NỀN TẢNG MOBILE NATIVE (ANDROID & IOS QUA CAPACITOR)
  if (isNativeMobile()) {
    try {
      const sharedUris: string[] = [];

      // Ghi File 1: Ảnh Phiếu Thu 2x Retina
      if (bundle.receiptPngDataUrl) {
        const cleanReceiptBase64 = bundle.receiptPngDataUrl.replace(/^data:image\/\w+;base64,/, "");
        const receiptFile = await Filesystem.writeFile({
          path: `Phieu-Thu-${bundle.roomId}.png`,
          data: cleanReceiptBase64,
          directory: Directory.Cache,
        });
        sharedUris.push(receiptFile.uri);
      }

      // Ghi File 2: Ảnh VietQR
      if (bundle.vietQrDataUrl) {
        const cleanQrBase64 = bundle.vietQrDataUrl.replace(/^data:image\/\w+;base64,/, "");
        const qrFile = await Filesystem.writeFile({
          path: `VietQR-${bundle.roomId}.png`,
          data: cleanQrBase64,
          directory: Directory.Cache,
        });
        sharedUris.push(qrFile.uri);
      }

      // Ghi File 3: Bảng kê Excel .xlsx
      if (bundle.excelWorkbook) {
        const excelBase64 = XLSX.write(bundle.excelWorkbook, { bookType: "xlsx", type: "base64" }) as string;
        const excelFile = await Filesystem.writeFile({
          path: bundle.excelFileName,
          data: excelBase64,
          directory: Directory.Cache,
        });
        sharedUris.push(excelFile.uri);
      }

      // Kích hoạt rung và chuông phản hồi
      await playTingTingNative();

      // Mở hộp thoại Native Share Sheet (Người dùng chọn gửi qua Zalo / Tin nhắn)
      try {
        await Share.share({
          title: `Hóa Đơn Phòng ${bundle.roomId} - An Gia Smart Home`,
          text: bundle.textMessage,
          files: sharedUris,
          dialogTitle: `Gửi trọn bộ Hóa Đơn 4-trong-1 Phòng ${bundle.roomId} qua Zalo`,
        });
      } catch (shareErr) {
        // Người dùng có thể đóng share sheet, không tính là lỗi hệ thống
        console.log("Hộp thoại chia sẻ đã đóng hoặc bỏ qua:", shareErr);
      }

      return {
        success: true,
        message: `Đã sao chép tin nhắn và chuẩn bị 3 file chứng từ (Phiếu thu 2x, VietQR, Excel) cho phòng ${bundle.roomId}! Chọn Zalo trong danh sách để gửi ngay cho ${bundle.tenantName}.`,
        timestamp: timeNow,
        copiedText: textCopied,
        sharedFiles: sharedUris,
        detail: "Capacitor Native Filesystem Cache & ShareSheet Dispatched",
      };
    } catch (mobileErr: any) {
      console.error("Lỗi gửi trên Mobile Native:", mobileErr);
      // Fallback nếu có sự cố với Filesystem
      if (options.openZalo !== false && bundle.phone) {
        openZaloAppOrWeb(bundle.phone);
      }
      return {
        success: true,
        message: `Đã sao chép tin nhắn vào clipboard và mở Zalo khách ${bundle.tenantName}!`,
        timestamp: timeNow,
        copiedText: textCopied,
        detail: `Mobile Native Fallback: ${mobileErr.message}`,
      };
    }
  }

  // 3. NỀN TẢNG ELECTRON DESKTOP (RPA IPC)
  if (isElectron() && window.electronAPI) {
    try {
      const arrayBuf = XLSX.write(bundle.excelWorkbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
      const monthFolder = bundle.dueDate ? `Thang-${bundle.dueDate.replace(/\//g, "-")}` : "Hoa-Don";
      const saveRes = await window.electronAPI.saveExcelFile(
        bundle.excelFileName,
        monthFolder,
        new Uint8Array(arrayBuf)
      );

      // Hiển thị thông báo màn hình Desktop
      try {
        await window.electronAPI.showNotification({
          title: `An Gia Smart Home - Hóa Đơn ${bundle.roomId}`,
          body: `Đã sẵn sàng trọn bộ 4-trong-1 cho ${bundle.tenantName}. Tin nhắn đã copy vào clipboard!`,
        });
      } catch {
        // Bỏ qua nếu thông báo bị chặn
      }

      // Mở cuộc trò chuyện Zalo nếu yêu cầu
      if (options.openZalo !== false && bundle.phone) {
        openZaloAppOrWeb(bundle.phone);
      }

      await triggerHaptic("success");

      return {
        success: true,
        message: `[Desktop RPA] Đã lưu file Excel tại ${saveRes.filePath || "Thư mục Hóa Đơn"}, sao chép tin nhắn vào bộ nhớ đệm và mở Zalo của ${bundle.tenantName}! Nhấn Ctrl+V để gửi tin.`,
        timestamp: timeNow,
        copiedText: textCopied,
        sharedFiles: saveRes.filePath ? [saveRes.filePath] : [],
        detail: "Electron Desktop RPA File Storage & Window IPC Dispatched",
      };
    } catch (electronErr: any) {
      console.error("Lỗi gửi trên Electron:", electronErr);
      return {
        success: false,
        message: `Lỗi xử lý Electron RPA: ${electronErr.message}`,
        timestamp: timeNow,
        copiedText: textCopied,
        detail: "Electron IPC Error",
      };
    }
  }

  // 4. NỀN TẢNG WEB BROWSER
  try {
    const downloadedFiles: string[] = [];

    if (options.saveFiles !== false) {
      // 1. Tự động tải ảnh Phiếu Thu Retina 2x
      if (bundle.receiptPngDataUrl) {
        const linkReceipt = document.createElement("a");
        linkReceipt.href = bundle.receiptPngDataUrl;
        linkReceipt.download = `Phieu-Thu-${bundle.roomId}.png`;
        document.body.appendChild(linkReceipt);
        linkReceipt.click();
        linkReceipt.remove();
        downloadedFiles.push(`Phieu-Thu-${bundle.roomId}.png`);
      }

      // 2. Tự động tải file Excel hóa đơn
      if (bundle.excelWorkbook) {
        const arrayBuf = XLSX.write(bundle.excelWorkbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
        const blob = new Blob([arrayBuf], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const linkExcel = document.createElement("a");
        linkExcel.href = url;
        linkExcel.download = bundle.excelFileName;
        document.body.appendChild(linkExcel);
        linkExcel.click();
        linkExcel.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        downloadedFiles.push(bundle.excelFileName);
      }
    }

    // Mở trang chat Zalo của khách
    if (options.openZalo !== false && bundle.phone) {
      openZaloAppOrWeb(bundle.phone);
    }

    await triggerHaptic("success");

    return {
      success: true,
      message: `[Web] Đã tải về Phiếu Thu 2x & Bảng tính Excel, sao chép tin nhắn vào clipboard và mở Zalo của ${bundle.tenantName}! Nhấn Ctrl+V để gửi tin.`,
      timestamp: timeNow,
      copiedText: textCopied,
      sharedFiles: downloadedFiles,
      detail: "Web Multi-Download & Zalo Direct Dispatch Complete",
    };
  } catch (webErr: any) {
    console.error("Lỗi gửi trên Web:", webErr);
    return {
      success: false,
      message: `Lỗi kết xuất Web: ${webErr.message}`,
      timestamp: timeNow,
      copiedText: textCopied,
      detail: "Web Dispatch Error",
    };
  }
};
