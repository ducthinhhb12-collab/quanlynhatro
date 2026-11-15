import { useCallback, useEffect, useMemo, useState } from "react";
import { MousePointerClick, Receipt, TrendingUp } from "lucide-react";
import { App as CapApp } from "@capacitor/app";
import Header from "./components/Header";
import Building3D from "./components/Building3D";
import Legend from "./components/Legend";
import RoomDrawer from "./components/RoomDrawer";
import ZaloMiniAppModal from "./components/ZaloMiniAppModal";
import BatchReminderModal from "./components/BatchReminderModal";
import AddRoomModal from "./components/AddRoomModal";
import AgentCompanyModal from "./components/AgentCompanyModal";
import SettingsModal from "./components/SettingsModal";
import AutoZaloSenderModal from "./components/AutoZaloSenderModal";
import CustomerManagerModal from "./components/CustomerManagerModal";
import MobileDownloadModal from "./components/MobileDownloadModal";
import AdminControlModal, {
  DEFAULT_ADMIN_SETTINGS,
  STORAGE_KEY_ADMIN_SETTINGS,
} from "./components/AdminControlModal";
import ZaloAuthModal from "./components/ZaloAuthModal";
import BottomNav, { type MobileTab } from "./components/BottomNavBar";
import Toast from "./components/Toast";
import { cn } from "./utils/cn";
import {
  DEFAULT_SETTINGS,
  INITIAL_AGENTS,
  INITIAL_AGENT_LOGS,
  INITIAL_ROOMS,
} from "./data/mockData";
import {
  importRoomsFile,
  downloadSampleWorkbook,
  exportReportWorkbook,
} from "./utils/spreadsheet";
import { playTingTing } from "./utils/audio";
import { initAudioUnlocker, hideSplashScreen } from "./utils/platformBridge";
import {
  buildReminderMessage,
  formatVND,
  getDueStatusInfo,
  isUnpaid,
  roomTotal,
} from "./utils/format";
import { dispatchZaloMessageAuto, openZaloDirect } from "./utils/zalo";
import {
  downloadRoomInvoiceExcel,
  downloadInvoiceImage,
} from "./utils/invoiceGenerator";
import {
  getStoredZaloHostSession,
  subscribeZaloSessionChange,
  isZaloHostAuthorized,
} from "./utils/zaloSession";
import {
  buildRoomInvoiceBundle4In1,
  dispatchBundle4In1,
} from "./utils/dispatchBundle4In1";
import type {
  AgentInfo,
  AgentLog,
  Room,
  RoomStatus,
  Settings,
  ToastState,
} from "./types";
import type { AdminSettings, ZaloHostSession, AgentLogEntry } from "./types/swarmContracts";

const STORAGE_KEY_ROOMS = "an_gia_smart_home_rooms_v3";
const STORAGE_KEY_SETTINGS = "an_gia_smart_home_settings_v3";
const STORAGE_KEY_AGENTS = "an_gia_smart_home_agents_v3";

const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
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
};

const getNowTimeStr = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
};

