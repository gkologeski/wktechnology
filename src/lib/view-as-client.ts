// Estado do "Ver como" no navegador: guarda a sessão do admin para restaurar depois.
import { supabase } from "@/integrations/supabase/client";
import type { ViewAsStart } from "@/lib/view-as.functions";

const KEY = "wk.viewAs";

export type ViewAsState = {
  viewId: string;
  label: string;
  mode: "user" | "role";
  readOnly: boolean;
  expiresAt: string;
  admin: { access_token: string; refresh_token: string };
};

export function readViewAs(): ViewAsState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ViewAsState) : null;
  } catch {
    return null;
  }
}

function writeViewAs(s: ViewAsState | null) {
  if (s) window.localStorage.setItem(KEY, JSON.stringify(s));
  else window.localStorage.removeItem(KEY);
}

/** Troca a sessão para o alvo. `bind` confirma no servidor com a nova sessão. */
export async function enterViewAs(
  start: ViewAsStart,
  bind: (a: { data: { viewId: string; nonce: string } }) => Promise<unknown>,
) {
  const { data } = await supabase.auth.getSession();
  const cur = data.session;
  if (!cur) throw new Error("Sessão expirada. Entre novamente.");
  writeViewAs({
    viewId: start.viewId,
    label: start.label,
    mode: start.mode,
    readOnly: start.readOnly,
    expiresAt: start.expiresAt,
    admin: { access_token: cur.access_token, refresh_token: cur.refresh_token },
  });
  const { error } = await supabase.auth.verifyOtp({
    token_hash: start.tokenHash,
    type: "magiclink",
  });
  if (error) {
    await restoreAdmin();
    throw new Error("Não foi possível entrar no Ver como.");
  }
  try {
    await bind({ data: { viewId: start.viewId, nonce: start.nonce } });
  } catch (e) {
    await restoreAdmin();
    throw e;
  }
  window.location.assign("/");
}

async function restoreAdmin() {
  const s = readViewAs();
  writeViewAs(null);
  if (!s) return;
  const { error } = await supabase.auth.setSession(s.admin);
  if (error) await supabase.auth.signOut({ scope: "local" });
}

export async function exitViewAs(end: (a: { data: { viewId: string } }) => Promise<unknown>) {
  const s = readViewAs();
  if (s) await end({ data: { viewId: s.viewId } }).catch(() => {});
  await restoreAdmin();
  window.location.assign("/");
}
