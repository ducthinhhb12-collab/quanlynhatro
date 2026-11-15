import type { Room, Settings } from "../types";
import { DEFAULT_SETTINGS, INITIAL_ROOMS } from "../data/mockData";

export const STORAGE_KEY_ROOMS_CURRENT = "an_gia_smart_home_rooms_v3";
export const STORAGE_KEY_SETTINGS_CURRENT = "an_gia_smart_home_settings_v3";
export const STORAGE_KEY_AGENTS_CURRENT = "an_gia_smart_home_agents_v3";
export const STORAGE_KEY_BACKUP_SNAPSHOT = "an_gia_user_backup_latest";

const LEGACY_ROOM_KEYS = [
  "an_gia_smart_home_rooms_v3",
  "an_gia_smart_home_rooms_v2",
  "an_gia_smart_home_rooms_v1",
  "an_gia_smart_home_rooms",
  "angia_smart_home_rooms",
  "an_gia_rooms",
  "angia_rooms",
];

const LEGACY_SETTINGS_KEYS = [
  "an_gia_smart_home_settings_v3",
  "an_gia_smart_home_settings_v2",
  "an_gia_smart_home_settings_v1",
  "an_gia_smart_home_settings",
  "angia_smart_home_settings",
];

/**
 * 1. Khôi phục an toàn danh sách 12 phòng mà không bao giờ làm mất dữ liệu người dùng khi cập nhật code.
 * Quét tuần tự từ khóa hiện tại sang các khóa phiên bản cũ (v2, v1, legacy), tự động nâng cấp sang v3.
 */
export function loadSafelyPreservedRooms(): Room[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return INITIAL_ROOMS;
  }

  try {
    for (const key of LEGACY_ROOM_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Hợp nhất từng phòng: Giữ nguyên 100% dữ liệu người dùng đã sửa, bổ sung trường mới nếu có
          const mergedRooms: Room[] = parsed.map((userRoom: Partial<Room>, index: number) => {
            const fallbackRoom = INITIAL_ROOMS[index] || INITIAL_ROOMS[0];
            return {
              ...fallbackRoom,
              ...userRoom,
              id: userRoom.id || fallbackRoom.id,
              floor: userRoom.floor ?? fallbackRoom.floor,
              area: userRoom.area ?? fallbackRoom.area,
              tenant: userRoom.tenant !== undefined ? userRoom.tenant : fallbackRoom.tenant,
              phone: userRoom.phone !== undefined ? userRoom.phone : fallbackRoom.phone,
              zaloName: userRoom.zaloName ?? fallbackRoom.zaloName,
              idCard: userRoom.idCard ?? fallbackRoom.idCard,
              zaloNote: userRoom.zaloNote ?? fallbackRoom.zaloNote,
              electricOld: userRoom.electricOld ?? fallbackRoom.electricOld,
              electricNew: userRoom.electricNew ?? fallbackRoom.electricNew,
              waterFee: userRoom.waterFee ?? fallbackRoom.waterFee,
              internetFee: userRoom.internetFee ?? fallbackRoom.internetFee,
              roomFee: userRoom.roomFee ?? fallbackRoom.roomFee,
              startDate: userRoom.startDate || fallbackRoom.startDate,
              dueDate: userRoom.dueDate || fallbackRoom.dueDate,
              status: userRoom.status || fallbackRoom.status,
            };
          });

          // Lưu đồng bộ vào khóa hiện tại nếu load từ khóa cũ
          if (key !== STORAGE_KEY_ROOMS_CURRENT) {
            localStorage.setItem(STORAGE_KEY_ROOMS_CURRENT, JSON.stringify(mergedRooms));
          }
          return mergedRooms;
        }
      }
    }

    // Kiểm tra bản snapshot dự phòng nếu cả localStorage bị lỗi
    const backupRaw = localStorage.getItem(STORAGE_KEY_BACKUP_SNAPSHOT);
    if (backupRaw) {
      const backupObj = JSON.parse(backupRaw);
      if (Array.isArray(backupObj?.rooms) && backupObj.rooms.length > 0) {
        return backupObj.rooms;
      }
    }
  } catch (err) {
    console.warn("[UserDataGuard] Error reading preserved rooms, checking backup snapshot:", err);
  }

  return INITIAL_ROOMS;
}

