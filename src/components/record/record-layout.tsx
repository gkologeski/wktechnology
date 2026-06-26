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
  header,
  left,
  center,
  right,
}: {
  header?: ReactNode;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="-m-4 md:-m-6 p-6 md:p-8 bg-muted/30 min-h-full space-y-6">
      {header}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-12">
        <aside className="space-y-4 order-1 2xl:col-span-3 min-w-0">{left}</aside>
        <div className="space-y-6 order-3 lg:order-2 2xl:col-span-6 min-w-0">{center}</div>
        <aside className="space-y-4 order-2 lg:order-3 lg:col-span-2 2xl:col-span-3 2xl:col-start-auto min-w-0">{right}</aside>
      </div>

    </div>
  );
}
