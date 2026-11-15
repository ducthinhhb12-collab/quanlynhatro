export interface ZaloBatchItem {
  id: string; // Mã phòng ví dụ "P102"
  tenant: string;
  tenantPhone: string;
  zaloName?: string;
  amount: number;
  dueDate: string;
  startDate?: string;
  electricOld: number;
  electricNew: number;
  waterFee: number;
  internetFee: number;
  roomFee: number;
  invoiceExcelPath?: string;
  receiptImagePath?: string;
  messageText: string;
}

export interface ZaloProgressEvent {
  roomId?: string;
  tenant?: string;
  phone?: string;
  step:
    | "START"
    | "WAITING_QR"
    | "SEARCHING"
    | "CHATTING"
    | "PASTING_TEXT"
    | "ATTACHING_FILE"
    | "SENDING"
    | "DELAYING"
    | "SUCCESS"
    | "FAILED"
    | "ABORTED"
    | "BATCH_DONE";
  detail: string;
  countdownSeconds?: number;
  currentRoomIndex?: number;
  totalRooms?: number;
  error?: string;
  timestamp: string;
}

export interface ZaloStatusEvent {
  isLoggedIn: boolean;
  isBusy: boolean;
  currentTask?: string;
}

export interface ElectronAPI {
  isElectron: boolean;
  saveExcelFile: (
    fileName: string,
    monthFolder: string,
    buffer: Uint8Array | number[]
  ) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  showNotification: (options: { title: string; body: string }) => Promise<boolean>;
  openZaloSession: () => Promise<{ success: boolean; message: string }>;
  startZaloBatch: (
    items: ZaloBatchItem[],
    settings: {
      bankCode: string;
      bankName: string;
      accountNumber: string;
      accountName: string;
      electricUnitPrice: number;
    }
  ) => Promise<{ success: boolean; summary: string }>;
  stopZaloBatch: () => Promise<{ success: boolean }>;
  onZaloProgress: (callback: (data: ZaloProgressEvent) => void) => () => void;
  onZaloStatusChange: (callback: (data: ZaloStatusEvent) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
