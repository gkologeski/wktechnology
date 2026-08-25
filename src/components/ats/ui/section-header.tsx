import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface AtsSectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function AtsSectionHeader({ title, description, action, className }: AtsSectionHeaderProps) {
  return (
    <div className={cn("flex items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-text-primary tracking-tight">{title}</h2>
        {description ? <p className="text-xs text-text-secondary mt-0.5">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
