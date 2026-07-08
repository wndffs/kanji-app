import { type ReactNode } from "react";

type JapaneseTextProps = {
  readonly as?: "span" | "p" | "strong" | "h1" | "h2";
  readonly children: ReactNode;
  readonly className?: string;
  readonly variant?: "inline" | "display" | "sentence";
};

export function JapaneseText({
  as: Component = "span",
  children,
  className,
  variant = "inline",
}: JapaneseTextProps) {
  const classes = ["japanese-text", `japanese-text-${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <Component className={classes} lang="ja">
      {children}
    </Component>
  );
}
