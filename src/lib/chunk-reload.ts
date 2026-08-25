// Detecta falhas de import dinâmico (chunks lazy obsoletos após novo build)
// e força um reload limpo — uma única vez — limpando Service Worker e Cache
// Storage para garantir que os assets novos sejam baixados.
//
// Carregado apenas no cliente (import com efeito colateral em __root.tsx).

const STORAGE_KEY = "techhire:chunk-reload";
const COOLDOWN_MS = 30_000;

const PATTERNS = [
  "Failed to fetch dynamically imported module",
  "Importing a module script failed",
  "error loading dynamically imported module",
  "Unable to preload CSS",
];

function isChunkError(err: unknown): boolean {
  if (!err) return false;
  const msg =
    typeof err === "string"
      ? err
      : err instanceof Error
        ? err.message
        : typeof (err as { message?: unknown }).message === "string"
          ? (err as { message: string }).message
          : "";
  if (!msg) return false;
  return PATTERNS.some((p) => msg.includes(p));
}

async function clearCaches() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(regs.map((r) => r.unregister()));
    }
  } catch {
    /* ignore */
  }
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.allSettled(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
}

let triggered = false;
async function handleChunkError() {
  if (triggered) return;
  triggered = true;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const ts = Number(raw);
      if (Number.isFinite(ts) && Date.now() - ts < COOLDOWN_MS) {
        // Já tentamos recentemente — não entra em loop.
        console.warn("[chunk-reload] reload suprimido (cooldown ativo)");
        return;
      }
    }
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  console.warn("[chunk-reload] chunk obsoleto detectado, recarregando…");
  await clearCaches();
  window.location.reload();
}

export function installChunkReloadGuard() {
  if (typeof window === "undefined") return;
  if ((window as unknown as { __techhireChunkGuard?: boolean }).__techhireChunkGuard) return;
  (window as unknown as { __techhireChunkGuard?: boolean }).__techhireChunkGuard = true;

  window.addEventListener("error", (event) => {
    if (isChunkError(event.error) || isChunkError(event.message)) {
      void handleChunkError();
    }
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkError(event.reason)) {
      void handleChunkError();
    }
  });
  // Vite dispara este evento antes da rejeição da promise, dando o sinal
  // mais confiável de chunk obsoleto após um novo build.
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    void handleChunkError();
  });
}
