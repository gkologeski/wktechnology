// Validação server-side do rodízio de modelos e atualização das variáveis
// dos destinatários pendentes quando o mapeamento muda.
import { countTemplateVariables } from "./meeting-reminders";
import { loadApprovedTemplates } from "./templates.server";

type RotationItem = { name: string; language?: string | null; variableCount: number };

/** Todo modelo do rodízio precisa estar APROVADO e com o nº de variáveis correto. */
export async function assertRotationApproved(
  supabase: any,
  workspaceId: string,
  rotation: RotationItem[] | undefined,
  phoneNumberId: string | null | undefined,
): Promise<void> {
  if (!rotation || rotation.length <= 1) return;
  const approved = await loadApprovedTemplates(supabase, workspaceId, {
    phoneNumberId: phoneNumberId ?? null,
  });
  for (const t of rotation) {
    const hit = approved.find(
      (a) => a.name === t.name && (!t.language || a.language === t.language),
    );
    if (!hit) throw new Error(`O modelo "${t.name}" não está aprovado na Meta para este número.`);
    if (countTemplateVariables(hit.components) !== t.variableCount)
      throw new Error(`O modelo "${t.name}" mudou na Meta. Atualize os modelos e salve novamente.`);
  }
}

/**
 * Recalcula as variáveis dos destinatários pendentes (rascunho ou pausada) com o
 * mapeamento atual, preservando os demais dados da linha.
 */
export async function refreshPendingVariables(
  supabase: any,
  workspaceId: string,
  userId: string,
  campaignId: string,
  audience: any,
  variableMap: Record<string, { field: string; fallback?: string }>,
): Promise<number> {
  const { buildAudience, isAllowedField } = await import("./campaign-audience");
  const { loadAudienceRows, loadOptedOutPhones, loadSuppressedPhones } =
    await import("./campaign-audience.server");
  const { base, rows } = await loadAudienceRows(supabase, workspaceId, audience, userId);
  for (const b of Object.values(variableMap))
    if (!isAllowedField(base, b.field)) throw new Error("Campo de variável não permitido.");
  const s = buildAudience(
    rows,
    variableMap,
    await loadOptedOutPhones(supabase, workspaceId),
    await loadSuppressedPhones(supabase, workspaceId),
  );
  const byPhone = new Map(s.recipients.map((r) => [r.phone, r.variables]));
  const pending: { id: string; phone: string; variables: Record<string, string> | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("whatsapp_campaign_recipients")
      .select("id, phone, variables")
      .eq("campaign_id", campaignId)
      .eq("status", "pending")
      .range(from, from + 999);
    if (error) throw error;
    pending.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  let updated = 0;
  const todo = pending.filter((p) => byPhone.has(p.phone));
  for (let i = 0; i < todo.length; i += 20) {
    const res = await Promise.all(
      todo.slice(i, i + 20).map((p) =>
        supabase
          .from("whatsapp_campaign_recipients")
          .update({ variables: { ...(p.variables ?? {}), ...byPhone.get(p.phone) } })
          .eq("id", p.id),
      ),
    );
    for (const r of res) if (r.error) throw r.error;
    updated += res.length;
  }
  return updated;
}
