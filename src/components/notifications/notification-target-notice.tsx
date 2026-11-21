import { useEffect, useRef, type ReactNode } from "react";

/** An authorized destination is displayed only after its own fresh read. */
export function NotificationTargetNotice({
  label,
  targetId,
  loading,
  failed,
  available,
  focusOnUnavailable = false,
  retry,
  children,
}: {
  label: string;
  targetId: string;
  loading: boolean;
  failed: boolean;
  available: boolean;
  focusOnUnavailable?: boolean;
  retry: ReactNode;
  children: ReactNode;
}) {
  const node = useRef<HTMLElement>(null),
    focused = useRef<string | null>(null);
  useEffect(() => {
    if (loading || ((!available || failed) && !focusOnUnavailable) || focused.current === targetId)
      return;
    focused.current = targetId;
    node.current?.scrollIntoView?.({ block: "nearest" });
    node.current?.focus({ preventScroll: true });
  }, [available, loading, failed, targetId, focusOnUnavailable]);
  return (
    <section
      ref={node}
      tabIndex={-1}
      aria-label={label}
      aria-current={available && !loading && !failed ? "true" : undefined}
      className="min-w-0 space-y-2 rounded-md border bg-muted/30 p-4 text-sm"
    >
      <h3 className="font-medium">{label}</h3>
      {loading ? (
        <p role="status">Conferindo o acesso atual ao registro do aviso…</p>
      ) : failed || !available ? (
        <div role="alert">
          <p>O registro do aviso está indisponível ou não foi possível conferir seu acesso.</p>
          {retry}
        </div>
      ) : (
        children
      )}
    </section>
  );
}
