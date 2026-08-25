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
      <div className="grid gap-6 grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_300px] 2xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="space-y-4 min-w-0">{left}</aside>
        <div className="space-y-6 min-w-0">{center}</div>
        <aside className="space-y-4 min-w-0">{right}</aside>
      </div>
    </div>
  );
}
