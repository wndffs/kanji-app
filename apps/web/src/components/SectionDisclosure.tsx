import { type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function SectionDisclosure({
  title,
  children,
  defaultOpen = false,
  className = "",
  onOpen,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly defaultOpen?: boolean;
  readonly className?: string;
  readonly onOpen?: () => void;
}) {
  return (
    <details
      className={`section-disclosure ${className}`}
      open={defaultOpen || undefined}
      onToggle={(event) => {
        if (event.currentTarget.open) onOpen?.();
      }}
    >
      <summary role="button">
        <span>{title}</span>
        <ChevronDown aria-hidden="true" size={18} />
      </summary>
      <div className="disclosure-content">{children}</div>
    </details>
  );
}
