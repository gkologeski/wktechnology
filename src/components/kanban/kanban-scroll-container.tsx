import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Wraps a horizontally scrollable Kanban board with:
 *  - A persistent top scrollbar that mirrors the bottom one (sticky).
 *  - Keyboard navigation between columns and cards using arrow keys.
 *
 * Cards inside the board should expose `data-kanban-card` and
 * `data-kanban-column="<columnId>"` so arrow-key navigation can move focus.
 * Columns should set `data-kanban-column-root="<columnId>"` on their root
 * element so ArrowLeft/Right can scroll them into view.
 */
export function KanbanScrollContainer({
  children,
  ariaLabel = "Quadro Kanban",
}: {
  children: ReactNode;
  ariaLabel?: string;
}) {
  const topRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const topInnerRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef<"top" | "content" | null>(null);
  const [overflows, setOverflows] = useState(false);

  // Keep the top mirror width in sync with the actual scrollWidth.
  useEffect(() => {
    const content = contentRef.current;
    const inner = topInnerRef.current;
    if (!content || !inner) return;
    const sync = () => {
      inner.style.width = `${content.scrollWidth}px`;
      setOverflows(content.scrollWidth > content.clientWidth + 1);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(content);
    const observeDescendants = () => {
      content.querySelectorAll("*").forEach((el) => {
        try {
          ro.observe(el);
        } catch {
          /* ignore */
        }
      });
    };
    observeDescendants();
    const mo = new MutationObserver(() => {
      observeDescendants();
      sync();
    });
    mo.observe(content, { childList: true, subtree: true });
    window.addEventListener("resize", sync);
    // Re-check after async layout/data settles
    const timeouts = [50, 200, 600, 1500].map((ms) => window.setTimeout(sync, ms));
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", sync);
      timeouts.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const onTopScroll = () => {
    if (syncingRef.current === "content") return;
    syncingRef.current = "top";
    if (contentRef.current && topRef.current) {
      contentRef.current.scrollLeft = topRef.current.scrollLeft;
    }
    requestAnimationFrame(() => (syncingRef.current = null));
  };
  const onContentScroll = () => {
    if (syncingRef.current === "top") return;
    syncingRef.current = "content";
    if (contentRef.current && topRef.current) {
      topRef.current.scrollLeft = contentRef.current.scrollLeft;
    }
    requestAnimationFrame(() => (syncingRef.current = null));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const root = contentRef.current;
    if (!root) return;
    const active = document.activeElement as HTMLElement | null;
    const isCard = active?.hasAttribute("data-kanban-card");
    const key = e.key;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key)) return;

    if (isCard) {
      e.preventDefault();
      const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-kanban-card]"));
      const cols: string[] = [];
      cards.forEach((c) => {
        const col = c.getAttribute("data-kanban-column") || "";
        if (!cols.includes(col)) cols.push(col);
      });
      const currentCol = active!.getAttribute("data-kanban-column") || "";
      const colCards = cards.filter((c) => c.getAttribute("data-kanban-column") === currentCol);
      const idxInCol = colCards.indexOf(active!);
      if (key === "ArrowUp" || key === "ArrowDown") {
        const next = colCards[idxInCol + (key === "ArrowDown" ? 1 : -1)];
        next?.focus();
        return;
      }
      // Left/Right: jump to first card of prev/next column.
      const colIdx = cols.indexOf(currentCol);
      const targetCol = cols[colIdx + (key === "ArrowRight" ? 1 : -1)];
      if (!targetCol) return;
      const targetCard = cards.find((c) => c.getAttribute("data-kanban-column") === targetCol);
      if (targetCard) {
        targetCard.focus();
        const colRoot = root.querySelector<HTMLElement>(
          `[data-kanban-column-root="${CSS.escape(targetCol)}"]`,
        );
        colRoot?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
      }
      return;
    }

    // Container-level scrolling.
    if (key === "ArrowLeft" || key === "ArrowRight") {
      e.preventDefault();
      const first = root.querySelector<HTMLElement>("[data-kanban-column-root]");
      const step = first?.offsetWidth ? first.offsetWidth + 8 : 300;
      root.scrollBy({ left: key === "ArrowRight" ? step : -step, behavior: "smooth" });
    }
  };

  return (
    <div
      className="kanban-scroll-wrapper"
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div
        ref={topRef}
        onScroll={onTopScroll}
        className="kanban-top-scroll sticky top-0 z-20 overflow-x-scroll overflow-y-hidden bg-background"
        style={{ height: 14, visibility: overflows ? "visible" : "hidden" }}
        aria-hidden="true"
      >
        <div ref={topInnerRef} style={{ height: 1 }} />
      </div>
      <div
        ref={contentRef}
        onScroll={onContentScroll}
        className="kanban-content-scroll overflow-x-auto"
      >
        {children}
      </div>
    </div>
  );
}
