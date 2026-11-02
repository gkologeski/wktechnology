import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSalesArea } from "@/lib/access-control/sales-core.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import { SEQUENCE_RESOURCE, saveDraftSchema, type SaveDraft, type SequenceDraft } from "./draft";
export async function listDrafts(
  client: SupabaseClient,
  workspaceId: string,
): Promise<SequenceDraft[]> {
  await assertSalesArea(client, SEQUENCE_RESOURCE, "view");
  return workRpc(client, "prospecting_sequence_draft_list", { p_workspace: workspaceId });
}
export async function saveDraft(
  client: SupabaseClient,
  input: SaveDraft,
  sender?: EmailSenderPolicy,
): Promise<SequenceDraft> {
  const data = saveDraftSchema.parse(input);
  await assertSalesArea(
    client,
    SEQUENCE_RESOURCE,
    data.expectedRevision === 0 ? "create" : "update",
  );
  await assertSalesArea(client, SEQUENCE_RESOURCE, "view");
  const definition = sender
    ? { ...data.definition, steps: applyEmailSenderPolicy(data.definition.steps, sender) }
    : data.definition;
  return workRpc(client, "prospecting_sequence_draft_save", {
    p_id: data.id,
    p_workspace: data.workspaceId,
    p_expected_revision: data.expectedRevision,
    p_name: data.name,
    p_definition: definition,
  });
}
/** Counts and a finite sample under caller RLS, never marketing/send eligibility. */
export async function previewDraftAudience(
  client: SupabaseClient,
  userId: string,
  workspaceId: string,
  audience: SaveDraft["definition"]["audience"],
) {
  await assertSalesArea(client, SEQUENCE_RESOURCE, "view");
  const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
  if ((await resolveActiveWorkspace(userId)) !== workspaceId)
    throw new Error("Workspace indisponível.");
  const { loadAudienceRows } = await import("@/lib/whatsapp/campaign-audience.server");
  const { rows, truncated } = await loadAudienceRows(
    client,
    workspaceId,
    {
      type: "filter",
      base: audience.base,
      groups: audience.groups,
      groups_logic: audience.groupsLogic,
    },
    userId,
  );
  const { buildAudience } = await import("@/lib/whatsapp/campaign-audience");
  return {
    found: rows.length,
    truncated,
    email: rows.filter((r) => r.values[`${r.sourceType}.email`]?.trim()).length,
    phone: rows.filter((r) => r.phones?.some((p) => p?.trim()) || r.phone?.trim()).length,
    whatsapp: buildAudience(rows, {}, new Set()).recipients.length,
    samples: rows.slice(0, 8).map((r) => ({ id: r.sourceId, name: r.label })),
  };
}

/**
 * Regra do remetente de e-mail das sequências: quem não é administrador
 * envia sempre pela própria conta; administradores escolhem qualquer conta.
 */
export type EmailSenderPolicy = { isAdmin: boolean; ownAccountId: string | null };

export function applyEmailSenderPolicy<T extends { type: string; accountId?: string | null }>(
  steps: T[],
  policy: EmailSenderPolicy,
): T[] {
  if (policy.isAdmin) return steps;
  const hasEmail = steps.some((s) => s.type === "email");
  if (hasEmail && !policy.ownAccountId)
    throw new Error("Conecte sua conta de e-mail em Canais para usar passos de e-mail.");
  return steps.map((s) => (s.type === "email" ? { ...s, accountId: policy.ownAccountId } : s));
}

/** Resolve a conta de e-mail do próprio usuário e se ele é admin do workspace. */
export async function resolveEmailSender(
  userId: string,
  workspaceId: string,
): Promise<EmailSenderPolicy & { ownLabel: string | null }> {
  const { isWorkspaceAdmin } = await import("@/lib/workspace/admin-guard.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const isAdmin = await isWorkspaceAdmin(userId, workspaceId);
  const { data: mine } = await db
    .from("email_accounts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("owner_id", userId);
  const ids = ((mine as { id: string }[] | null) || []).map((r) => r.id);
  let own: { id: string; label: string } | null = null;
  if (ids.length) {
    const { data } = await db
      .from("service_channel_accounts")
      .select("id,label")
      .eq("workspace_id", workspaceId)
      .eq("channel", "email")
      .in("source_key", ids)
      .order("label")
      .limit(1);
    own = (data as { id: string; label: string }[] | null)?.[0] ?? null;
  }
  return { isAdmin, ownAccountId: own?.id ?? null, ownLabel: own?.label ?? null };
}
