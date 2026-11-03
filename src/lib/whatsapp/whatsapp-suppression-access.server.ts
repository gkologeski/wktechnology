import type { SupabaseClient } from "@supabase/supabase-js";
import { activeSuppressions, type SuppressionReason } from "./whatsapp-suppression";

/** Chave dedicada: liberar número bloqueado pela Meta. Sem concessão automática. */
export const SUPPRESSION_RELEASE_KEY = "system.whatsapp_suppressions.manage.workspace";

async function actorId(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user?.id) throw new Error("Sessão inválida.");
  return data.user.id;
}

async function assertActiveMember(client: SupabaseClient, workspaceId: string, userId: string) {
  const member = await client.rpc("is_workspace_member", {
    _workspace: workspaceId,
    _user: userId,
  });
  if (member.error || member.data !== true) throw new Error("Membro ativo obrigatório.");
}

/** Leitura dos bloqueios: membro ativo do workspace (mesma regra da RLS da tabela). */
export async function authorizeSuppressionRead(client: SupabaseClient, workspaceId: string) {
  await assertActiveMember(client, workspaceId, await actorId(client));
}

/**
 * Liberação manual: membro ativo + chave efetiva no workspace do bloqueio
 * (deny prevalece em `user_effective_permissions`). A RPC revalida no banco.
 */
export async function authorizeSuppressionRelease(client: SupabaseClient, workspaceId: string) {
  const userId = await actorId(client);
  await assertActiveMember(client, workspaceId, userId);
  const { data, error } = await client.rpc("user_has_permission", {
    _user_id: userId,
    _workspace_id: workspaceId,
    _permission_key: SUPPRESSION_RELEASE_KEY,
  });
  if (error || data !== true) throw new Error("Sem permissão para liberar números bloqueados.");
}

export type RecordSuppression = {
  id: string;
  phone: string;
  reason: SuppressionReason;
  expiresAt: string;
  lastErrorAt: string;
  errorCount: number;
};

/** Bloqueios vigentes dos telefones de um Contato/Lead que o usuário enxerga (RLS). */
export async function loadRecordSuppressions(
  client: SupabaseClient,
  entity: "contact" | "lead",
  id: string,
): Promise<{ items: RecordSuppression[]; canRelease: boolean }> {
  const table = entity === "contact" ? "contacts" : "leads";
  const record = await client
    .from(table)
    .select("workspace_id, phone, mobile_phone, whatsapp_e164")
    .eq("id", id)
    .maybeSingle();
  if (record.error) throw new Error("Não foi possível ler o cadastro.");
  const row = record.data as {
    workspace_id: string | null;
    phone: string | null;
    mobile_phone: string | null;
    whatsapp_e164: string | null;
  } | null;
  if (!row?.workspace_id) return { items: [], canRelease: false };
  await authorizeSuppressionRead(client, row.workspace_id);
  const { toWhatsAppE164 } = await import("@/lib/phone/whatsapp-e164");
  const { suppressionKey } = await import("./whatsapp-suppression");
  const byKey = new Map<string, string>();
  for (const p of [row.whatsapp_e164, row.mobile_phone, row.phone]) {
    const e = toWhatsAppE164(p);
    if (e && !byKey.has(suppressionKey(e))) byKey.set(suppressionKey(e), e);
  }
  if (!byKey.size) return { items: [], canRelease: false };
  const { data, error } = await client
    .from("whatsapp_number_suppressions")
    .select("id, phone_key, reason, expires_at, released_at, last_error_at, error_count")
    .eq("workspace_id", row.workspace_id)
    .in("phone_key", [...byKey.keys()])
    .is("released_at", null);
  if (error) throw new Error("Não foi possível verificar bloqueios de WhatsApp.");
  const rows = (data ?? []) as Array<{
    id: string;
    phone_key: string;
    reason: SuppressionReason;
    expires_at: string;
    released_at: string | null;
    last_error_at: string;
    error_count: number;
  }>;
  const active = activeSuppressions(rows);
  const items = rows
    .filter((r) => active.get(r.phone_key) === r.reason)
    .map((r) => ({
      id: r.id,
      phone: byKey.get(r.phone_key) ?? r.phone_key,
      reason: r.reason,
      expiresAt: r.expires_at,
      lastErrorAt: r.last_error_at,
      errorCount: r.error_count,
    }));
  let canRelease = false;
  if (items.length) {
    canRelease = await authorizeSuppressionRelease(client, row.workspace_id).then(
      () => true,
      () => false,
    );
  }
  return { items, canRelease };
}

/** Libera um bloqueio: lê a linha pela RLS, autoriza no workspace dela e chama a RPC. */
export async function releaseSuppression(client: SupabaseClient, id: string) {
  const found = await client
    .from("whatsapp_number_suppressions")
    .select("workspace_id")
    .eq("id", id)
    .maybeSingle();
  if (found.error || !found.data) throw new Error("Bloqueio não encontrado.");
  await authorizeSuppressionRelease(client, String(found.data.workspace_id));
  const { error } = await client.rpc("wa_release_number_suppression", { p_id: id });
  if (error) throw new Error("Não foi possível liberar o número.");
}

/** Totais vigentes no workspace, sem telefones — usados nos avisos de planejamento. */
export async function loadSuppressionStats(client: SupabaseClient, workspaceId: string) {
  await authorizeSuppressionRead(client, workspaceId);
  const nowIso = new Date().toISOString();
  const count = async (reason: SuppressionReason) => {
    const { count: n, error } = await client
      .from("whatsapp_number_suppressions")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("reason", reason)
      .is("released_at", null)
      .gt("expires_at", nowIso);
    if (error) throw new Error("Não foi possível contar os bloqueios de WhatsApp.");
    return n ?? 0;
  };
  const [noWhatsApp, engagementLimit] = await Promise.all([
    count("no_whatsapp"),
    count("engagement_limit"),
  ]);
  return { noWhatsApp, engagementLimit };
}
