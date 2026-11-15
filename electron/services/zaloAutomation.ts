import path from "path";
import fs from "fs";
import { app, BrowserWindow, clipboard } from "electron";
import { chromium, type BrowserContext, type Page } from "playwright-core";
import type { ZaloBatchItem, ZaloProgressEvent } from "../../src/types/electron";

export class ZaloAutomationService {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isRunning: boolean = false;
  private isAborted: boolean = false;

  private emitProgress(win: BrowserWindow | null, data: ZaloProgressEvent) {
    if (win && !win.isDestroyed()) {
      win.webContents.send("zalo:progress", data);
    }
  }

  private emitStatus(win: BrowserWindow | null, isLoggedIn: boolean, isBusy: boolean, currentTask?: string) {
    if (win && !win.isDestroyed()) {
      win.webContents.send("zalo:status", { isLoggedIn, isBusy, currentTask });
    }
  }

  private async getOrCreateContext(): Promise<{ context: BrowserContext; page: Page }> {
    if (this.context && this.page && !this.page.isClosed()) {
      return { context: this.context, page: this.page };
    }

    const userDataDir = path.join(app.getPath("userData"), "zalo-session");
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }

    // Ưu tiên Microsoft Edge có sẵn trên 100% máy tính Windows, fallback sang Google Chrome
    const channels = ["msedge", "chrome", undefined];
    let lastError: any = null;

    for (const channel of channels) {
      try {
        const ctx = await chromium.launchPersistentContext(userDataDir, {
          channel,
          headless: false,
          viewport: { width: 1200, height: 800 },
          args: [
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-infobars",
            "--window-size=1200,800",
          ],
        });

        const pages = ctx.pages();
        const p = pages.length > 0 ? pages[0] : await ctx.newPage();

        this.context = ctx;
        this.page = p;

        ctx.on("close", () => {
          this.context = null;
          this.page = null;
        });

        return { context: ctx, page: p };
      } catch (err) {
        lastError = err;
      }
    }

