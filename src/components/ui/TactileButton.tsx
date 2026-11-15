import React, { useState, useRef, forwardRef, ButtonHTMLAttributes } from "react";
import { triggerHaptic } from "../../utils/platformBridge";
import { cn } from "../../utils/cn";

export type TactileButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "indigo"
  | "emerald"
  | "amber";

export type TactileButtonSize = "xs" | "sm" | "md" | "lg" | "icon-xs" | "icon-sm" | "icon" | "icon-lg";

export type HapticStyle = "light" | "medium" | "heavy" | "success" | "none";

export interface TactileButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: TactileButtonVariant;
  size?: TactileButtonSize;
  haptic?: HapticStyle;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

interface RippleEffect {
  id: number;
  x: number;
  y: number;
  size: number;
}

const variantStyles: Record<TactileButtonVariant, string> = {
  primary:
    "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-sm shadow-emerald-200 border border-emerald-500/20",
  emerald:
    "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-sm shadow-emerald-200 border border-emerald-500/20",
  secondary:
    "bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-slate-300 border border-slate-200/80 shadow-xs",
  outline:
    "bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 border border-slate-200 shadow-xs",
  ghost:
    "bg-transparent text-slate-600 hover:bg-slate-100 active:bg-slate-200/80 border border-transparent",
  danger:
    "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-sm shadow-rose-200 border border-rose-500/20",
  indigo:
    "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-sm shadow-indigo-200 border border-indigo-500/20",
  amber:
    "bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700 shadow-sm shadow-amber-200 border border-amber-400/20",
};

const sizeStyles: Record<TactileButtonSize, string> = {
  xs: "h-7 px-2.5 text-xs rounded-lg gap-1.5",
  sm: "h-8 px-3 text-xs font-semibold rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm font-semibold rounded-xl gap-2",
  lg: "h-12 px-5 text-base font-semibold rounded-xl gap-2.5",
  "icon-xs": "h-7 w-7 p-0 rounded-lg justify-center",
  "icon-sm": "h-8 w-8 p-0 rounded-lg justify-center",
  icon: "h-10 w-10 p-0 rounded-xl justify-center",
  "icon-lg": "h-12 w-12 p-0 rounded-xl justify-center",
};

/**
 * TactileButton - Phím bấm cảm ứng siêu nhạy chuẩn Mobile-First
 * Hỗ trợ:
 * - Hiệu ứng nén vật lý Spring: active:scale-[0.96] transition-all duration-150 ease-out active:brightness-95 select-none
 * - Phản hồi xúc giác phần cứng (Haptic Feedback: light / medium)
 * - Tối ưu cử chỉ chạm: touch-action: manipulation, loại bỏ tap highlight trên WebKit
 * - Hiệu ứng ánh sáng chạm tỏa nhẹ (Subtle Ripple & Radial Glow)
 */
export const TactileButton = forwardRef<HTMLButtonElement, TactileButtonProps>(
  (
    {
      children,
      className,
      variant = "primary",
      size = "md",
      haptic = "light",
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled = false,
      onClick,
      onPointerDown,
      style,
      ...props
    },
    ref
  ) => {
    const [ripples, setRipples] = useState<RippleEffect[]>([]);
    const hapticTriggeredRef = useRef(false);

    const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled || isLoading) return;

      // Kích hoạt phản hồi rung xúc giác native
      if (haptic !== "none") {
        triggerHaptic(haptic);
        hapticTriggeredRef.current = true;
      }

      // Tạo hiệu ứng sóng gợn sáng chạm (Ripple Glow)
      try {
        const button = e.currentTarget;
        const rect = button.getBoundingClientRect();
        const rippleSize = Math.max(rect.width, rect.height) * 2;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const newRipple: RippleEffect = {
          id: Date.now() + Math.random(),
          x,
          y,
          size: rippleSize,
        };

        setRipples((prev) => [...prev.slice(-2), newRipple]);
      } catch {
        // ignore
      }

      onPointerDown?.(e);
    };

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || isLoading) {
        e.preventDefault();
        return;
      }

      // Fallback rung nếu chưa kích hoạt từ pointerDown (VD: kích hoạt bằng phím bàn phím Space / Enter)
      if (!hapticTriggeredRef.current && haptic !== "none") {
        triggerHaptic(haptic);
      }
      hapticTriggeredRef.current = false;

      onClick?.(e);
    };

    const isLightVariant = variant === "outline" || variant === "ghost" || variant === "secondary";

    return (
      <button
        ref={ref}
        type={props.type || "button"}
        disabled={disabled || isLoading}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        style={{
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          ...style,
        }}
        className={cn(
          // Cơ chế đàn hồi vật lý & chống bôi đen văn bản khi thao tác nhanh
          "relative inline-flex items-center justify-center font-medium overflow-hidden cursor-pointer",
          "select-none active:scale-[0.96] transition-all duration-150 ease-out active:brightness-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1",
          "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed",
          "[touch-action:manipulation] [-webkit-tap-highlight-color:transparent]",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {/* Subtle Radial Glow Overlay on Active Touch */}
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-150 active:opacity-100",
            isLightVariant ? "bg-slate-900/5" : "bg-white/15"
          )}
        />

        {/* Dynamic Ripple Wave Elements */}
        {ripples.map((r) => (
          <span
            key={r.id}
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full animate-tactile-ripple",
              isLightVariant ? "bg-slate-400/20" : "bg-white/30"
            )}
            style={{
              left: r.x,
              top: r.y,
              width: r.size,
              height: r.size,
            }}
            onAnimationEnd={() => {
              setRipples((prev) => prev.filter((item) => item.id !== r.id));
            }}
          />
        ))}

        {/* Loading Spinner */}
        {isLoading && (
          <svg
            className="h-4 w-4 animate-spin shrink-0 text-current opacity-90"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}

        {/* Content with Icon slots */}
        {!isLoading && leftIcon && (
          <span className="shrink-0 transition-transform active:scale-95">{leftIcon}</span>
        )}

        <span className="relative z-10 truncate">{children}</span>

        {!isLoading && rightIcon && (
          <span className="shrink-0 transition-transform active:scale-95">{rightIcon}</span>
        )}
      </button>
    );
  }
);

TactileButton.displayName = "TactileButton";

export default TactileButton;
