import { useMemo, useRef, type ReactNode } from "react";
import { useProportionalScrollSync } from "@/hooks/use-proportional-scroll-sync";

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
  synchronizedTimeline = false,
}: {
  header?: ReactNode;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  synchronizedTimeline?: boolean;
}) {
  const leftRef = useRef<HTMLElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLElement>(null);
  const followers = useMemo(() => [leftRef, rightRef], []);
  useProportionalScrollSync(centerRef, followers, synchronizedTimeline);

  return (
    <div className="-m-4 min-h-full bg-product-canvas md:-m-6">
      {header}
      <div
        className={`grid grid-cols-1 border-t border-product-divider ${
          synchronizedTimeline
            ? "xl:grid-cols-[300px_minmax(0,1fr)_340px] 2xl:grid-cols-[320px_minmax(0,1fr)_360px]"
            : "xl:grid-cols-[260px_minmax(0,1fr)_300px] 2xl:grid-cols-[280px_minmax(0,1fr)_320px]"
        }`}
      >
        <aside
          ref={leftRef}
          className={`min-w-0 space-y-4 border-b border-product-divider bg-product-panel-muted p-4 xl:border-b-0 xl:border-r ${synchronizedTimeline ? "xl:max-h-[calc(100dvh-8rem)] xl:overflow-y-auto" : ""}`}
        >
          {left}
        </aside>
        <div
          ref={centerRef}
          className={`min-w-0 space-y-4 bg-product-canvas p-4 md:p-6 ${synchronizedTimeline ? "xl:max-h-[calc(100dvh-8rem)] xl:overflow-y-auto" : ""}`}
        >
          {center}
        </div>
        <aside
          ref={rightRef}
          className={`min-w-0 space-y-4 border-t border-product-divider bg-product-panel-muted p-4 xl:border-l xl:border-t-0 ${synchronizedTimeline ? "xl:max-h-[calc(100dvh-8rem)] xl:overflow-y-auto" : ""}`}
        >
          {right}
        </aside>
      </div>
    </div>
  );
}
