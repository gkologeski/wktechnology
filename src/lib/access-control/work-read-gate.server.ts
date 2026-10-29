// Portão de leitura no servidor para listagens do TechProjects. A RLS continua filtrando cada
// linha; este portão só nega antes da consulta quem não tem nenhuma chave de leitura no
// workspace ativo (membro ativo, deny prevalece — tudo calculado no banco).
import type { SupabaseClient } from "@supabase/supabase-js";

const DENIED = "42501";

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };
const call = (client: SupabaseClient, fn: string, args: Record<string, unknown>) =>
  (client.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<RpcResult>).call(
    client,
    fn,
    args,
  );

/**
 * `true` quando a pessoa tem alguma chave `<recurso>.view.*` efetiva (mesma regra do
 * `work_area_authorize`). Sem chave devolve `false` (a tela mostra lista vazia, como a RLS).
 */
export async function workCanRead(client: SupabaseClient, resource: string): Promise<boolean> {
  const { error } = await call(client, "work_area_authorize", { r: resource, a: "view", i: null });
  if (!error) return true;
  if (error.code === DENIED || /autorizad|permiss/i.test(error.message)) return false;
  throw new Error(error.message);
}

/** Concessões de horas (`view|create|update|delete` × `own|team|workspace`) do workspace ativo. */
export async function workTimeCan(
  client: SupabaseClient,
  action: "view" | "create" | "update" | "delete",
): Promise<boolean> {
  const { data, error } = await call(client, "work_time_context", {});
  if (error) throw new Error(error.message);
  const ctx = (data ?? {}) as { time_grants?: Record<string, unknown> | string[]; read_only?: boolean };
  if (action !== "view" && ctx.read_only) return false;
  const grants = ctx.time_grants ?? {};
  const has = (k: string) => (Array.isArray(grants) ? grants.includes(k) : k in grants);
  return ["own", "team", "workspace"].some((s) => has(`${action}.${s}`));
}

/** Versão que bloqueia: usada antes de gravar. */
export async function assertWorkTimeCan(
  client: SupabaseClient,
  action: "create" | "update" | "delete",
): Promise<void> {
  if (!(await workTimeCan(client, action))) throw new Error("Sem permissão para esta ação.");
}