    throw new Error(
      `Không thể khởi chạy trình duyệt tự động hóa trên Windows: ${lastError?.message || "Thiếu trình duyệt MS Edge/Chrome"}`
    );
  }

  /** Mở giao diện Zalo để chủ nhà kiểm tra hoặc quét mã QR */
  async openSession(win: BrowserWindow | null): Promise<{ success: boolean; message: string }> {
    try {
      this.emitStatus(win, false, true, "Đang mở cửa sổ Zalo Web...");
      const { page } = await this.getOrCreateContext();

      await page.goto("https://chat.zalo.me", { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.bringToFront();

      // Kiểm tra xem đã đăng nhập chưa
      const searchBox = await page.$("#contact-search-input, input[placeholder*='Tìm kiếm'], .nav__tabs__top");
      const isLoggedIn = searchBox !== null;

      this.emitStatus(win, isLoggedIn, false, isLoggedIn ? "Đã đăng nhập Zalo" : "Chờ quét mã QR");

      return {
        success: true,
        message: isLoggedIn
          ? "Đã kết nối phiên Zalo của bạn thành công!"
          : "Cửa sổ Zalo đã mở. Vui lòng quét mã QR trên điện thoại để hoàn tất đăng nhập.",
      };
    } catch (err: any) {
      this.emitStatus(win, false, false, "Lỗi mở phiên Zalo");
      return { success: false, message: `Lỗi kết nối Zalo: ${err.message}` };
    }
  }

  /** Dừng batch khẩn cấp */
  stopBatch(): { success: boolean } {
    this.isAborted = true;
    this.isRunning = false;
    return { success: true };
  }

  /** Khởi động chu trình tự động gửi Zalo kèm file Excel cho danh sách phòng nợ */
  async startBatch(
    win: BrowserWindow | null,
    items: ZaloBatchItem[],
    _settings: any
  ): Promise<{ success: boolean; summary: string }> {
    if (this.isRunning) {
      return { success: false, summary: "Robot Zalo đang chạy một chu trình khác. Vui lòng đợi hoặc dừng lại." };
    }

    this.isRunning = true;
    this.isAborted = false;

    const totalRooms = items.length;
    let successCount = 0;
    let failedCount = 0;

    const getTimestamp = () => {
      const d = new Date();
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
    };

    try {
      this.emitProgress(win, {
        step: "START",
        detail: `Bắt đầu xử lý danh sách ${totalRooms} phòng cần thu tiền...`,
        totalRooms,
        currentRoomIndex: 0,
        timestamp: getTimestamp(),
      });

      const { page } = await this.getOrCreateContext();
      await page.bringToFront();

      // Bước 1: Kiểm tra trạng thái đăng nhập
      if (!page.url().includes("chat.zalo.me")) {
        await page.goto("https://chat.zalo.me", { waitUntil: "domcontentloaded", timeout: 30000 });
      }

      // Kiểm tra có ô tìm kiếm không
      let searchInput = await page.$("#contact-search-input, input[placeholder*='Tìm kiếm']");
      if (!searchInput) {
        // Có thể đang ở màn hình QR code
        this.emitProgress(win, {
          step: "WAITING_QR",
          detail: "Phát hiện chưa đăng nhập. Vui lòng quét mã QR trên cửa sổ Zalo trong vòng 120 giây...",
          totalRooms,
          currentRoomIndex: 0,
          timestamp: getTimestamp(),
        });

        // Chờ tối đa 120s cho tới khi xuất hiện ô tìm kiếm
        try {
          await page.waitForSelector("#contact-search-input, input[placeholder*='Tìm kiếm']", {
            timeout: 120000,
          });
          searchInput = await page.$("#contact-search-input, input[placeholder*='Tìm kiếm']");
        } catch {
          this.isRunning = false;
          this.emitProgress(win, {
            step: "FAILED",
            detail: "Quá thời gian 120 giây chờ quét mã QR. Chu trình đã dừng.",
            error: "Hết thời gian quét QR",
            totalRooms,
            currentRoomIndex: 0,
            timestamp: getTimestamp(),
          });
          return { success: false, summary: "Chưa đăng nhập Zalo sau 120s chờ." };
        }
      }

      // Bước 2: Duyệt từng phòng trong danh sách
      for (let i = 0; i < items.length; i++) {
        if (this.isAborted) {
          this.emitProgress(win, {
            step: "ABORTED",
            detail: "Người dùng đã nhấn dừng khẩn cấp. Chu trình kết thúc an toàn.",
            totalRooms,
            currentRoomIndex: i + 1,
            timestamp: getTimestamp(),
          });
          break;
        }

        const room = items[i];
        const phone = room.tenantPhone ? room.tenantPhone.replace(/[^\d]/g, "") : "";

        if (!phone || phone.length < 9) {
          failedCount++;
          this.emitProgress(win, {
            roomId: room.id,
            tenant: room.tenant,
            phone: room.tenantPhone,
            step: "FAILED",
            detail: `Phòng ${room.id} (${room.tenant}) không có số điện thoại hợp lệ.`,
            error: "SĐT không hợp lệ",
            totalRooms,
            currentRoomIndex: i + 1,
            timestamp: getTimestamp(),
          });
          continue;
        }

        try {
          // 2.1: Tìm kiếm khách thuê
          this.emitProgress(win, {
            roomId: room.id,
            tenant: room.tenant,
            phone: room.tenantPhone,
            step: "SEARCHING",
            detail: `[Phòng ${room.id}] Đang tìm kiếm SĐT Zalo ${phone} (${room.tenant})...`,
            totalRooms,
            currentRoomIndex: i + 1,
            timestamp: getTimestamp(),
          });

          // Focus ô tìm kiếm và gõ số điện thoại
          await page.click("#contact-search-input, input[placeholder*='Tìm kiếm']");
          await page.fill("#contact-search-input, input[placeholder*='Tìm kiếm']", "");
          await page.type("#contact-search-input, input[placeholder*='Tìm kiếm']", phone, { delay: 60 });
          await page.waitForTimeout(1200);

          // Nhấn Enter hoặc click kết quả tìm kiếm đầu tiên
          await page.keyboard.press("Enter");
          await page.waitForTimeout(1500);

          // Kiểm tra xem đã mở được khung chat chưa
          const chatInput = await page.$(
            "#chat-input-editor, div[contenteditable='true'], div.input-editor, textarea"
          );

          if (!chatInput) {
            // Không tìm thấy SĐT hoặc SĐT không kích hoạt Zalo
            failedCount++;
            this.emitProgress(win, {
              roomId: room.id,
              tenant: room.tenant,
              phone: room.tenantPhone,
              step: "FAILED",
              detail: `[Phòng ${room.id}] Không tìm thấy cuộc trò chuyện với SĐT ${phone}.`,
              error: "Không tìm thấy trên Zalo",
              totalRooms,
              currentRoomIndex: i + 1,
              timestamp: getTimestamp(),
            });
            continue;
          }

          // 2.2: Dán tin nhắn đa dòng qua Clipboard (tránh Enter sớm)
          this.emitProgress(win, {
            roomId: room.id,
            tenant: room.tenant,
            phone: room.tenantPhone,
            step: "PASTING_TEXT",
            detail: `[Phòng ${room.id}] Đang nhập bảng kê tiền phòng và thông tin VietQR...`,
            totalRooms,
            currentRoomIndex: i + 1,
            timestamp: getTimestamp(),
          });

          // Copy tin nhắn vào Clipboard hệ thống rồi gửi phím Ctrl+V
          clipboard.writeText(room.messageText);
          await chatInput.click();
          await page.keyboard.press("Control+V");
          await page.waitForTimeout(800);

          // 2.3: Đính kèm file Excel hóa đơn (nếu có)
          if (room.invoiceExcelPath && fs.existsSync(room.invoiceExcelPath)) {
            this.emitProgress(win, {
              roomId: room.id,
              tenant: room.tenant,
              phone: room.tenantPhone,
              step: "ATTACHING_FILE",
              detail: `[Phòng ${room.id}] Đang đính kèm file Excel ${path.basename(room.invoiceExcelPath)}...`,
              totalRooms,
              currentRoomIndex: i + 1,
              timestamp: getTimestamp(),
            });

            // Tìm input file để đẩy đường dẫn file
            const fileInput = await page.$("input[type='file']");
            if (fileInput) {
              await fileInput.setInputFiles(room.invoiceExcelPath);
              // Chờ thanh tiến trình tải file lên
              await page.waitForTimeout(1800);
            }
          }

          if (this.isAborted) break;

          // 2.4: Bấm gửi
          this.emitProgress(win, {
            roomId: room.id,
            tenant: room.tenant,
            phone: room.tenantPhone,
            step: "SENDING",
            detail: `[Phòng ${room.id}] Đang phát tin nhắn...`,
            totalRooms,
            currentRoomIndex: i + 1,
            timestamp: getTimestamp(),
          });

          await page.keyboard.press("Enter");
          await page.waitForTimeout(1500);

          successCount++;
          this.emitProgress(win, {
            roomId: room.id,
            tenant: room.tenant,
            phone: room.tenantPhone,
            step: "SUCCESS",
            detail: `[Phòng ${room.id}] Gửi thành công tới ${room.tenant} (${phone})!`,
            totalRooms,
            currentRoomIndex: i + 1,
            timestamp: getTimestamp(),
          });
        } catch (itemErr: any) {
          failedCount++;
          this.emitProgress(win, {
            roomId: room.id,
            tenant: room.tenant,
            phone: room.tenantPhone,
            step: "FAILED",
            detail: `[Phòng ${room.id}] Lỗi gửi Zalo: ${itemErr.message}`,
            error: itemErr.message,
            totalRooms,
            currentRoomIndex: i + 1,
            timestamp: getTimestamp(),
          });
        }

        // 2.5: Cơ chế Human-Delay chống Zalo khóa spam (5-8 giây giữa mỗi phòng)
        if (i < items.length - 1 && !this.isAborted) {
          const delayMs = Math.floor(Math.random() * 3000) + 5000;
          const totalSeconds = Math.round(delayMs / 1000);

          for (let sec = totalSeconds; sec > 0; sec--) {
            if (this.isAborted) break;
            this.emitProgress(win, {
              step: "DELAYING",
              detail: `Đang nghỉ an toàn ${sec}s chống Zalo spam trước khi gửi phòng tiếp theo...`,
              countdownSeconds: sec,
              totalRooms,
              currentRoomIndex: i + 1,
              timestamp: getTimestamp(),
            });
            await page.waitForTimeout(1000);
          }
        }
      }

      this.emitProgress(win, {
        step: "BATCH_DONE",
        detail: `Hoàn tất gửi Zalo! Thành công: ${successCount} phòng, Thất bại: ${failedCount} phòng.`,
        totalRooms,
        currentRoomIndex: totalRooms,
        timestamp: getTimestamp(),
      });

      return {
        success: true,
        summary: `Đã xử lý xong: ${successCount} thành công, ${failedCount} thất bại trên tổng số ${totalRooms} phòng.`,
      };
    } catch (err: any) {
      return { success: false, summary: `Lỗi chu trình Zalo Robot: ${err.message}` };
    } finally {
      this.isRunning = false;
      this.isAborted = false;
    }
  }
}

export const zaloService = new ZaloAutomationService();
