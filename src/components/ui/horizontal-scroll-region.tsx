import type { HTMLAttributes, ReactNode } from "react";
import { useMirroredHorizontalScroll } from "@/hooks/use-mirrored-horizontal-scroll";
import { cn } from "@/lib/utils";

type HorizontalScrollRegionProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  contentClassName?: string;
};

export function HorizontalScrollRegion({
  children,
  className,
  contentClassName,
  ...props
}: HorizontalScrollRegionProps) {
  const scroll = useMirroredHorizontalScroll({ floating: true });

  return (
    <div className={cn("relative w-full min-w-0", className)} {...props}>
      <div
        ref={scroll.contentRef}
        className={cn("w-full overflow-auto overscroll-x-contain", contentClassName)}
        onScroll={scroll.onContentScroll}
      >
        {children}
      </div>
      <div
        ref={scroll.mirrorRef}
        onScroll={scroll.onMirrorScroll}
        className={cn(
          "grid-floating-scrollbar fixed z-30 overflow-x-scroll overflow-y-hidden",
          !scroll.geometry.visible && "pointer-events-none invisible",
        )}
        style={{
          left: scroll.geometry.left,
          top: scroll.geometry.top,
          width: scroll.geometry.width,
          height: 14,
        }}
        aria-hidden="true"
      >
        <div ref={scroll.mirrorInnerRef} className="h-px" />
      </div>
    </div>
  );
}