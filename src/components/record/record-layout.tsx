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
    <div className="-m-4 min-h-full bg-product-canvas md:-m-6">
      {header}
      <div className="grid grid-cols-1 border-t border-product-divider xl:grid-cols-[260px_minmax(0,1fr)_300px] 2xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="min-w-0 space-y-4 border-b border-product-divider bg-product-panel-muted p-4 xl:border-b-0 xl:border-r">
          {left}
        </aside>
        <div className="min-w-0 space-y-4 bg-product-canvas p-4 md:p-6">{center}</div>
        <aside className="min-w-0 space-y-4 border-t border-product-divider bg-product-panel-muted p-4 xl:border-l xl:border-t-0">
          {right}
        </aside>
      </div>
    </div>
  );
}
