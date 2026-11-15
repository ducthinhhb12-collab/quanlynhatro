import { useState, useEffect } from "react";
import { Building2, Home, Users, Send, Settings } from "lucide-react";
import { triggerHaptic } from "../utils/platformBridge";
import { cn } from "../utils/cn";

export type MobileTab = "3d" | "rooms" | "customers" | "zalo" | "settings";

interface Props {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  unpaidCount: number;
  tenantCount: number;
}

export default function BottomNavBar({
  activeTab,
  onTabChange,
  unpaidCount,
  tenantCount,
}: Props) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Tự động ẩn thanh điều hướng đáy khi bàn phím ảo mở lên trên điện thoại
  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.getAttribute("contenteditable") === "true")
      ) {
        setKeyboardVisible(true);
      }
    };

    const handleBlur = () => {
      setKeyboardVisible(false);
    };

    window.addEventListener("focusin", handleFocus);
    window.addEventListener("focusout", handleBlur);

    // Capacitor Keyboard Plugin nếu có
    if (typeof window !== "undefined" && (window as any).Capacitor) {
      try {
        const { Keyboard } = (window as any).Capacitor.Plugins || {};
        Keyboard?.addListener?.("keyboardWillShow", () => setKeyboardVisible(true));
        Keyboard?.addListener?.("keyboardWillHide", () => setKeyboardVisible(false));
      } catch {
        // ignore
      }
    }

    return () => {
      window.removeEventListener("focusin", handleFocus);
      window.removeEventListener("focusout", handleBlur);
    };
  }, []);

  if (keyboardVisible) return null;

  const tabs: { id: MobileTab; label: string; icon: any; badge?: number }[] = [
    { id: "3d", label: "Tòa Nhà 3D", icon: Building2 },
    { id: "rooms", label: "Phòng Trọ", icon: Home },
    { id: "customers", label: "Khách Thuê", icon: Users, badge: tenantCount },
    { id: "zalo", label: "Agent Zalo", icon: Send, badge: unpaidCount },
    { id: "settings", label: "Cài Đặt", icon: Settings },
  ];

  return (
    <nav
      aria-label="Thanh điều hướng di động"
      className="fixed inset-x-0 bottom-0 z-30 flex h-[64px] items-center justify-around border-t border-slate-200/90 bg-white/95 px-2 backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)] md:hidden shadow-lg"
    >
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = activeTab === t.id;

        return (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              triggerHaptic("light");
              onTabChange(t.id);
            }}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center py-1 transition-all active:scale-95",
              isActive ? "text-emerald-600" : "text-slate-500 hover:text-slate-800"
            )}
          >
            <div className="relative">
              <Icon className={cn("w-5 h-5 transition-transform", isActive && "scale-110")} />
              {t.badge !== undefined && t.badge > 0 && (
                <span
                  className={cn(
                    "absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black text-white",
                    t.id === "zalo" ? "bg-rose-500" : "bg-indigo-600"
                  )}
                >
                  {t.badge}
                </span>
              )}
            </div>
            <span
              className={cn(
                "mt-1 text-[10px] font-semibold tracking-tight",
                isActive ? "font-bold text-emerald-700" : "text-slate-500"
              )}
            >
              {t.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}