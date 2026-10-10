// Aviso de troca de workspace ativo (mesma aba + outras abas do mesmo navegador).
// Substitui a escuta de `profiles` por tempo real, que não está na publicação.
const EVENT = "techerp:workspace-changed";
const CHANNEL = "techerp-workspace";

export function notifyWorkspaceChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
  try {
    const bc = new BroadcastChannel(CHANNEL);
    bc.postMessage(EVENT);
    bc.close();
  } catch {
    // navegador sem BroadcastChannel: só a aba atual é avisada
  }
}

export function onWorkspaceChanged(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, cb);
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = () => cb();
  } catch {
    bc = null;
  }
  return () => {
    window.removeEventListener(EVENT, cb);
    bc?.close();
  };
}

/** Filtros do tempo real do White Label: sempre presos ao workspace carregado. */
export function brandingRealtimeFilters(workspaceId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) throw new Error("workspace inválido");
  const filter = `workspace_id=eq.${workspaceId}`;
  return [
    { table: "workspace_branding", filter },
    { table: "module_branding", filter },
  ] as const;
}

/** Espera da nova tentativa após recusa/queda: 5 s, 10 s, 20 s… até 60 s. */
export const realtimeRetryDelay = (attempt: number) => Math.min(60_000, 5_000 * 2 ** attempt);
