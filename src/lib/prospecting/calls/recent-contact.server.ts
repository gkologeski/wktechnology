// Quais leads da campanha tiveram contato recente vindo de OUTRA campanha.
// Usa o cliente do usuário (RLS) — só enxerga o que ele pode ver.
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSalesArea } from "@/lib/access-control/sales-core.server";
import { brPhoneVariants } from "@/lib/whatsapp/phone-variants";
import { recentReason, recentSince, type RecentContactConfig } from "./recent-contact";

export async function findRecentlyContacted(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: SupabaseClient<any>,
  ws: string,
  campaignId: string,
  leads: Array<{ id: string; phone: string | null }>,
  cfg: RecentContactConfig,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const since = recentSince(cfg);
  if (!since || leads.length === 0) return out;
  // Defesa em profundidade: quem consulta precisa ver campanhas.
  await assertSalesArea(sb, "techsales.marketing.campaigns", "view");
  const ids = leads.map((l) => l.id);
  for (let i = 0; i < ids.length; i += 500) {
    const { data, error } = await sb
      .from("prospecting_call_attempts")
      .select("lead_id")
      .eq("workspace_id", ws)
      .neq("campaign_id", campaignId)
      .gte("created_at", since)
      .in("lead_id", ids.slice(i, i + 500));
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as Array<{ lead_id: string | null }>)
      if (r.lead_id) out.set(r.lead_id, recentReason("call", cfg.days));
  }
  if (cfg.scope !== "calls_whatsapp") return out;
  const phoneToLead = new Map<string, string>();
  for (const l of leads) {
    if (!l.phone || out.has(l.id)) continue;
    for (const v of brPhoneVariants(l.phone)) phoneToLead.set(v, l.id);
  }
  const phones = [...phoneToLead.keys()];
  for (let i = 0; i < phones.length; i += 500) {
    const { data, error } = await sb
      .from("whatsapp_campaign_recipients")
      .select("phone")
      .eq("workspace_id", ws)
      .eq("status", "sent")
      .gte("sent_at", since)
      .in("phone", phones.slice(i, i + 500));
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as Array<{ phone: string }>) {
      const lid = phoneToLead.get(r.phone);
      if (lid && !out.has(lid)) out.set(lid, recentReason("whatsapp", cfg.days));
    }
  }
  return out;
}
