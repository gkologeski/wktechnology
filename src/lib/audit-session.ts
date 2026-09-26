import { supabase } from "@/integrations/supabase/client";

const HEADER = "x-audit-session";
const sessions: string[] = [];
let fetchInstalled = false;

function currentSession() {
  return sessions[sessions.length - 1] ?? null;
}

function syncSupabaseHeader() {
  const headers = (supabase as unknown as { rest?: { headers?: Headers } }).rest?.headers;
  if (!headers) return;
  const sessionId = currentSession();
  if (sessionId) headers.set(HEADER, sessionId);
  else headers.delete(HEADER);
}

function installFetchHeader() {
  if (fetchInstalled || typeof window === "undefined") return;
  fetchInstalled = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const sessionId = currentSession();
    if (!sessionId) return originalFetch(input, init);

    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (new URL(url, window.location.href).origin !== window.location.origin) {
      return originalFetch(input, init);
    }
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    headers.set(HEADER, sessionId);
    return originalFetch(input, { ...init, headers });
  };
}

/** Abre uma correlação de auditoria para a duração de um modal. */
export function beginAuditSession() {
  const id = crypto.randomUUID();
  sessions.push(id);
  installFetchHeader();
  syncSupabaseHeader();
  return id;
}

/** Reprioriza a janela ativa quando mais de uma sessão de auditoria está aberta. */
export function touchAuditSession(id: string | null) {
  if (!id) return;
  const index = sessions.lastIndexOf(id);
  if (index < 0 || index === sessions.length - 1) return;
  sessions.splice(index, 1);
  sessions.push(id);
  syncSupabaseHeader();
}

/** Encerra uma correlação, restaurando a sessão do modal pai quando aninhado. */
export function endAuditSession(id: string | null) {
  if (!id) return;
  const index = sessions.lastIndexOf(id);
  if (index >= 0) sessions.splice(index, 1);
  syncSupabaseHeader();
}
