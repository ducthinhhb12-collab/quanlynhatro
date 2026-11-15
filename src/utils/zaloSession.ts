import type { ZaloHostSession } from "../types/swarmContracts";

export const ZALO_SESSION_STORAGE_KEY = "an_gia_zalo_host_session_v2";

export const DEFAULT_ZALO_HOST_SESSION: ZaloHostSession = {
  isConnected: false,
  authMode: "profile_verified",
  hostName: "Lê Văn An (Chủ Nhà)",
  hostPhone: "0901234567",
  avatarUrl: "",
  webhookUrl: "",
  oaAccessToken: "",
  oaRefreshToken: "",
  lastConnectedAt: "",
  sessionToken: "",
};

// In-memory cache for ultra-fast and consistent sync reads
let cachedSession: ZaloHostSession | null = null;

// Session change listener registry
type SessionChangeListener = (session: ZaloHostSession) => void;
const sessionListeners = new Set<SessionChangeListener>();

/**
 * Helper to safely access Capacitor Preferences if installed / available on native
 */
const getCapacitorPreferences = () => {
  if (typeof window !== "undefined" && (window as any).Capacitor?.Plugins?.Preferences) {
    return (window as any).Capacitor.Plugins.Preferences;
  }
  return null;
};

/**
 * Notify all registered listeners and window events
 */
export const notifyZaloSessionListeners = (session: ZaloHostSession): void => {
  cachedSession = { ...session };
  sessionListeners.forEach((listener) => {
    try {
      listener(session);
    } catch (err) {
      console.error("[ZaloSession] Error in session change listener:", err);
    }
  });

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent("zalo-host-session-changed", { detail: session })
      );
    } catch {
      // Ignore if event dispatch fails in restricted env
    }
  }
};

/**
 * Synchronously retrieve the current ZaloHostSession from memory cache or localStorage
 */
export const getStoredZaloHostSession = (): ZaloHostSession => {
  if (cachedSession) {
    return { ...cachedSession };
  }

  if (typeof window === "undefined" || !window.localStorage) {
    return { ...DEFAULT_ZALO_HOST_SESSION };
  }

  try {
    const raw = window.localStorage.getItem(ZALO_SESSION_STORAGE_KEY);
    if (!raw) {
      cachedSession = { ...DEFAULT_ZALO_HOST_SESSION };
      return { ...DEFAULT_ZALO_HOST_SESSION };
    }
    const parsed = JSON.parse(raw);
    const merged: ZaloHostSession = {
      ...DEFAULT_ZALO_HOST_SESSION,
      ...parsed,
    };
    cachedSession = merged;
    return merged;
  } catch (err) {
    console.warn("[ZaloSession] Error parsing session from localStorage:", err);
    return { ...DEFAULT_ZALO_HOST_SESSION };
  }
};

/**
 * Asynchronously load ZaloHostSession with @capacitor/preferences fallback
 */
export const getZaloHostSession = async (): Promise<ZaloHostSession> => {
  const capPref = getCapacitorPreferences();
  if (capPref) {
    try {
      const res = await capPref.get({ key: ZALO_SESSION_STORAGE_KEY });
      if (res && res.value) {
        const parsed = JSON.parse(res.value);
        const merged: ZaloHostSession = {
          ...DEFAULT_ZALO_HOST_SESSION,
          ...parsed,
        };
        cachedSession = merged;
        return merged;
      }
    } catch (e) {
      console.warn("[ZaloSession] Capacitor Preferences read fallback to localStorage:", e);
    }
  }

  return getStoredZaloHostSession();
};

/**
 * Save / Update ZaloHostSession to localStorage and Capacitor Preferences
 */
