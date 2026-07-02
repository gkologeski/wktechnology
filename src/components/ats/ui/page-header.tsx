import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface AtsPageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  /**
   * Quando true, anuncia mudanças no `description` para leitores de tela
   * (útil quando o texto reflete estado dinâmico, ex: "12 resultados").
   */
  descriptionLive?: boolean;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  tabs?: ReactNode;
  className?: string;
}

/**
 * ATS PageHeader — "quiet premium" header used as the top block of every ATS route.
 * Presentational only. Does not fetch data.
 */
export function AtsPageHeader({
  eyebrow,
  title,
  description,
  descriptionLive = false,
  primaryAction,
  secondaryActions,
  tabs,
  className,
}: AtsPageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 pb-5 border-b border-border-subtle", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary mb-1.5">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary truncate">
            {title}
          </h1>
          {description ? (
            <p
              className="text-sm text-text-secondary mt-1.5 max-w-2xl"
              {...(descriptionLive ? { "aria-live": "polite", "aria-atomic": true } : {})}
            >
              {description}
            </p>
          ) : null}
        </div>
        {(primaryAction || secondaryActions) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {secondaryActions}
            {primaryAction}
          </div>
        )}
      </div>
      {tabs ? <div className="-mb-5">{tabs}</div> : null}
    </header>
  );
}
