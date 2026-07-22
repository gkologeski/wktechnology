// Helper client: mostra toast amigável ao interceptar erro de permissão vindo do servidor.
import { toast } from "sonner";

const LEGACY_PREFIX = "Permissão negada";
const STANDARD_PREFIX = "Você não tem permissão para esta ação";

export function isPermissionDeniedError(error: unknown): boolean {
  if (!error) return false;
  const err = error as {
    status?: number;
    code?: string;
    message?: string;
    response?: { status?: number };
  };
  if (err.status === 403 || err.response?.status === 403) return true;
  if (err.code === "PERMISSION_DENIED") return true;
  const msg = typeof err.message === "string" ? err.message : String(error);
  return msg.startsWith(STANDARD_PREFIX) || msg.startsWith(LEGACY_PREFIX);
}

/** @deprecated use isPermissionDeniedError */
export function isPermissionDeniedMessage(msg: string | undefined): boolean {
  if (!msg) return false;
  return msg.startsWith(STANDARD_PREFIX) || msg.startsWith(LEGACY_PREFIX);
}

function extractKeys(message: string): string {
  return message
    .replace(new RegExp(`^${STANDARD_PREFIX}:\\s*`), "")
    .replace(new RegExp(`^${LEGACY_PREFIX}:\\s*`), "")
    .trim();
}

/**
 * Retorna true se o erro foi tratado como "permissão negada" (e um toast foi exibido).
 * Uso:
 *   try { await fn(...) } catch (e) {
 *     if (!handlePermissionError(e)) toast.error((e as Error).message);
 *   }
 */
export function handlePermissionError(error: unknown): boolean {
  if (!isPermissionDeniedError(error)) return false;
  const msg = error instanceof Error ? error.message : String(error ?? "");
  const keys = extractKeys(msg);
  toast.error("Você não tem permissão para esta ação", {
    description: keys
      ? `Permissão necessária: ${keys}. Peça ao administrador do workspace para revisar seu perfil de acesso.`
      : "Peça ao administrador do workspace para revisar seu perfil de acesso.",
  });
  return true;
}
