import { type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function SectionDisclosure({
  title,
  children,
  defaultOpen = false,
  className = "",
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly defaultOpen?: boolean;
  readonly className?: string;
}) {
  return (
    <details className={`section-disclosure ${className}`} open={defaultOpen || undefined}>
      <summary>
        <span>{title}</span>
        <ChevronDown aria-hidden="true" size={18} />
      </summary>
      <div className="disclosure-content">{children}</div>
    </details>
  );
}
