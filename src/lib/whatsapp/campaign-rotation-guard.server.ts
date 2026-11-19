// Validação server-side do rodízio de modelos e atualização das variáveis
// dos destinatários pendentes quando o mapeamento muda.
import { buildAudience, fieldsForBase } from "./campaign-audience";
import { countTemplateVariables } from "./meeting-reminders";
import { loadApprovedTemplates } from "./templates.server";

type RotationItem = {
  name: string;
  language?: string | null;
  variableCount: number;
  senders?: string[];
};

/**
 * Todo modelo do rodízio precisa estar APROVADO e com o nº de variáveis correto
 * em cada número a que está ligado (MODELOS-POR-NUMERO); sem números, no principal.
 */
export async function assertRotationApproved(
  supabase: any,
  workspaceId: string,
  rotation: RotationItem[] | undefined,
  phoneNumberId: string | null | undefined,
): Promise<void> {
  if (!rotation || rotation.length === 0) return;
  if (rotation.length <= 1 && !rotation[0]?.senders?.length) return;
  const cache = new Map<string, Awaited<ReturnType<typeof loadApprovedTemplates>>>();
  const load = async (id: string | null) => {
    const k = id ?? "";
    if (!cache.has(k))
      cache.set(k, await loadApprovedTemplates(supabase, workspaceId, { phoneNumberId: id }));
    return cache.get(k)!;
  };
  for (const t of rotation) {
    const nums = t.senders?.length ? t.senders : [phoneNumberId ?? null];
    for (const id of nums) {
      const hit = (await load(id)).find(
        (a) => a.name === t.name && (!t.language || a.language === t.language),
      );
      if (!hit) throw new Error(`O modelo "${t.name}" não está aprovado na Meta para este número.`);
      if (countTemplateVariables(hit.components) !== t.variableCount)
        throw new Error(
          `O modelo "${t.name}" mudou na Meta. Atualize os modelos e salve novamente.`,
        );
    }
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
  const { loadAudienceRows, loadOptedOutPhones, loadSuppressedPhones } =
    await import("./campaign-audience.server");
  const { base, rows } = await loadAudienceRows(supabase, workspaceId, audience, userId);
  // Mesma lista branca do público (texto livre sempre permitido).
  const allowed = new Set(fieldsForBase(base).map((f) => f.key));
  for (const b of Object.values(variableMap))
    if (b.field !== "__free__" && !allowed.has(b.field))
      throw new Error("Campo de variável não permitido.");
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

/**
 * ROTACAO-NUMEROS: cada número adicional precisa ser oficial do workspace e ter
 * TODOS os modelos da campanha (principal + rodízio) aprovados na Meta.
 */
export async function assertSendersApproved(
  supabase: any,
  workspaceId: string,
  primary: string | null | undefined,
  extras: string[] | undefined,
  templates: { name: string; language?: string | null; senders?: string[] }[],
): Promise<void> {
  if (!extras || extras.length === 0) return;
  if (!primary) throw new Error("Escolha um número oficial principal antes de adicionar outros.");
  if (templates.length === 0)
    throw new Error("Rodízio de números exige modelo aprovado pela Meta.");
  const { resolveWaNumber } = await import("./meta-channel.server");
  const chosen = [primary, ...extras];
  // MODELOS-POR-NUMERO: modelo ligado a números só pode usar números do rodízio.
  for (const t of templates) {
    if (t.senders?.length && !t.senders.some((s) => chosen.includes(s)))
      throw new Error(`O modelo "${t.name}" não está ligado a nenhum número do rodízio.`);
  }
  for (const id of extras) {
    const num = await resolveWaNumber(workspaceId, id).catch(() => null);
    if (!num || num.phoneNumberId !== id)
      throw new Error(`O número ${id} não está ativo neste workspace.`);
    const approved = await loadApprovedTemplates(supabase, workspaceId, { phoneNumberId: id });
    for (const t of templates) {
      if (t.senders?.length) continue; // validado por par em assertRotationApproved
      const hit = approved.find(
        (a) => a.name === t.name && (!t.language || a.language === t.language),
      );
      if (!hit)
        throw new Error(
          `O modelo "${t.name}" não está aprovado na Meta para o número ${num.displayPhoneNumber}.`,
        );
    }
  }
}