/**
 * 2. Khôi phục an toàn cấu hình hệ thống (Settings: Ngân hàng VietQR, Chủ tài khoản, Giá điện)
 * Bảo toàn 100% số tài khoản và thông tin người dùng đã lưu.
 */
export function loadSafelyPreservedSettings(): Settings {
  if (typeof window === "undefined" || !window.localStorage) {
    return DEFAULT_SETTINGS;
  }

  try {
    for (const key of LEGACY_SETTINGS_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          const merged: Settings = {
            ...DEFAULT_SETTINGS,
            ...parsed,
            bankCode: parsed.bankCode || DEFAULT_SETTINGS.bankCode,
            bankName: parsed.bankName || DEFAULT_SETTINGS.bankName,
            accountNumber: parsed.accountNumber !== undefined ? parsed.accountNumber : DEFAULT_SETTINGS.accountNumber,
            accountName: parsed.accountName !== undefined ? parsed.accountName : DEFAULT_SETTINGS.accountName,
            electricUnitPrice: Number(parsed.electricUnitPrice) || DEFAULT_SETTINGS.electricUnitPrice,
          };

          if (key !== STORAGE_KEY_SETTINGS_CURRENT) {
            localStorage.setItem(STORAGE_KEY_SETTINGS_CURRENT, JSON.stringify(merged));
          }
          return merged;
        }
      }
    }
  } catch (err) {
    console.warn("[UserDataGuard] Error loading settings:", err);
  }

  return DEFAULT_SETTINGS;
}

/**
 * 3. Lưu trữ an toàn hai lớp kèm tự động ghi snapshot dự phòng
 */
export function savePreservedRooms(rooms: Room[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const jsonStr = JSON.stringify(rooms);
    localStorage.setItem(STORAGE_KEY_ROOMS_CURRENT, jsonStr);

    // Ghi snapshot tự động kèm timestamp
    const snapshot = {
      timestamp: new Date().toISOString(),
      roomsCount: rooms.length,
      rooms,
    };
    localStorage.setItem(STORAGE_KEY_BACKUP_SNAPSHOT, JSON.stringify(snapshot));
  } catch (err) {
    console.error("[UserDataGuard] Failed to save rooms:", err);
  }
}

export function savePreservedSettings(settings: Settings): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS_CURRENT, JSON.stringify(settings));
  } catch (err) {
    console.error("[UserDataGuard] Failed to save settings:", err);
  }
}

/**
 * 4. Xuất file JSON sao lưu toàn diện cho chủ nhà (1-Click Backup)
 */
export function exportUserDataBackup(rooms: Room[], settings: Settings): void {
  try {
    const backupPayload = {
      app: "An Gia Smart Home 3D",
      version: "1.0.0",
      exportDate: new Date().toISOString(),
      rooms,
      settings,
      totalRooms: rooms.length,
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupPayload, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    const dateFormatted = new Date().toISOString().slice(0, 10);
    downloadAnchor.setAttribute("download", `AnGia_DuLieuSaoLuu_${dateFormatted}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  } catch (err) {
    console.error("[UserDataGuard] Export backup error:", err);
    throw err;
  }
}

/**
 * 5. Khôi phục dữ liệu từ file JSON sao lưu (1-Click Restore)
 */
export function parseUserDataBackup(jsonContent: string): { rooms: Room[]; settings: Settings } | null {
  try {
    const parsed = JSON.parse(jsonContent);
    if (parsed && Array.isArray(parsed.rooms)) {
      return {
        rooms: parsed.rooms,
        settings: parsed.settings ? { ...DEFAULT_SETTINGS, ...parsed.settings } : DEFAULT_SETTINGS,
      };
    }
  } catch (err) {
    console.error("[UserDataGuard] Parse backup error:", err);
  }
  return null;
}
