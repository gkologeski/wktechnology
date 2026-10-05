import { useEffect, useRef, type RefObject } from "react";

export function proportionalScrollTop(
  sourceScrollTop: number,
  sourceScrollHeight: number,
  sourceClientHeight: number,
  targetScrollHeight: number,
  targetClientHeight: number,
) {
  const sourceMax = Math.max(0, sourceScrollHeight - sourceClientHeight);
  const targetMax = Math.max(0, targetScrollHeight - targetClientHeight);
  if (sourceMax === 0 || targetMax === 0) return 0;
  return (Math.min(sourceMax, Math.max(0, sourceScrollTop)) / sourceMax) * targetMax;
}

export function useProportionalScrollSync(
  sourceRef: RefObject<HTMLElement | null>,
  targetRefs: Array<RefObject<HTMLElement | null>>,
  enabled: boolean,
) {
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const source = sourceRef.current;
    if (!source) return;

    const sync = () => {
      for (const targetRef of targetRefs) {
        const target = targetRef.current;
        if (!target) continue;
        target.scrollTop = proportionalScrollTop(
          source.scrollTop,
          source.scrollHeight,
          source.clientHeight,
          target.scrollHeight,
          target.clientHeight,
        );
      }
    };
    const scheduleSync = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(sync);
    };

    source.addEventListener("scroll", scheduleSync, { passive: true });
    const observer = new ResizeObserver(scheduleSync);
    observer.observe(source);
    for (const targetRef of targetRefs) {
      if (targetRef.current) observer.observe(targetRef.current);
    }
    scheduleSync();

    return () => {
      source.removeEventListener("scroll", scheduleSync);
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [enabled, sourceRef, targetRefs]);
}