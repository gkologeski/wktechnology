import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSalesArea } from "@/lib/access-control/sales-core.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import { SEQUENCE_RESOURCE, saveDraftSchema, type SaveDraft, type SequenceDraft } from "./draft";
import { applyEmailSenderPolicy, type EmailSenderPolicy } from "./email-sender-policy";
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
