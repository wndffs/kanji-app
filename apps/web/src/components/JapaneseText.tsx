import { type ReactNode } from "react";

type JapaneseTextProps = {
  readonly as?: "span" | "p" | "strong" | "h1" | "h2";
  readonly children: ReactNode;
  readonly className?: string;
  readonly furigana?: string | null;
  readonly variant?: "inline" | "display" | "sentence";
};

export function JapaneseText({
  as: Component = "span",
  children,
  className,
  furigana = null,
  variant = "inline",
}: JapaneseTextProps) {
  const classes = ["japanese-text", `japanese-text-${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <Component className={classes} lang="ja">
      {furigana === null ? (
        children
      ) : (
        <ruby>
          {children}
          <rt>{furigana}</rt>
        </ruby>
      )}
    </Component>
  );
}
