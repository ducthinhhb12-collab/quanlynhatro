import type { Room, Settings } from "../types";
import { buildReminderMessage, buildVietQrUrl, buildZaloChatUrl, roomTotal } from "./format";

export interface ZaloDispatchResult {
  success: boolean;
  message: string;
  timestamp: string;
  detail: string;
  qrUrl?: string;
}

/** Sao chép an toàn nội dung văn bản vào clipboard */
export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback
  }

  try {
    if (typeof document !== "undefined") {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    }
  } catch {
    // fallback
  }

  return false;
};

/** Mở trực tiếp khung chat Zalo trên trình duyệt hoặc app Zalo PC / Mobile */
export const openZaloDirect = (phone: string) => {
  const url = buildZaloChatUrl(phone);
  if (typeof window !== "undefined") {
    window.open(url, "_blank");
  }
};

/** Tự động gửi tin nhắn Zalo kèm mã QR tới khách hàng */
export const dispatchZaloMessageAuto = async (
  room: Room,
  settings: Settings,
  options: { openWindow?: boolean; copyClipboard?: boolean } = { openWindow: true, copyClipboard: true }
): Promise<ZaloDispatchResult> => {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

  if (!room.phone) {
    return {
      success: false,
      message: `Phòng ${room.id} không có số điện thoại Zalo.`,
      timestamp: timeStr,
      detail: "Thiếu SĐT",
    };
  }

  const messageText = buildReminderMessage(room, settings);
  const total = roomTotal(room, settings);
  const qrUrl = buildVietQrUrl(room, settings);

  // Tự động copy nội dung tin nhắn vào bộ nhớ đệm
  if (options.copyClipboard !== false) {
    await copyTextToClipboard(messageText);
  }

  // 1. Chế độ Webhook / Server Backend thật
  if (settings.zaloMethod === "webhook" && settings.zaloWebhookUrl) {
    try {
      const resp = await fetch(settings.zaloWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(settings.zaloAccessToken
            ? { Authorization: `Bearer ${settings.zaloAccessToken}` }
            : {}),
        },
        body: JSON.stringify({
          recipientPhone: room.phone,
          recipientName: room.tenant,
          roomId: room.id,
          amount: total,
          dueDate: room.dueDate,
          message: messageText,
          qrUrl: qrUrl,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!resp.ok) {
        throw new Error(`Webhook phản hồi mã lỗi HTTP ${resp.status}`);
      }

      return {
        success: true,
        message: `Đã tự động gửi tin nhắn Zalo kèm mã QR tới ${room.tenant} (${room.phone}) qua Webhook API`,
        timestamp: timeStr,
        detail: `Webhook HTTP ${resp.status}`,
        qrUrl,
      };
    } catch (err) {
      return {
        success: false,
        message: `Lỗi kết nối Webhook Zalo: ${(err as Error).message}`,
        timestamp: timeStr,
        detail: "Webhook Failed",
      };
    }
  }

  // 2. Chế độ Zalo Official Account (OA) qua Zalo OpenAPI / ZNS
  if (settings.zaloMethod === "zalo_oa" && settings.zaloAccessToken) {
    try {
      const cleanPhone = room.phone.replace(/[^\d]/g, "");
      const resp = await fetch("https://openapi.zalo.me/v3.0/oa/message/transaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: settings.zaloAccessToken,
        },
        body: JSON.stringify({
          phone: cleanPhone,
          template_id: "hoa_don_thang",
          template_data: {
            customer_name: room.tenant,
            room_id: room.id,
            amount: total,
            due_date: room.dueDate,
            qr_link: qrUrl,
          },
        }),
      });

      const data = await resp.json();
      if (data.error && data.error !== 0) {
        throw new Error(data.message || `Mã lỗi Zalo OA: ${data.error}`);
      }

      return {
        success: true,
        message: `Đã gửi tin nhắn ZNS thành công qua Zalo OA tới ${room.tenant} (${room.phone})!`,
        timestamp: timeStr,
        detail: "Zalo OA ZNS Sent",
        qrUrl,
      };
    } catch (err) {
      return {
        success: false,
        message: `Lỗi gửi Zalo OA: ${(err as Error).message}`,
        timestamp: timeStr,
        detail: "Zalo OA Failed",
      };
    }
  }

  // 3. Chế độ Mở Chat Trực Tiếp Zalo & Tự động sao chép tin nhắn
  if (options.openWindow !== false) {
    openZaloDirect(room.phone);
  }

  return {
    success: true,
    message: `Đã sao chép tin nhắn & mở Zalo chat của ${room.tenant} (${room.phone}) thành công!`,
    timestamp: timeStr,
    detail: "Zalo Chat Opened with Message & QR in Clipboard",
    qrUrl,
  };
};
