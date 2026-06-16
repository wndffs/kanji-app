import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function Button({ children, style, type = "button", ...props }: ButtonProps) {
  return (
    <button
      style={{
        alignItems: "center",
        background: "#2364aa",
        border: 0,
        borderRadius: 6,
        color: "#ffffff",
        cursor: "pointer",
        display: "inline-flex",
        font: "inherit",
        fontWeight: 700,
        minHeight: 40,
        padding: "0 14px",
        ...style,
      }}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
