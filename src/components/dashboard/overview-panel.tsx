import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/techhire/ui";

export function OverviewPanel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("rounded-lg border border-border-subtle bg-surface-2 p-5 shadow-xs", className)}
    >
      <SectionHeader title={title} description={description} action={action} />
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function OverviewList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-border-subtle">{children}</ul>;
}

export function OverviewListItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex min-w-0 items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      {children}
    </li>
  );
}

export function DistributionBar({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const width = total > 0 ? Math.max(3, (value / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between gap-3 text-sm">
        <span className="text-text-secondary">{label}</span>
        <span className="font-medium tabular-nums text-text-primary">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
