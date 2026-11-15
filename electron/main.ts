import path from "path";
import fs from "fs";
import { app, BrowserWindow, ipcMain, Menu, Notification, Tray } from "electron";
import { zaloService } from "./services/zaloAutomation";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting: boolean = false;
let hasShownTrayBalloon: boolean = false;

// 1. Chống mở trùng tiến trình (Single Instance Lock)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

function getIconPath(): string {
  const possiblePaths = [
    path.join(__dirname, "../build/icon.ico"),
    path.join(__dirname, "../../build/icon.ico"),
    path.join(process.cwd(), "build/icon.ico"),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return "";
}

function createWindow() {
  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    center: true,
    title: "An Gia Smart Home 3D - Quản Lý Nhà Trọ & Robot Tự Động Hóa Zalo",
    icon: iconPath || undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Bỏ thanh menu mặc định của Electron để giao diện chuyên nghiệp
  mainWindow.setMenuBarVisibility(false);

  // Môi trường dev hoặc production
  const devUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL(devUrl).catch(() => {
      // Fallback nếu server dev chưa kịp mở
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(devUrl);
        }
      }, 1500);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // 2. Chặn sự kiện đóng 'X' -> ẩn xuống khay System Tray
  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();

      if (!hasShownTrayBalloon && tray) {
        tray.displayBalloon({
          title: "An Gia Smart Home 3D",
          content: "Phần mềm và Robot Zalo vẫn đang chạy ngầm dưới khay hệ thống!",
        });
        hasShownTrayBalloon = true;
      }
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = getIconPath();
  if (!iconPath) return;

  tray = new Tray(iconPath);
  tray.setToolTip("An Gia Smart Home 3D - Robot Quản Lý & Zalo RPA");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Mở giao diện quản lý",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: "Kiểm tra kết nối Zalo (Quét QR)",
      click: () => {
        zaloService.openSession(mainWindow);
      },
    },
    { type: "separator" },
    {
      label: "Thoát hoàn toàn",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Click vào icon khay -> Mở lại cửa sổ
  tray.on("double-click", () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      mainWindow.focus();
    }
  });
}

// Khởi chạy ứng dụng
app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Ẩn xuống tray chứ không thoát nếu isQuitting chưa bật
    if (isQuitting) {
      app.quit();
    }
  }
});

/* ==========================================================================
   HỆ THỐNG KÊNH IPC (Inter-Process Communication)
   ========================================================================== */

// 1. Lưu file Excel hóa đơn trực tiếp vào ổ cứng Documents/QuanLyPhongTro/HoaDon/[month]
ipcMain.handle(
  "file:save-excel",
  async (_event, { fileName, monthFolder, buffer }: { fileName: string; monthFolder: string; buffer: Uint8Array | number[] }) => {
    try {
      const userDocs = app.getPath("documents");
      const targetDir = path.join(userDocs, "QuanLyPhongTro", "HoaDon", monthFolder || "2026-11");

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const filePath = path.join(targetDir, fileName);
      const fileBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
      fs.writeFileSync(filePath, fileBuffer);

      return { success: true, filePath };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
);

// 2. Bắn Windows Native Notification
ipcMain.handle("system:notify", async (_event, { title, body }: { title: string; body: string }) => {
  try {
    const iconPath = getIconPath();
    if (Notification.isSupported()) {
      new Notification({
        title,
        body,
        icon: iconPath || undefined,
      }).show();
      return true;
    }
    return false;
  } catch {
    return false;
  }
});

// 3. Mở phiên Zalo để quét QR
ipcMain.handle("zalo:open-session", async () => {
  return await zaloService.openSession(mainWindow);
});

// 4. Bắt đầu luồng Robot gửi tự động
ipcMain.handle("zalo:start-batch", async (_event, { items, settings }: { items: any[]; settings: any }) => {
  return await zaloService.startBatch(mainWindow, items, settings);
});

// 5. Dừng luồng Robot khẩn cấp
ipcMain.handle("zalo:stop-batch", async () => {
  return zaloService.stopBatch();
});
