import type { ReactNode } from "react";

/**
 * 3-column HubSpot-style record layout:
 *   ┌──────────┬───────────────────────┬──────────┐
 *   │ left     │       center          │  right   │
 *   │ (~300px) │       (1fr)           │ (~320px) │
 *   └──────────┴───────────────────────┴──────────┘
 *
 * The `header` slot renders full-width above the columns.
 * On narrow screens columns stack.
 */
export function RecordLayout({
  header, left, center, right,
}: {
  header?: ReactNode;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="-m-4 md:-m-6 p-6 md:p-8 bg-muted/30 min-h-full space-y-6">
      {header}
      <div className="grid gap-6 xl:grid-cols-12 grid-cols-1">
        <aside className="space-y-4 xl:col-span-3 order-1">{left}</aside>
        <div className="space-y-6 xl:col-span-6 order-3 xl:order-2 min-w-0">{center}</div>
        <aside className="space-y-4 xl:col-span-3 order-2 xl:order-3">{right}</aside>
      </div>
    </div>
  );
}