export default function App() {
  // 1. Dữ liệu phòng & Settings lưu trữ bền vững
  const [rooms, setRooms] = useState<Room[]>(() => {
    if (typeof window === "undefined") return INITIAL_ROOMS;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ROOMS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_ROOMS;
  });

  const [settings, setSettings] = useState<Settings>(() => {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          return { ...DEFAULT_SETTINGS, ...parsed };
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  // 2. Hệ thống Công ty Agent điều hành
  const [agents, setAgents] = useState<AgentInfo[]>(() => {
    if (typeof window === "undefined") return INITIAL_AGENTS;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AGENTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_AGENTS;
  });

  const [agentLogs, setAgentLogs] = useState<AgentLog[]>(INITIAL_AGENT_LOGS);

  // Cấu hình Quản Trị Bảo Mật & Master Autopilot
  const [adminSettings, setAdminSettings] = useState<AdminSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_ADMIN_SETTINGS;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ADMIN_SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          return { ...DEFAULT_ADMIN_SETTINGS, ...parsed };
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_ADMIN_SETTINGS;
  });

  const [autopilot, setAutopilot] = useState<boolean>(() => adminSettings.autopilotEnabled);

  // Đồng bộ Autopilot với AdminSettings
  useEffect(() => {
    setAutopilot(adminSettings.autopilotEnabled);
  }, [adminSettings.autopilotEnabled]);

  // Lưu trữ cấu hình AdminSettings
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ADMIN_SETTINGS, JSON.stringify(adminSettings));
    } catch {
      // ignore
    }
  }, [adminSettings]);

  // Quản lý phiên Zalo Host chính chủ
  const [zaloSession, setZaloSession] = useState<ZaloHostSession>(() => getStoredZaloHostSession());

  useEffect(() => {
    const unsub = subscribeZaloSessionChange((s) => {
      setZaloSession(s);
    });
    return () => unsub();
  }, []);

  // Tự động lưu trữ localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ROOMS, JSON.stringify(rooms));
    } catch {
      // ignore
    }
  }, [rooms]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_AGENTS, JSON.stringify(agents));
    } catch {
      // ignore
    }
  }, [agents]);

  // Bộ lọc & trạng thái UI 3D
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number>(0); // 0 = Tất cả
  const [filterStatus, setFilterStatus] = useState<RoomStatus | null>(null);

  // Modals
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [zaloAuthModalOpen, setZaloAuthModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [agentCompanyOpen, setAgentCompanyOpen] = useState(false);
  const [zaloOpen, setZaloOpen] = useState(false);
  const [zaloRoomId, setZaloRoomId] = useState<string | null>(null);
  const [batchReminderOpen, setBatchReminderOpen] = useState(false);
  const [autoZaloSenderOpen, setAutoZaloSenderOpen] = useState(false);
  const [customerManagerOpen, setCustomerManagerOpen] = useState(false);
  const [mobileAppQrOpen, setMobileAppQrOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("3d");
  const [toast, setToast] = useState<ToastState | null>(null);

  // Lắng nghe window.visualViewport chống nổi bàn phím ảo
  const [isVirtualKeyboardOpen, setIsVirtualKeyboardOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleViewportResize = () => {
      const vv = window.visualViewport;
      const heightDiff = window.innerHeight - (vv?.height ?? window.innerHeight);
      setIsVirtualKeyboardOpen(heightDiff > 120);
    };

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", handleViewportResize);
      vv.addEventListener("scroll", handleViewportResize);
    }
    window.addEventListener("resize", handleViewportResize);

    handleViewportResize();

    return () => {
      if (vv) {
        vv.removeEventListener("resize", handleViewportResize);
        vv.removeEventListener("scroll", handleViewportResize);
      }
      window.removeEventListener("resize", handleViewportResize);
    };
  }, []);

  // Mở khóa âm thanh WebAudio trên iOS & Ẩn Splash Screen sau khi React 19 mount xong
  useEffect(() => {
    initAudioUnlocker();
    hideSplashScreen();
  }, []);

  // Xử lý nút Back phần cứng trên Android (Capacitor App plugin)
  useEffect(() => {
    let listenerPromise: Promise<any> | null = null;
    try {
      listenerPromise = CapApp.addListener("backButton", () => {
        if (adminModalOpen) {
          setAdminModalOpen(false);
        } else if (zaloAuthModalOpen) {
          setZaloAuthModalOpen(false);
        } else if (customerManagerOpen) {
          setCustomerManagerOpen(false);
          setMobileTab("3d");
        } else if (autoZaloSenderOpen) {
          setAutoZaloSenderOpen(false);
          setMobileTab("3d");
        } else if (agentCompanyOpen) {
          setAgentCompanyOpen(false);
        } else if (addRoomOpen) {
          setAddRoomOpen(false);
        } else if (batchReminderOpen) {
          setBatchReminderOpen(false);
        } else if (zaloOpen) {
          setZaloOpen(false);
        } else if (settingsOpen) {
          setSettingsOpen(false);
          setMobileTab("3d");
        } else if (selectedId) {
          setSelectedId(null);
          setMobileTab("3d");
        } else if (mobileTab !== "3d") {
          setMobileTab("3d");
        }
      });
    } catch {
      // ignore
    }

    return () => {
      if (listenerPromise) {
        listenerPromise.then((h) => h.remove()).catch(() => {});
      }
    };
  }, [
    adminModalOpen,
    zaloAuthModalOpen,
    customerManagerOpen,
    autoZaloSenderOpen,
    agentCompanyOpen,
    addRoomOpen,
    batchReminderOpen,
    zaloOpen,
    settingsOpen,
    selectedId,
    mobileTab,
  ]);

  const showToast = useCallback(
    (message: string, tone: ToastState["tone"] = "success") =>
      setToast({ id: Date.now(), message, tone }),
    []
  );

  const addAgentLog = useCallback(
    (
      role: AgentInfo["role"],
      agentName: string,
      message: string,
      level: AgentLog["level"] = "info"
    ) => {
      const newLog: AgentLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        role,
        agentName,
        message,
        timestamp: getNowTimeStr(),
        level,
      };
      setAgentLogs((prev) => [newLog, ...prev.slice(0, 49)]);
    },
    []
  );

  /* Tự ẩn toast sau 2.8s */
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  /* Tắt hiệu ứng nhịp đập 3D sau 1.4s */
  useEffect(() => {
    if (!flashId) return;
    const t = window.setTimeout(() => setFlashId(null), 1400);
    return () => window.clearTimeout(t);
  }, [flashId]);

  /* Phím Esc: đóng lớp trên cùng trước */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (adminModalOpen) setAdminModalOpen(false);
      else if (zaloAuthModalOpen) setZaloAuthModalOpen(false);
      else if (mobileAppQrOpen) setMobileAppQrOpen(false);
      else if (autoZaloSenderOpen) setAutoZaloSenderOpen(false);
      else if (agentCompanyOpen) setAgentCompanyOpen(false);
      else if (addRoomOpen) setAddRoomOpen(false);
      else if (batchReminderOpen) setBatchReminderOpen(false);
      else if (zaloOpen) setZaloOpen(false);
      else if (settingsOpen) setSettingsOpen(false);
      else if (selectedId) setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adminModalOpen, zaloAuthModalOpen, autoZaloSenderOpen, agentCompanyOpen, addRoomOpen, batchReminderOpen, zaloOpen, settingsOpen, selectedId, mobileAppQrOpen]);

  /* ---------- AUTOPILOT AGENTS: TỰ ĐỘNG CHẠY NGẦM ---------- */
  useEffect(() => {
    if (!autopilot) return;

    // Chạy ngầm định kỳ mỗi 25 giây kiểm tra tự động
    const interval = window.setInterval(() => {
      // 1. Agent Kế toán: Rà soát chu kỳ 1 tháng và quá hạn
      let overdueFound = 0;
      setRooms((prev) =>
        prev.map((r) => {
          if (r.status !== "EMPTY" && r.status !== "PAID") {
            const dueInfo = getDueStatusInfo(r.dueDate);
            if (dueInfo.isOverdue && r.status !== "OVERDUE") {
              overdueFound += 1;
              return { ...r, status: "OVERDUE" };
            }
          }
          return r;
        })
      );

      if (overdueFound > 0) {
        addAgentLog(
          "ACCOUNTING",
          "Agent Kế toán",
          `Tự động rà soát chu kỳ 1 tháng: Chuyển ${overdueFound} phòng quá hạn thanh toán sang trạng thái CẢNH BÁO.`,
          "warning"
        );
      }

      // 2. Bộ đôi Agent Lập Hóa Đơn (DOCUMENT_GEN) & Thu Tiền Tự Động 100% Rảnh Tay (AUTO_COLLECTOR)
      if (settings.zaloAutoSend || settings.handsFreeMode) {
        const unpaidCandidates = rooms.filter(
          (r) => r.status !== "EMPTY" && r.status !== "PAID" && r.phone
        );
        const candidate = unpaidCandidates.slice().sort((a, b) => (a.reminderCount || 0) - (b.reminderCount || 0))[0];

        if (candidate) {
          // Agent Lập Hóa Đơn tự động lập trước tài liệu
          addAgentLog(
            "DOCUMENT_GEN",
            "Agent Lập Hóa Đơn",
            `Tự động kết xuất bảng tính Excel 'Hoa-Don-Phong-${candidate.id}.xlsx' và chụp ảnh phiếu thu. Chuyển giao hồ sơ cho Agent Thu Tiền Tự Động.`,
            "action"
          );

          // Agent Thu Tiền Tự Động phát tin nhắn rảnh tay
          void dispatchZaloMessageAuto(candidate, settings).then((res) => {
            if (res.success) {
              setRooms((curr) =>
                curr.map((x) =>
                  x.id === candidate.id
                    ? {
                        ...x,
                        zaloSendStatus: "SENT",
                        lastZaloSentAt: `${new Date().toLocaleDateString("vi-VN")} ${res.timestamp}`,
                        lastAutoSentAt: `${new Date().toLocaleDateString("vi-VN")} ${res.timestamp}`,
                        reminderCount: (x.reminderCount || 0) + 1,
                        hasExcelInvoice: true,
                        hasImageInvoice: true,
                      }
                    : x
                )
              );
              addAgentLog(
                "AUTO_COLLECTOR",
                "Agent Thu Tiền Tự Động",
                `[HANDS-FREE 100%] Tự động gửi tin nhắn thu tiền & mã VietQR đến khách ${candidate.tenant} (Phòng ${candidate.id} - ${candidate.phone}) mà không cần con người thao tác.`,
                "success"
              );
              setAgents((agList) =>
                agList.map((a) =>
                  a.role === "AUTO_COLLECTOR" || a.role === "DOCUMENT_GEN"
                    ? { ...a, tasksCompleted: a.tasksCompleted + 1 }
                    : a
                )
              );
            }
          });
        }
      }
    }, 20000);

    return () => window.clearInterval(interval);
  }, [autopilot, rooms, settings, addAgentLog]);

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedId) ?? null,
    [rooms, selectedId]
  );

  const activeZaloRoom = useMemo(() => {
    if (zaloRoomId) {
      return rooms.find((r) => r.id === zaloRoomId) ?? null;
    }
    return selectedRoom;
  }, [rooms, zaloRoomId, selectedRoom]);

  const counts = useMemo(() => {
    const c: Record<RoomStatus, number> = { PAID: 0, PENDING: 0, OVERDUE: 0, EMPTY: 0 };
    rooms.forEach((r) => (c[r.status] += 1));
    return c;
  }, [rooms]);

  const unpaidCount = counts.PENDING + counts.OVERDUE;

  const revenue = useMemo(() => {
    const expected = rooms.reduce((s, r) => s + roomTotal(r, settings), 0);
    const collected = rooms
      .filter((r) => r.status === "PAID")
      .reduce((s, r) => s + roomTotal(r, settings), 0);
    const pct = expected > 0 ? Math.round((collected / expected) * 100) : 0;
    return { expected, collected, pct };
  }, [rooms, settings]);

  /* ---------- Handlers ---------- */

  // Kích hoạt toàn bộ chu trình 6 Agent ngay lập tức
  const handleRunAgentCycleNow = async () => {
    const unpaidList = rooms.filter(
      (r) => r.status !== "EMPTY" && r.status !== "PAID"
    );

    // 1. Agent Lập Hóa Đơn (DOCUMENT_GEN): Xuất Excel & Chụp ảnh phiếu thu
    addAgentLog(
      "DOCUMENT_GEN",
      "Agent Lập Hóa Đơn",
      `Đang tự động lập bảng tính Excel hóa đơn và chụp ảnh phiếu thu điện tử cho ${unpaidList.length} phòng nợ...`,
      "action"
    );

    setRooms((curr) =>
      curr.map((r) =>
        r.status !== "EMPTY" && r.status !== "PAID"
          ? { ...r, hasExcelInvoice: true, hasImageInvoice: true }
          : r
      )
    );

    await new Promise((r) => setTimeout(r, 300));

    // 2. Agent Thu Tiền Tự Động 100% Rảnh Tay (AUTO_COLLECTOR): Gửi tin nhắn Zalo kèm QR
    addAgentLog(
      "AUTO_COLLECTOR",
      "Agent Thu Tiền Tự Động",
      `[HANDS-FREE 100%] Tiếp nhận hồ sơ từ Agent Lập Hóa Đơn. Tự động gửi tin nhắn thu tiền kèm mã VietQR cho ${unpaidList.length} khách thuê mà không cần con người thao tác.`,
      "action"
    );

    setRooms((curr) =>
      curr.map((r) =>
        r.status !== "EMPTY" && r.status !== "PAID" && r.phone
          ? {
              ...r,
              zaloSendStatus: "SENT",
              lastZaloSentAt: `${new Date().toLocaleDateString("vi-VN")} ${getNowTimeStr()}`,
              lastAutoSentAt: `${new Date().toLocaleDateString("vi-VN")} ${getNowTimeStr()}`,
              reminderCount: (r.reminderCount || 0) + 1,
            }
          : r
      )
    );

    await new Promise((r) => setTimeout(r, 350));

    // 3. Agent Kế toán (ACCOUNTING)
    addAgentLog(
      "ACCOUNTING",
      "Agent Kế toán",
      "Đã quét và đối soát toàn bộ chu kỳ tính tiền 1 tháng và chỉ số điện nước 12 phòng.",
      "info"
    );

    // 4. Agent CSKH Zalo (ZALO_CSKH)
    addAgentLog(
      "ZALO_CSKH",
      "Agent CSKH Zalo",
      "Đã xếp hàng và đồng bộ kênh chăm sóc khách hàng qua Zalo và Webhook.",
      "info"
    );

    // 5. Agent Ngân quỹ (TREASURY)
    addAgentLog(
      "TREASURY",
      "Agent Ngân quỹ",
      `Đang giám sát cổng VietQR ${settings.bankName} (${settings.accountNumber}). Sẵn sàng khớp lệnh thanh toán tức thời.`,
      "info"
    );

    // 6. Agent Tòa nhà 3D (FACILITY_3D)
    addAgentLog(
      "FACILITY_3D",
      "Agent Tòa nhà 3D",
      "Mô hình Isometric 3 tầng đã đồng bộ toàn bộ dữ liệu thực tế và hiệu ứng không gian.",
      "success"
    );

    setAgents((prev) =>
      prev.map((a) => ({ ...a, tasksCompleted: a.tasksCompleted + 1 }))
    );

    showToast(
      "Đội ngũ 6 AI Agent đã hoàn thành chu trình lập hóa đơn & thu tiền tự động 100% rảnh tay!",
      "success"
    );
  };

  // Tải file Excel hóa đơn do Agent lập
  const handleDownloadExcelInvoice = (room: Room) => {
    downloadRoomInvoiceExcel(room, settings);
    showToast(`Đang tải hóa đơn Excel phòng ${room.id}...`, "success");
    addAgentLog(
      "DOCUMENT_GEN",
      "Agent Lập Hóa Đơn",
      `Đã xuất bảng tính Excel hóa đơn 'Hoa-Don-Phong-${room.id}.xlsx'.`,
      "success"
    );
  };

  // Tải file ảnh phiếu thu điện tử do Agent kết xuất
  const handleDownloadReceiptImage = async (room: Room) => {
    showToast(`Đang kết xuất ảnh phiếu thu phòng ${room.id}...`, "info");
    await downloadInvoiceImage(room, settings);
    showToast(`Đã tải ảnh phiếu thu phòng ${room.id}!`, "success");
    addAgentLog(
      "DOCUMENT_GEN",
      "Agent Lập Hóa Đơn",
      `Đã chụp và kết xuất ảnh phiếu thu điện tử phòng ${room.id} (PNG).`,
      "success"
    );
  };

  // Cho Agent Thu Tiền Tự Động gửi tin nhắn Zalo kèm mã VietQR cho toàn bộ khách thuê đang nợ
  const handleAutoSendAllZalo = async () => {
    const unpaid = rooms.filter(
      (r) => r.status !== "EMPTY" && r.status !== "PAID" && r.phone
    );

    if (unpaid.length === 0) {
      showToast("Toàn bộ các phòng có khách đã thanh toán xong, không có khoản nợ nào cần gửi!", "info");
      return;
    }

    showToast(`🤖 Agent Thu Tiền Tự Động đang bắt đầu gửi Zalo cho ${unpaid.length} khách thuê...`, "info");

    addAgentLog(
      "DOCUMENT_GEN",
      "Agent Lập Hóa Đơn",
      `Đã chuẩn bị đầy đủ bảng tính Excel hóa đơn và ảnh phiếu thu có mã VietQR cho ${unpaid.length} phòng: ${unpaid.map((r) => r.id).join(", ")}.`,
      "action"
    );

    for (let i = 0; i < unpaid.length; i++) {
      const room = unpaid[i];
      await new Promise((r) => setTimeout(r, 400));

      const res = await dispatchZaloMessageAuto(room, settings);
      const nowStr = `${new Date().toLocaleDateString("vi-VN")} ${res.timestamp}`;

      setRooms((curr) =>
        curr.map((r) =>
          r.id === room.id
            ? {
                ...r,
                zaloSendStatus: "SENT",
                lastZaloSentAt: nowStr,
                lastAutoSentAt: nowStr,
                reminderCount: (r.reminderCount || 0) + 1,
                hasExcelInvoice: true,
                hasImageInvoice: true,
              }
            : r
        )
      );

      addAgentLog(
        "AUTO_COLLECTOR",
        "Agent Thu Tiền Tự Động",
        `[ĐÃ GỬI ZALO] Phòng ${room.id} (${room.tenant} - ${room.phone}): Đã gửi tin nhắn nhắc nợ kèm mã VietQR ${formatVND(roomTotal(room, settings))}.`,
        "success"
      );

      showToast(`✅ Đã gửi Zalo thành công cho ${room.tenant} (Phòng ${room.id})!`, "success");
    }

    setAgents((agList) =>
      agList.map((a) =>
        a.role === "AUTO_COLLECTOR" || a.role === "DOCUMENT_GEN"
          ? { ...a, tasksCompleted: a.tasksCompleted + unpaid.length }
          : a
      )
    );

    showToast(`🎉 Agent đã hoàn tất gửi tin nhắn tự động qua Zalo cho tất cả ${unpaid.length} khách thuê!`, "success");
  };

  const handleUpload = async (file: File) => {
    try {
      const result = await importRoomsFile(file, rooms);
      if (result.updated === 0) {
        showToast("Không tìm thấy dòng phòng hợp lệ (cột “Phòng”, ví dụ P101).", "error");
        return;
      }
      setRooms(result.rooms);
      const extra = result.unknown.length ? ` • Bỏ qua: ${result.unknown.join(", ")}` : "";
      showToast(`Đã cập nhật ${result.updated} phòng từ ${result.fileName}${extra}`);

      addAgentLog(
        "ACCOUNTING",
        "Agent Kế toán",
        `Đã nhập thành công ${result.updated} phòng từ file Excel "${result.fileName}". Tự động kích hoạt đối soát.`,
        "success"
      );
    } catch {
      showToast("Không đọc được file. Vui lòng dùng .xlsx hoặc .csv đúng mẫu.", "error");
    }
  };

  const handleDownloadSample = () => {
    downloadSampleWorkbook(rooms);
    showToast("Đã tải file mẫu mau-dien-nuoc-12-phong.xlsx", "info");
  };

  const handleExportReport = () => {
    exportReportWorkbook(rooms, settings);
    showToast("Đã tải xuống file báo cáo doanh thu & công nợ", "success");
    addAgentLog(
      "ACCOUNTING",
      "Agent Kế toán",
      "Đã xuất báo cáo tổng hợp doanh thu & công nợ ra file Excel cho ban quản trị.",
      "info"
    );
  };

  /** "Giả lập khách CK" */
  const handleSimulatePayment = () => {
    const picked =
      (selectedRoom && isUnpaid(selectedRoom.status) && selectedRoom) ||
      rooms.find((r) => isUnpaid(r.status));

    if (!picked) {
      showToast("Tất cả phòng đã đóng tiền 🎉", "info");
      return;
    }

    playTingTing();
    setRooms((prev) =>
      prev.map((r) =>
        r.id === picked.id ? { ...r, status: "PAID", invoiceIssued: true } : r
      )
    );
    setSelectedId(picked.id);
    setFlashId(picked.id);

    addAgentLog(
      "TREASURY",
      "Agent Ngân quỹ",
      `Ting ting! Bắt thành công giao dịch chuyển khoản từ ${settings.bankName}: THANHTOAN ${picked.id} (${formatVND(roomTotal(picked, settings))}). Đã tự động xuất HĐĐT #HD${picked.id}-EINV!`,
      "success"
    );

    addAgentLog(
      "FACILITY_3D",
      "Agent Tòa nhà 3D",
      `Cập nhật phòng ${picked.id} sang màu Xanh lá (Đã đóng). Kích hoạt hiệu ứng nhịp đập 3D.`,
      "info"
    );

    showToast(
      `Ting ting! Phòng ${picked.id} đã thanh toán ${formatVND(roomTotal(picked, settings))} • HĐĐT đã xuất`
    );
  };

  // Xác nhận đã thu tiền từ Drawer
  const handleConfirmPayment = (roomId: string) => {
    const r = rooms.find((x) => x.id === roomId);
    if (!r) return;

    playTingTing();
    setRooms((prev) =>
      prev.map((item) =>
        item.id === roomId ? { ...item, status: "PAID", invoiceIssued: true } : item
      )
    );
    setFlashId(roomId);

    addAgentLog(
      "TREASURY",
      "Agent Ngân quỹ",
      `Xác nhận thu tiền phòng ${roomId} (${formatVND(roomTotal(r, settings))}). Đã ký số & xuất HĐĐT thành công.`,
      "success"
    );

    showToast(
      `Ting ting! Xác nhận thu tiền phòng ${roomId} (${formatVND(roomTotal(r, settings))}) thành công • HĐĐT đã xuất`
    );
  };

  // Sửa nhanh chỉ số điện mới trực tiếp
  const handleUpdateElectricNew = (roomId: string, newElectric: number) => {
    setRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, electricNew: newElectric } : r))
    );
  };

  // Cập nhật thông tin phòng & Zalo
  const handleUpdateRoomDetails = (roomId: string, updates: Partial<Room>) => {
    setRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, ...updates } : r))
    );
    showToast(`Đã cập nhật thông tin phòng ${roomId}`, "success");
    addAgentLog(
      "ZALO_CSKH",
      "Agent CSKH Zalo",
      `Đã cập nhật thông tin khách thuê & liên hệ Zalo phòng ${roomId}.`,
      "info"
    );
  };

  // Thêm phòng mới
  const handleAddRoom = (newRoom: Room) => {
    setRooms((prev) => [...prev, newRoom]);
    setAddRoomOpen(false);
    setSelectedId(newRoom.id);
    showToast(`Đã thêm phòng ${newRoom.id} vào tòa nhà thành công!`, "success");

    addAgentLog(
      "FACILITY_3D",
      "Agent Tòa nhà 3D",
      `Đã khởi tạo khối kiến trúc phòng ${newRoom.id} tại Tầng ${newRoom.floor} trên mô hình 3D.`,
      "success"
    );
  };

  // Xóa khách thuê (Trả phòng -> Đưa phòng về trạng thái Trống)
  const handleRemoveTenant = (roomId: string) => {
    const r = rooms.find((x) => x.id === roomId);
    const tenantName = r?.tenant || "Khách thuê";

    setRooms((prev) =>
      prev.map((item) =>
        item.id === roomId
          ? {
              ...item,
              tenant: "",
              phone: "",
              zaloName: undefined,
              idCard: undefined,
              zaloNote: undefined,
              startDate: undefined,
              dueDate: "--",
              status: "EMPTY",
              invoiceIssued: false,
              reminderCount: 0,
              lastZaloSentAt: undefined,
              lastAutoSentAt: undefined,
              zaloSendStatus: "NOT_SENT",
            }
          : item
      )
    );

    addAgentLog(
      "FACILITY_3D",
      "Agent Tòa nhà 3D",
      `Đã xóa khách thuê ${tenantName} khỏi phòng ${roomId}. Phòng đã chuyển về trạng thái Trống.`,
      "warning"
    );

    showToast(`Đã xóa khách ${tenantName} khỏi phòng ${roomId}! Phòng hiện đang trống.`, "info");
  };

  // Xóa hẳn phòng khỏi tòa nhà (nếu phòng trống)
  const handleDeleteRoom = (roomId: string) => {
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
    if (selectedId === roomId) setSelectedId(null);

    addAgentLog(
      "FACILITY_3D",
      "Agent Tòa nhà 3D",
      `Đã xóa phòng ${roomId} khỏi tòa nhà 3D.`,
      "warning"
    );

    showToast(`Đã xóa phòng ${roomId} khỏi tòa nhà.`, "info");
  };

  // Gửi tin nhắn Zalo (Tự động gửi + sao chép + mở Zalo)
  const handleSendZaloMessage = async (room: Room) => {
    if (!room.phone) {
      showToast("Phòng chưa có số điện thoại Zalo để liên hệ.", "error");
      return;
    }

    const res = await dispatchZaloMessageAuto(room, settings);

    // Cập nhật trạng thái gửi
    setRooms((curr) =>
      curr.map((r) =>
        r.id === room.id
          ? {
              ...r,
              zaloSendStatus: res.success ? "SENT" : "FAILED",
              lastZaloSentAt: `${new Date().toLocaleDateString("vi-VN")} ${res.timestamp}`,
            }
          : r
      )
    );

    // Sao chép tin nhắn vào clipboard và mở Zalo
    const message = buildReminderMessage(room, settings);
    await copyText(message);
    openZaloDirect(room.phone);

    addAgentLog(
      "ZALO_CSKH",
      "Agent CSKH Zalo",
      `Đã gửi tin nhắn nhắc phí chu kỳ 1 tháng đến khách ${room.tenant} (${room.id} - ${room.phone}).`,
      "action"
    );

    showToast(
      `Đã sao chép tin nhắn nhắc tiền & mở Zalo của ${room.tenant || room.id}!`,
      "success"
    );
  };

  const handleCopyReminder = async (room: Room) => {
    const ok = await copyText(buildReminderMessage(room, settings));
    showToast(
      ok
        ? `Đã copy tin nhắn nhắc phí phòng ${room.id} vào clipboard`
        : "Trình duyệt chặn sao chép. Vui lòng thử lại.",
      ok ? "success" : "error"
    );
  };

  const handleCopyAllReminders = async (text: string) => {
    const ok = await copyText(text);
    showToast(
      ok
        ? "Đã sao chép tất cả tin nhắn nhắc phí nợ vào clipboard!"
        : "Trình duyệt chặn sao chép. Vui lòng thử lại.",
      ok ? "success" : "error"
    );
  };

  const handleSaveSettings = (next: Settings) => {
    setSettings(next);
    setSettingsOpen(false);
    showToast("Đã lưu cài đặt thanh toán & Zalo");
    addAgentLog(
      "TREASURY",
      "Agent Ngân quỹ",
      "Đã cập nhật thông tin cấu hình VietQR và chế độ gửi tin Zalo.",
      "info"
    );
  };

  const handleResetDefault = () => {
    setRooms(INITIAL_ROOMS);
    setSettings(DEFAULT_SETTINGS);
    setAgents(INITIAL_AGENTS);
    try {
      localStorage.removeItem(STORAGE_KEY_ROOMS);
      localStorage.removeItem(STORAGE_KEY_SETTINGS);
      localStorage.removeItem(STORAGE_KEY_AGENTS);
    } catch {
      // ignore
    }
    setSettingsOpen(false);
    showToast("Đã khôi phục dữ liệu mẫu 12 phòng ban đầu", "info");
  };

  // Cập nhật cấu hình Quản Trị Viên & Master Autopilot
  const handleUpdateAdminSettings = (updates: Partial<AdminSettings>) => {
    setAdminSettings((prev) => {
      const next = { ...prev, ...updates };
      if (updates.autopilotEnabled !== undefined) {
        setAutopilot(updates.autopilotEnabled);
      }
      return next;
    });
  };

  // Điều phối Gói Hóa Đơn Đa Phương Tiện 4-trong-1 (Worker 3)
  const handleDispatchBundle4In1 = async (room: Room) => {
    try {
      showToast(`Đang kết xuất Gói Hóa Đơn 4-trong-1 phòng ${room.id}...`, "info");
      const bundle = await buildRoomInvoiceBundle4In1(room, settings, zaloSession);
      const res = await dispatchBundle4In1(bundle, { hostSession: zaloSession });

      const nowStr = `${new Date().toLocaleDateString("vi-VN")} ${getNowTimeStr()}`;
      setRooms((curr) =>
        curr.map((r) =>
          r.id === room.id
            ? {
                ...r,
                zaloSendStatus: "SENT",
                lastZaloSentAt: nowStr,
                lastAutoSentAt: nowStr,
                reminderCount: (r.reminderCount || 0) + 1,
                hasExcelInvoice: true,
                hasImageInvoice: true,
                invoiceIssued: true,
              }
            : r
        )
      );

      addAgentLog(
        "DOCUMENT_GEN",
        "Gói Hóa Đơn 4-trong-1",
        `Đã phát hành trọn gói 4 món (Tin nhắn, VietQR, Phiếu thu 2x Retina, Excel) cho phòng ${room.id} (${room.tenant}).`,
        "success"
      );

      if (res.success) {
        showToast(res.message || `Đã gửi trọn gói 4-trong-1 phòng ${room.id}!`, "success");
      } else {
        showToast(res.message || "Không thể gửi trọn gói", "error");
      }
    } catch (err: any) {
      console.error("Lỗi gửi 4-trong-1:", err);
      showToast(`Lỗi xử lý: ${err?.message || "Không xác định"}`, "error");
    }
  };

  // Chạy thu nợ hàng loạt cho tất cả các phòng quá hạn (Admin batch run)
  const handleRunBatchOverdue = async () => {
    const overdueList = rooms.filter(
      (r) => (r.status === "OVERDUE" || r.status === "PENDING") && r.phone
    );

    if (overdueList.length === 0) {
      showToast("Không có phòng nào đang quá hạn cần gửi thu tiền!", "info");
      return;
    }

    showToast(`Đang lập và gửi trọn gói 4-trong-1 cho ${overdueList.length} phòng nợ...`, "info");

    for (const r of overdueList) {
      try {
        const bundle = await buildRoomInvoiceBundle4In1(r, settings, zaloSession);
        await dispatchBundle4In1(bundle, { openZalo: false, hostSession: zaloSession });

        const nowStr = `${new Date().toLocaleDateString("vi-VN")} ${getNowTimeStr()}`;
        setRooms((curr) =>
          curr.map((item) =>
            item.id === r.id
              ? {
                  ...item,
                  zaloSendStatus: "SENT",
                  lastZaloSentAt: nowStr,
                  lastAutoSentAt: nowStr,
                  reminderCount: (item.reminderCount || 0) + 1,
                  hasExcelInvoice: true,
                  hasImageInvoice: true,
                  invoiceIssued: true,
                }
              : item
          )
        );

        addAgentLog(
          "AUTO_COLLECTOR",
          "Thu Nợ Hàng Loạt",
          `[ADMIN BATCH] Đã lập hồ sơ 4-trong-1 phòng ${r.id} (${r.tenant} - ${r.phone}).`,
          "action"
        );
      } catch (err) {
        console.warn("Lỗi gửi batch phòng", r.id, err);
      }
    }

    showToast(`Đã hoàn tất xử lý hàng loạt ${overdueList.length} phòng nợ!`, "success");
  };

  const closeDrawer = () => {
    setSelectedId(null);
    if (mobileTab === "rooms") setMobileTab("3d");
  };

  const handleTabChange = (tab: MobileTab) => {
    setMobileTab(tab);
    if (tab === "3d") {
      setSelectedId(null);
      setCustomerManagerOpen(false);
      setAutoZaloSenderOpen(false);
      setSettingsOpen(false);
    } else if (tab === "rooms") {
      setCustomerManagerOpen(false);
      setAutoZaloSenderOpen(false);
      setSettingsOpen(false);
      if (!selectedId) {
        const target = rooms.find((r) => isUnpaid(r.status)) || rooms[0];
        if (target) {
          setSelectedId(target.id);
          setFlashId(target.id);
        }
      }
    } else if (tab === "customers") {
      setCustomerManagerOpen(true);
      setAutoZaloSenderOpen(false);
      setSettingsOpen(false);
    } else if (tab === "zalo") {
      setAutoZaloSenderOpen(true);
      setCustomerManagerOpen(false);
      setSettingsOpen(false);
    } else if (tab === "settings") {
      setSettingsOpen(true);
      setCustomerManagerOpen(false);
      setAutoZaloSenderOpen(false);
    }
  };

  const handleToggleFilterStatus = (status: RoomStatus) => {
    setFilterStatus((prev) => (prev === status ? null : status));
  };

  const canShowReceipt = !!activeZaloRoom && activeZaloRoom.status !== "EMPTY";

  // Kiểm tra bất kỳ modal nào đang mở trên giao diện
  const isAnyModalOpen =
    adminModalOpen ||
    zaloAuthModalOpen ||
    settingsOpen ||
    addRoomOpen ||
    agentCompanyOpen ||
    zaloOpen ||
    batchReminderOpen ||
    autoZaloSenderOpen ||
    customerManagerOpen ||
    mobileAppQrOpen;

  // 3D Interaction Lock: Khóa khi RoomDrawer đang mở (selectedRoom !== null) hoặc bất kỳ modal nào đang mở
  const is3DInteractionLocked = selectedRoom !== null || isAnyModalOpen;

  return (
    <div className="h-app-dvh h-[100dvh] w-full overflow-hidden bg-slate-50 flex flex-col">
      {/* Thu gọn Header trên mobile thành thanh trạng thái tối giản, áp dụng safe-top */}
      <div className="safe-top pt-[env(safe-area-inset-top,0px)] w-full shrink-0">
        <Header
          unpaidCount={unpaidCount}
          tenantCount={rooms.filter((r) => r.status !== "EMPTY" && r.tenant).length}
          onUpload={handleUpload}
          onDownloadSample={handleDownloadSample}
          onExportReport={handleExportReport}
          onOpenAddRoom={() => setAddRoomOpen(true)}
          onOpenCustomerManager={() => {
            setCustomerManagerOpen(true);
            setMobileTab("customers");
          }}
          onSimulatePayment={handleSimulatePayment}
          onOpenSettings={() => {
            setSettingsOpen(true);
            setMobileTab("settings");
          }}
          onOpenMobileApp={() => setMobileAppQrOpen(true)}
          onOpenAdmin={() => setAdminModalOpen(true)}
          onOpenZaloAuth={() => setZaloAuthModalOpen(true)}
          isZaloConnected={isZaloHostAuthorized(zaloSession)}
          zaloHostName={zaloSession.hostName}
        />
      </div>

      <main
        className={cn(
          "relative flex-1 w-full overflow-hidden bg-slate-50 mt-[calc(60px+env(safe-area-inset-top,0px))] md:mt-[72px]",
          isVirtualKeyboardOpen
            ? "pb-0"
            : "pb-[calc(64px+env(safe-area-inset-bottom,0px))] md:pb-0"
        )}
      >
        {/* 3D Canvas - Khóa tương tác chống xoay nhầm khi Drawer hoặc Modal mở */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 right-0 transition-[right] duration-300 ease-out",
            selectedRoom && "md:right-[410px]",
            is3DInteractionLocked && "pointer-events-none touch-none select-none"
          )}
        >
          <Building3D
            rooms={rooms}
            settings={settings}
            selectedId={selectedId}
            flashId={flashId}
            selectedFloor={selectedFloor}
            filterStatus={filterStatus}
            onSelectFloor={setSelectedFloor}
            onSelect={(id) => {
              setSelectedId(id);
              setMobileTab("rooms");
            }}
            isLocked={is3DInteractionLocked}
          />
        </div>

        {/* Thống kê doanh thu nổi – góc trên bên trái */}
        <div className="pointer-events-auto absolute left-5 top-5 z-10 w-68 rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-lg shadow-slate-200/60 backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Doanh thu tháng 05/2026
            </p>
            <TrendingUp className="w-4 h-4 shrink-0 text-emerald-600" />
          </div>
          <p className="mt-1.5 text-xl font-bold tabular-nums tracking-tight text-slate-900">
            {formatVND(revenue.collected)}
          </p>
          <p className="text-xs text-slate-500">
            trên tổng dự kiến {formatVND(revenue.expected)}
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
              style={{ width: `${revenue.pct}%` }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1 font-medium">
              <Receipt className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              {counts.PAID + counts.PENDING + counts.OVERDUE} phòng có khách
            </span>
            <span className="font-bold text-emerald-700">{revenue.pct}% đã thu</span>
          </div>
        </div>

        {/* Gợi ý thao tác */}
        <div className="pointer-events-none absolute left-1/2 top-5 z-10 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-4 py-1.5 text-xs font-medium text-slate-500 shadow-sm backdrop-blur md:flex">
          <MousePointerClick className="w-3.5 h-3.5 shrink-0 text-slate-400" />
          <span>Kéo xoay 3D • Cuộn phóng to • Bấm chọn phòng</span>
        </div>

        {/* Chú thích trạng thái & bộ lọc */}
        <Legend
          counts={counts}
          filterStatus={filterStatus}
          onToggleFilterStatus={handleToggleFilterStatus}
        />
      </main>

      {/* Ngăn kéo chi tiết phòng */}
      <RoomDrawer
        room={selectedRoom}
        settings={settings}
        onClose={closeDrawer}
        onCopyReminder={handleCopyReminder}
        onOpenZalo={(r) => {
          setZaloRoomId(r.id);
          setZaloOpen(true);
        }}
        onConfirmPayment={handleConfirmPayment}
        onUpdateElectricNew={handleUpdateElectricNew}
        onUpdateRoomDetails={handleUpdateRoomDetails}
        onSendZaloMessage={handleSendZaloMessage}
        onDownloadExcelInvoice={handleDownloadExcelInvoice}
        onDownloadReceiptImage={handleDownloadReceiptImage}
        onRemoveTenant={handleRemoveTenant}
        onDeleteRoom={handleDeleteRoom}
        onDispatchBundle4In1={handleDispatchBundle4In1}
      />

      {/* Modal Zalo Mini App */}
      {zaloOpen && canShowReceipt && activeZaloRoom && (
        <ZaloMiniAppModal
          room={activeZaloRoom}
          settings={settings}
          onClose={() => {
            setZaloOpen(false);
            setZaloRoomId(null);
          }}
          onLaunch={(name) => showToast(`Đang mở ${name} (mô phỏng)…`, "info")}
        />
      )}

      {/* Modal Nhắc nợ hàng loạt */}
      {batchReminderOpen && (
        <BatchReminderModal
          rooms={rooms}
          settings={settings}
          onClose={() => setBatchReminderOpen(false)}
          onCopyAll={handleCopyAllReminders}
          onCopySingle={handleCopyReminder}
          onSendZaloMessage={handleSendZaloMessage}
          onAutoSendAllZalo={handleAutoSendAllZalo}
          onOpenZalo={(r) => {
            setZaloRoomId(r.id);
            setZaloOpen(true);
          }}
        />
      )}

      {/* Modal Thêm phòng mới */}
      {addRoomOpen && (
        <AddRoomModal
          existingRooms={rooms}
          onAddRoom={handleAddRoom}
          onClose={() => setAddRoomOpen(false)}
        />
      )}

      {/* Modal Công ty Agent Điều hành */}
      {agentCompanyOpen && (
        <AgentCompanyModal
          agents={agents}
          logs={agentLogs}
          rooms={rooms}
          settings={settings}
          autopilot={autopilot}
          onToggleAutopilot={() => {
            setAutopilot((p) => !p);
            showToast(
              !autopilot
                ? "Đã kích hoạt chế độ Autopilot: 6 Agent tự động điều hành 24/7!"
                : "Đã tạm dừng chế độ Autopilot.",
              "info"
            );
          }}
          onRunCycleNow={handleRunAgentCycleNow}
          onDownloadExcelInvoice={handleDownloadExcelInvoice}
          onDownloadReceiptImage={handleDownloadReceiptImage}
          onAutoSendAllZalo={handleAutoSendAllZalo}
          onSendZaloMessage={handleSendZaloMessage}
          onClearLogs={() => setAgentLogs([])}
          onClose={() => setAgentCompanyOpen(false)}
        />
      )}

      {/* Modal Trung Tâm Điều Phối Tin Nhắn & Hóa Đơn Zalo Tự Động */}
      {autoZaloSenderOpen && (
        <AutoZaloSenderModal
          rooms={rooms}
          settings={settings}
          onClose={() => {
            setAutoZaloSenderOpen(false);
            if (mobileTab === "zalo") setMobileTab("3d");
          }}
          onDownloadExcelInvoice={handleDownloadExcelInvoice}
          onDownloadReceiptImage={handleDownloadReceiptImage}
          onConfirmSent={(roomId) => {
            const nowStr = `${new Date().toLocaleDateString("vi-VN")} ${getNowTimeStr()}`;
            setRooms((curr) =>
              curr.map((r) =>
                r.id === roomId
                  ? {
                      ...r,
                      zaloSendStatus: "SENT",
                      lastZaloSentAt: nowStr,
                      lastAutoSentAt: nowStr,
                      reminderCount: (r.reminderCount || 0) + 1,
                      hasExcelInvoice: true,
                      hasImageInvoice: true,
                    }
                  : r
              )
            );
            addAgentLog(
              "AUTO_COLLECTOR",
              "Agent Thu Tiền Tự Động",
              `[ĐÃ GỬI ZALO] Phòng ${roomId}: Đã sao chép tin nhắn & mở khung chat Zalo của khách kèm tệp hóa đơn Excel.`,
              "success"
            );
          }}
          onAutoSendAll={handleAutoSendAllZalo}
        />
      )}

      {/* Modal Quản lý khách hàng & Khách thuê */}
      {customerManagerOpen && (
        <CustomerManagerModal
          rooms={rooms}
          settings={settings}
          onClose={() => {
            setCustomerManagerOpen(false);
            if (mobileTab === "customers") setMobileTab("3d");
          }}
          onUpdateRoomDetails={handleUpdateRoomDetails}
          onRemoveTenant={handleRemoveTenant}
          onSelectRoom={(roomId) => {
            setSelectedId(roomId);
            setFlashId(roomId);
            setCustomerManagerOpen(false);
            setMobileTab("rooms");
          }}
        />
      )}

      {/* Modal Cài đặt */}
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onResetDefault={handleResetDefault}
          onClose={() => {
            setSettingsOpen(false);
            if (mobileTab === "settings") setMobileTab("3d");
          }}
        />
      )}

      {/* Modal Tải App Native Độc Lập Cho Điện Thoại */}
      {mobileAppQrOpen && (
        <MobileDownloadModal onClose={() => setMobileAppQrOpen(false)} />
      )}

      {/* Modal Bảng Quản Trị Hệ Thống & Master Autopilot 24/7 (Admin) */}
      <AdminControlModal
        isOpen={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
        adminSettings={adminSettings}
        onUpdateAdminSettings={handleUpdateAdminSettings}
        logs={agentLogs as unknown as AgentLogEntry[]}
        onClearLogs={() => setAgentLogs([])}
        onRunBatchOverdue={handleRunBatchOverdue}
        overdueRooms={rooms.filter((r) => r.status === "OVERDUE")}
        onShowToast={showToast}
      />

      {/* Modal Xác Thực & Quản Lý Phiên Zalo Chủ Nhà */}
      <ZaloAuthModal
        isOpen={zaloAuthModalOpen}
        onClose={() => setZaloAuthModalOpen(false)}
        onSessionChange={(s) => setZaloSession(s)}
      />

      {/* Thanh điều hướng đáy Native cho Mobile (Tự động ẩn khi bàn phím ảo mở để chống nổi) */}
      {!isVirtualKeyboardOpen && (
        <BottomNav
          activeTab={mobileTab}
          onTabChange={handleTabChange}
          unpaidCount={unpaidCount}
          tenantCount={rooms.filter((r) => r.status !== "EMPTY" && r.tenant).length}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}
