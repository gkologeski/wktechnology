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
    <div className="space-y-4">
      {header}
      <div className="grid gap-4 xl:grid-cols-[300px_1fr_320px] lg:grid-cols-[280px_1fr] grid-cols-1">
        <aside className="space-y-3 order-1">{left}</aside>
        <div className="space-y-4 order-3 xl:order-2 lg:col-span-2 xl:col-span-1 min-w-0">{center}</div>
        <aside className="space-y-3 order-2 xl:order-3 lg:col-span-2 xl:col-span-1">{right}</aside>
      </div>
    </div>
  );
}
