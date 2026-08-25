import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/**
 * FormSection shell — created in Wave 0 for future form redesigns.
 * Not yet applied; reserve for form-heavy screens.
 */
export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <section
      className={cn(
        "grid gap-6 border-b border-border-subtle py-6 last:border-0 md:grid-cols-[260px_1fr]",
        className,
      )}
    >
      <div>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {description ? <p className="mt-1 text-xs text-text-secondary">{description}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