export const saveZaloHostSession = async (
  sessionUpdate: Partial<ZaloHostSession>
): Promise<ZaloHostSession> => {
  const current = getStoredZaloHostSession();
  const nextSession: ZaloHostSession = {
    ...current,
    ...sessionUpdate,
  };

  // If connected is marked true and no lastConnectedAt given, record now
  if (nextSession.isConnected && !nextSession.lastConnectedAt) {
    nextSession.lastConnectedAt = new Date().toISOString();
  }

  const jsonStr = JSON.stringify(nextSession);

  // 1. Save to LocalStorage
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(ZALO_SESSION_STORAGE_KEY, jsonStr);
    } catch (err) {
      console.error("[ZaloSession] Failed to write localStorage:", err);
    }
  }

  // 2. Save to Capacitor Preferences if available
  const capPref = getCapacitorPreferences();
  if (capPref) {
    try {
      await capPref.set({
        key: ZALO_SESSION_STORAGE_KEY,
        value: jsonStr,
      });
    } catch (err) {
      console.warn("[ZaloSession] Failed to write Capacitor Preferences:", err);
    }
  }

  notifyZaloSessionListeners(nextSession);
  return nextSession;
};

/**
 * Clear ZaloHostSession back to initial unauthenticated state
 */
export const clearZaloHostSession = async (): Promise<ZaloHostSession> => {
  const clearedSession: ZaloHostSession = {
    ...DEFAULT_ZALO_HOST_SESSION,
    isConnected: false,
    lastConnectedAt: "",
    sessionToken: "",
  };

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(ZALO_SESSION_STORAGE_KEY);
    } catch (err) {
      console.error("[ZaloSession] Error removing from localStorage:", err);
    }
  }

  const capPref = getCapacitorPreferences();
  if (capPref) {
    try {
      await capPref.remove({ key: ZALO_SESSION_STORAGE_KEY });
    } catch (err) {
      console.warn("[ZaloSession] Error removing from Capacitor Preferences:", err);
    }
  }

  notifyZaloSessionListeners(clearedSession);
  return clearedSession;
};

/**
 * Check whether the Zalo host session is validly authorized
 */
export const isZaloHostAuthorized = (session?: ZaloHostSession | null): boolean => {
  const s = session || getStoredZaloHostSession();
  if (!s || !s.isConnected) {
    return false;
  }

  switch (s.authMode) {
    case "desktop_rpa":
      // In Desktop RPA mode, authorized when session flag is connected
      return Boolean(s.isConnected);

    case "webhook_api":
      // In Webhook mode, requires at least a webhook URL or OA access token
      return Boolean(
        s.isConnected &&
          ((s.webhookUrl && s.webhookUrl.trim().length > 0) ||
            (s.oaAccessToken && s.oaAccessToken.trim().length > 0))
      );

    case "profile_verified":
      // In verified profile mode, host phone is mandatory for digital signature
      return Boolean(
        s.isConnected &&
          s.hostName &&
          s.hostName.trim().length > 0 &&
          s.hostPhone &&
          s.hostPhone.replace(/[^\d]/g, "").length >= 9
      );

    default:
      return Boolean(s.isConnected);
  }
};

/**
 * Subscribe to ZaloHostSession changes
 * Returns an unsubscribe cleanup function
 */
export const subscribeZaloSessionChange = (
  listener: SessionChangeListener
): (() => void) => {
  sessionListeners.add(listener);
  // Immediately emit current state to the new listener
  try {
    listener(getStoredZaloHostSession());
  } catch (err) {
    console.error("[ZaloSession] Error invoking initial listener callback:", err);
  }

  return () => {
    sessionListeners.delete(listener);
  };
};

/**
 * Initialize Electron status listener to keep session in sync with RPA process
 */
if (typeof window !== "undefined" && window.electronAPI?.onZaloStatusChange) {
  try {
    window.electronAPI.onZaloStatusChange((status: { isLoggedIn: boolean }) => {
      const current = getStoredZaloHostSession();
      if (status.isLoggedIn && !current.isConnected && current.authMode === "desktop_rpa") {
        saveZaloHostSession({
          isConnected: true,
          lastConnectedAt: new Date().toISOString(),
        });
      } else if (!status.isLoggedIn && current.isConnected && current.authMode === "desktop_rpa") {
        // Only mark disconnected if currently desktop_rpa
        saveZaloHostSession({
          isConnected: false,
        });
      }
    });
  } catch (e) {
    console.warn("[ZaloSession] Could not attach Electron status listener:", e);
  }
}
