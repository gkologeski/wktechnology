// Helper client: mostra toast amigável ao interceptar erro de permissão vindo do servidor.
import { toast } from "sonner";

export function isPermissionDeniedMessage(msg: string | undefined): boolean {
  if (!msg) return false;
  return msg.startsWith("Permissão negada");
}

/**
 * Retorna true se o erro foi tratado como "permissão negada" (e um toast foi exibido).
 * Uso:
 *   try { await fn(...) } catch (e) {
 *     if (!handlePermissionError(e)) toast.error((e as Error).message);
 *   }
 */
export function handlePermissionError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  if (!isPermissionDeniedMessage(msg)) return false;
  const key = msg.replace(/^Permissão negada:\s*/, "").trim();
  toast.error("Você não tem permissão para esta ação", {
    description: key
      ? `Permissão necessária: ${key}. Peça ao administrador para revisar seu perfil de acesso.`
      : "Peça ao administrador para revisar seu perfil de acesso.",
  });
  return true;
}
