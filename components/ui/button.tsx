import Image from "next/image";
import type { ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "pink" | "purple";
  icon?: "arrow" | "refresh";
  /** Keeps the Figma hover variant visible in a component catalogue. */
  previewState?: "default" | "hover";
}

export function Button({
  variant = "purple", icon, previewState = "default", className = "", children, type = "button", ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-preview-state={previewState}
      className={`kit-button kit-button-${variant} flex w-full items-center justify-center disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      <span>{children}</span>
      {icon && (
        <Image
          className={`kit-button-icon kit-button-icon-${icon}`}
          src={`/assets/figma/${icon}.svg`}
          width={icon === "arrow" ? 43 : 20}
          height={icon === "arrow" ? 43 : 20}
          alt=""
          aria-hidden="true"
        />
      )}
    </button>
  );
}

export interface ArrowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  direction?: "left" | "right";
  "aria-label": string;
}

export function ArrowButton({ direction = "right", className = "", type = "button", ...props }: ArrowButtonProps) {
  return (
    <button type={type} className={`kit-arrow-button inline-flex shrink-0 items-center justify-center disabled:opacity-50 ${className}`} {...props}>
      <Image src="/assets/figma/chevron-right.svg" width={24} height={24} alt="" className={direction === "left" ? "rotate-180" : ""} />
    </button>
  );
}
