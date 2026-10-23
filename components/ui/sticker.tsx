import type { CSSProperties, HTMLAttributes } from "react";

export interface StickerProps extends HTMLAttributes<HTMLSpanElement> {
  /** Width in source Figma pixels; wraps text at exactly the original measure. */
  width?: number;
  active?: boolean;
}

export function Sticker({ width, active = false, className = "", style, children, ...props }: StickerProps) {
  return (
    <span
      className={`kit-sticker ${active ? "kit-sticker-active" : ""} ${className}`}
      style={{ ...(width ? { width: `calc(${width} * var(--kit-unit))` } : {}), ...style } as CSSProperties}
      {...props}
    >
      {children}
    </span>
  );
}
