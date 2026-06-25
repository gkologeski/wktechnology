import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AIInsightCardProps {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  variant?: "ai" | "dei";
  className?: string;
}

/**
 * AIInsightCard — discreet container for AI/DEI insights.
 * Uses semantic --ai / --dei tokens; never overpowers business content.
 */
export function AIInsightCard({
  title,
  description,
  children,
  action,
  variant = "ai",
  className,
}: AIInsightCardProps) {
  const isAi = variant === "ai";
  return (
    <section
      className={cn(
        "rounded-lg border p-4 shadow-xs",
        isAi ? "border-ai-border bg-ai-surface" : "border-[var(--dei-accent)]/30 bg-dei-surface",
        className,
      )}
    >
      <header className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md",
            isAi ? "bg-ai/15 text-ai" : "bg-dei/15 text-dei",
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {action ? <div className="ml-auto">{action}</div> : null}
      </header>
      {description ? <p className="mt-1.5 text-xs text-text-secondary">{description}</p> : null}
      {children ? <div className="mt-3 text-sm text-text-primary">{children}</div> : null}
    </section>
  );
}
