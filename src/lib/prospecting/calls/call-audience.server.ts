// Resolve o público da Campanha de Ligação (quadro igual ao do WhatsApp) em Leads,
// com o cliente do usuário (RLS) e o workspace ativo.
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSalesArea } from "@/lib/access-control/sales-core.server";
import { brPhoneVariants } from "@/lib/whatsapp/phone-variants";
import { findRecentlyContacted } from "./recent-contact.server";
import type { RecentContactConfig } from "./recent-contact";
import { parseManualPhones, type CallAudienceConfig } from "./call-audience";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any>;
type Lead = { id: string; label: string; phone: string | null };

const NIL = "00000000-0000-0000-0000-000000000000";

function e164(p: string | null | undefined): string | null {
  const d = String(p ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return `+${d.length <= 11 ? `55${d}` : d}`;
}

async function leadsFromManual(db: Db, ws: string, raw: string) {
  const phones = parseManualPhones(raw);
  const variants = [...new Set(phones.flatMap(brPhoneVariants))];
  const found = new Map<string, Lead>();
  const matched = new Set<string>();
  for (let i = 0; i < variants.length; i += 150) {
    const part = variants.slice(i, i + 150);
    const list = part.join(",");
    const { data, error } = await db
      .from("leads")
      .select("id, first_name, last_name, company_name, phone, whatsapp_e164")
      .eq("workspace_id", ws)
      .is("deleted_at", null)
      .or(`whatsapp_e164.in.(${list}),phone.in.(${list})`);
    if (error) throw new Error(error.message);
    for (const l of data ?? []) {
      const ph = e164(l.whatsapp_e164) ?? e164(l.phone);
      found.set(l.id, {
        id: l.id,
        label: [l.first_name, l.last_name].filter(Boolean).join(" ") || l.company_name || "",
        phone: ph,
      });
      for (const v of [l.whatsapp_e164, e164(l.phone)]) if (v) matched.add(v);
    }
  }
  const notFound = phones.filter((p) => !brPhoneVariants(p).some((v) => matched.has(v))).length;
  return { leads: [...found.values()], found: phones.length, notFound };
}

export async function resolveCallAudience(
  db: Db,
  ws: string,
  userId: string,
  campaignId: string | null,
  cfg: CallAudienceConfig,
  recent: RecentContactConfig,
) {
  await assertSalesArea(db, "techsales.marketing.campaigns", "view");
  const s = cfg.state;
  let leads: Lead[] = [];
  let found = 0;
  let truncated = false;
  let notFound = 0;
  if (s.mode === "manual") {
    const r = await leadsFromManual(db, ws, cfg.manualRaw);
    leads = r.leads;
    found = r.found;
    notFound = r.notFound;
  } else {
    const { loadAudienceRows } = await import("@/lib/whatsapp/campaign-audience.server");
    const { normalizeAudienceGroups } = await import("@/lib/whatsapp/campaign-audience");
    const audience =
      s.mode === "queue"
        ? { type: "queue" as const, queue_id: s.queueId }
        : {
            type: "filter" as const,
            base: "leads" as const,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            groups: normalizeAudienceGroups({ groups: s.groups as any }),
            groups_logic: s.groupsLogic,
          };
    if (s.mode === "queue" && !s.queueId) throw new Error("Escolha uma fila.");
    const res = await loadAudienceRows(db, ws, audience, userId);
    if (res.base !== "leads")
      throw new Error("Campanhas de ligação usam Leads. Escolha uma fila de Leads.");
    found = res.rows.length;
    truncated = res.truncated;
    const seen = new Set<string>();
    for (const r of res.rows) {
      if (seen.has(r.sourceId)) continue;
      seen.add(r.sourceId);
      const ph = (r.phones ?? [r.phone]).map(e164).find(Boolean) ?? null;
      leads.push({ id: r.sourceId, label: r.label, phone: ph });
    }
  }
  const noPhone = leads.filter((l) => !l.phone).length;
  const withPhone = leads.filter((l) => l.phone);

  const recentMap = await findRecentlyContacted(db, ws, campaignId ?? NIL, withPhone, recent);
  const ov = new Set(s.recentOverrides);
  const recentRemoved = withPhone.filter((l) => recentMap.has(l.id) && !ov.has(l.phone!));
  const recentOverridden = withPhone.filter((l) => recentMap.has(l.id) && ov.has(l.phone!)).length;
  const afterRecent = withPhone.filter((l) => !recentMap.has(l.id) || ov.has(l.phone!));

  const { loadCommercialFlags } = await import("@/lib/campaigns/commercial-status.server");
  const { splitCommercial, COMMERCIAL_LABEL } = await import("@/lib/campaigns/commercial-status");
  const flags = await loadCommercialFlags(
    db,
    ws,
    afterRecent.map((l) => l.phone!),
  );
  const commercial = splitCommercial(
    afterRecent,
    (l) => l.phone!,
    flags,
    { excludeCustomers: s.excludeCustomers, excludeOpenDeals: s.excludeOpenDeals },
    new Set(s.commercialOverrides),
  );
  return {
    leadIds: commercial.kept.map((l) => l.id),
    preview: {
      base: "leads",
      found,
      truncated,
      included: commercial.kept.length,
      notFound,
      excluded: { no_phone: noPhone, invalid_phone: 0, duplicate: 0, opted_out: 0 },
      recentRemovedCount: recentRemoved.length,
      recentOverriddenCount: recentOverridden,
      recentRemoved: recentRemoved.slice(0, 200).map((l) => ({
        label: l.label,
        phone: l.phone!,
        reason: recentMap.get(l.id) ?? "",
      })),
      commercialRemovedCount: commercial.removed.length,
      commercialOverriddenCount: commercial.kept.filter((l) => l.overrideCommercial).length,
      commercialRemoved: commercial.removed.slice(0, 200).map((l) => ({
        label: l.label,
        phone: l.phone!,
        reason: COMMERCIAL_LABEL[l.commercialReason],
      })),
    },
  };
}
