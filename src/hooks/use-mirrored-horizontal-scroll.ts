import { useCallback, useEffect, useRef, useState } from "react";

type FloatingGeometry = {
  left: number;
  top: number;
  width: number;
  visible: boolean;
};

const HORIZONTAL_SCROLLBAR_HEIGHT = 14;

function sameGeometry(a: FloatingGeometry, b: FloatingGeometry) {
  return a.left === b.left && a.top === b.top && a.width === b.width && a.visible === b.visible;
}

function clippingBounds(element: HTMLElement) {
  let top = 0;
  let bottom = window.innerHeight;
  let left = 0;
  let right = window.innerWidth;
  let parent = element.parentElement;

  while (parent && parent !== document.body) {
    const style = window.getComputedStyle(parent);
    if (/auto|scroll/.test(style.overflowY)) {
      const rect = parent.getBoundingClientRect();
      top = Math.max(top, rect.top);
      bottom = Math.min(bottom, rect.bottom);
      left = Math.max(left, rect.left);
      right = Math.min(right, rect.right);
    }
    parent = parent.parentElement;
  }

  return { top, bottom, left, right };
}

export function useMirroredHorizontalScroll({ floating = false } = {}) {
  const mirrorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const mirrorInnerRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef<"mirror" | "content" | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [overflows, setOverflows] = useState(false);
  const [geometry, setGeometry] = useState<FloatingGeometry>({
    left: 0,
    top: 0,
    width: 0,
    visible: false,
  });

  const update = useCallback(() => {
    const content = contentRef.current;
    const inner = mirrorInnerRef.current;
    if (!content || !inner) return;

    inner.style.width = `${content.scrollWidth}px`;
    const hasOverflow = content.scrollWidth > content.clientWidth + 1;
    setOverflows((current) => (current === hasOverflow ? current : hasOverflow));

    if (!floating) return;

    const rect = content.getBoundingClientRect();
    const clip = clippingBounds(content);
    const visible =
      hasOverflow &&
      rect.top < clip.bottom - HORIZONTAL_SCROLLBAR_HEIGHT &&
      rect.bottom > clip.bottom + HORIZONTAL_SCROLLBAR_HEIGHT &&
      rect.bottom > clip.top;
    const next: FloatingGeometry = {
      left: Math.max(rect.left, clip.left),
      top: clip.bottom - HORIZONTAL_SCROLLBAR_HEIGHT,
      width: Math.max(0, Math.min(rect.right, clip.right) - Math.max(rect.left, clip.left)),
      visible,
    };
    setGeometry((current) => (sameGeometry(current, next) ? current : next));
  }, [floating]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const scheduleUpdate = () => {
      if (animationFrameRef.current !== null) return;
      animationFrameRef.current = window.requestAnimationFrame(() => {
        animationFrameRef.current = null;
        update();
      });
    };

    update();
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(content);
    const mutationObserver = new MutationObserver(scheduleUpdate);
    mutationObserver.observe(content, { childList: true, subtree: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [update]);

  const onMirrorScroll = useCallback(() => {
    if (syncingRef.current === "content") return;
    syncingRef.current = "mirror";
    if (contentRef.current && mirrorRef.current) {
      contentRef.current.scrollLeft = mirrorRef.current.scrollLeft;
    }
    window.requestAnimationFrame(() => {
      syncingRef.current = null;
    });
  }, []);

  const onContentScroll = useCallback(() => {
    if (syncingRef.current === "mirror") return;
    syncingRef.current = "content";
    if (contentRef.current && mirrorRef.current) {
      mirrorRef.current.scrollLeft = contentRef.current.scrollLeft;
    }
    window.requestAnimationFrame(() => {
      syncingRef.current = null;
    });
  }, []);

  return {
    mirrorRef,
    contentRef,
    mirrorInnerRef,
    overflows,
    geometry,
    onMirrorScroll,
    onContentScroll,
  };
}
