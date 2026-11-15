import { useState, useEffect } from "react";
import { Building2, Home, Users, Send, Settings } from "lucide-react";
import { triggerHaptic } from "../utils/platformBridge";
import { cn } from "../utils/cn";

export type MobileTab = "3d" | "rooms" | "customers" | "zalo" | "settings";

export interface BottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  unpaidCount?: number;
  tenantCount?: number;
  roomCount?: number;
}

export default function BottomNav({
  activeTab,
  onTabChange,
  unpaidCount = 0,
  tenantCount = 0,
}: BottomNavProps) {
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

  // 5 tab chính một tay trong Thumb Zone tối ưu
  const tabs: { id: MobileTab; label: string; icon: any; badge?: number }[] = [
    { id: "3d", label: "Tòa Nhà 3D", icon: Building2 },
    { id: "rooms", label: "12 Phòng", icon: Home },
    { id: "customers", label: "Khách Thuê", icon: Users, badge: tenantCount },
    { id: "zalo", label: "Agent Zalo", icon: Send, badge: unpaidCount },
    { id: "settings", label: "Cài Đặt", icon: Settings },
  ];

  return (
    <nav
      aria-label="Thanh điều hướng di động"
      className="md:hidden z-40 fixed bottom-0 inset-x-0 border-t border-slate-200/90 bg-white/95 px-2 backdrop-blur-md pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-1.5 shadow-lg flex items-center justify-around gap-2"
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
              "relative flex flex-1 flex-col items-center justify-center min-w-[48px] min-h-[48px] py-1 px-1 rounded-xl select-none touch-manipulation",
              "active:scale-[0.96] transition-transform duration-150",
              isActive
                ? "text-emerald-600 bg-emerald-50/60 font-bold"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <div className="relative flex items-center justify-center">
              <Icon
                className={cn(
                  "w-5 h-5 transition-transform duration-150",
                  isActive ? "scale-110 text-emerald-600" : "text-slate-500"
                )}
              />
              {t.badge !== undefined && t.badge > 0 && (
                <span
                  className={cn(
                    "absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black text-white shadow-xs",
                    t.id === "zalo" ? "bg-rose-500" : "bg-indigo-600"
                  )}
                >
                  {t.badge}
                </span>
              )}
            </div>
            <span
              className={cn(
                "mt-1 text-[10px] tracking-tight whitespace-nowrap",
                isActive ? "font-bold text-emerald-700" : "font-medium text-slate-500"
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
