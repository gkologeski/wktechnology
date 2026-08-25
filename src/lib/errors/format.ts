// Utilitário para formatar mensagens de erro exibidas ao usuário.
// - Detecta o stub FORCE_RELOAD que o Lovable devolve quando há novo deploy
//   e força reload em vez de mostrar HTML cru no toast.
// - Remove tags HTML e trunca mensagens muito longas.

export function isForceReloadPayload(text: unknown): boolean {
  if (typeof text !== "string") return false;
  return text.includes("FORCE_RELOAD");
}

export function formatErrorMessage(err: unknown, fallback = "Erro inesperado."): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : (() => {
            try {
              return JSON.stringify(err);
            } catch {
              return String(err);
            }
          })();

  if (isForceReloadPayload(raw)) {
    // Handled separately — caller usually reloads. Keep message user-friendly.
    return "Nova versão disponível. Recarregando…";
  }

  const stripped = raw
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return fallback;
  return stripped.length > 300 ? `${stripped.slice(0, 300)}…` : stripped;
}

/**
 * Handle common error cases: if the response is a FORCE_RELOAD stub, reload
 * the page. Returns true when it handled the error (caller should stop).
 */
export function handleForceReload(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (isForceReloadPayload(raw)) {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
    return true;
  }
  return false;
}
