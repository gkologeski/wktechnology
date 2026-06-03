import { useEffect, useRef } from "react";
import { toast } from "sonner";

// Polls the current document URL for changes in the hashed asset references
// emitted by Vite. Each new deploy ships new hashed filenames, so a diff means
// a new version of the app is live and the user should reload to use it.
const POLL_INTERVAL_MS = 5 * 60_000;

function extractAssetFingerprint(html: string): string {
  // Captura todos os caminhos para assets versionados (com hash) gerados pelo
  // build (Vite/TanStack). Concatena-os para servir como impressão digital.
  const matches = html.match(/\/[A-Za-z0-9_\-./]+\.[a-z0-9]{6,}\.(?:js|css|mjs)/g) ?? [];
  return Array.from(new Set(matches)).sort().join("|");
}

export function NewVersionWatcher() {
  const initialFingerprint = useRef<string | null>(null);
  const notified = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const fetchFingerprint = async (): Promise<string | null> => {
      try {
        const res = await fetch(window.location.pathname + "?__v=" + Date.now(), {
          cache: "no-store",
          headers: { Accept: "text/html" },
          credentials: "same-origin",
        });
        if (!res.ok) return null;
        const html = await res.text();
        return extractAssetFingerprint(html);
      } catch {
        return null;
      }
    };

    const check = async () => {
      const fp = await fetchFingerprint();
      if (cancelled || !fp) return;
      if (initialFingerprint.current === null) {
        initialFingerprint.current = fp;
        return;
      }
      if (fp !== initialFingerprint.current && !notified.current) {
        notified.current = true;
        toast.info("Nova versão disponível", {
          description:
            "Recarregue a página (Ctrl/Cmd + R) ou clique em Atualizar para usar a versão mais recente do CRM.",
          duration: Infinity,
          action: {
            label: "Atualizar",
            onClick: () => {
              window.location.reload();
            },
          },
        });
      }
    };

    // Captura impressão inicial logo após o load.
    check();
    const interval = window.setInterval(check, POLL_INTERVAL_MS);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return null;
}
