// Carrega a situação comercial (cliente / negociação aberta) por telefone, no
// workspace e com o cliente recebido (RLS do usuário na montagem; admin no disparo).
import { chunkIds } from "@/lib/chunk-ids";
import { dealState, type CommercialFlag } from "./commercial-status";

type Db = any;

const add = (m: Map<string, Set<CommercialFlag>>, k: string, f: CommercialFlag) => {
  const s = m.get(k) ?? new Set<CommercialFlag>();
  s.add(f);
  m.set(k, s);
};

export async function loadCommercialFlags(
  db: Db,
  workspaceId: string,
  phones: string[],
): Promise<Map<string, Set<CommercialFlag>>> {
  const out = new Map<string, Set<CommercialFlag>>();
  const uniq = [...new Set(phones.filter(Boolean))];
  if (!uniq.length) return out;
  // telefone → contatos / leads (+ empresas)
  const contactsByPhone = new Map<string, { id: string; company_id: string | null }[]>();
  const leadsByPhone = new Map<string, { id: string; company_id: string | null }[]>();
  for (const part of chunkIds(uniq, 150)) {
    const [{ data: cs }, { data: ls }] = await Promise.all([
      db
        .from("contacts")
        .select("id, company_id, whatsapp_e164")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .in("whatsapp_e164", part),
      db
        .from("leads")
        .select("id, company_id, whatsapp_e164, converted_contact_id")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .in("whatsapp_e164", part),
    ]);
    for (const c of cs ?? [])
      contactsByPhone.set(c.whatsapp_e164, [...(contactsByPhone.get(c.whatsapp_e164) ?? []), c]);
    for (const l of ls ?? []) {
      leadsByPhone.set(l.whatsapp_e164, [...(leadsByPhone.get(l.whatsapp_e164) ?? []), l]);
      if (l.converted_contact_id)
        contactsByPhone.set(l.whatsapp_e164, [
          ...(contactsByPhone.get(l.whatsapp_e164) ?? []),
          { id: l.converted_contact_id, company_id: l.company_id },
        ]);
    }
  }
  const contactIds = [...new Set([...contactsByPhone.values()].flat().map((c) => c.id))];
  const leadIds = [...new Set([...leadsByPhone.values()].flat().map((l) => l.id))];
  const companyIds = [
    ...new Set(
      [...contactsByPhone.values(), ...leadsByPhone.values()]
        .flat()
        .map((x) => x.company_id)
        .filter(Boolean) as string[],
    ),
  ];
  const companyFlags = new Map<string, Set<CommercialFlag>>();
  const contactFlags = new Map<string, Set<CommercialFlag>>();
  const leadFlags = new Map<string, Set<CommercialFlag>>();
  const mark = (stage: string | null, cb: (f: CommercialFlag) => void) => {
    const st = dealState(stage);
    if (st === "won") cb("customer");
    else if (st === "open") cb("open_deal");
  };
  const DEAL_COLS = "id, stage, company_id, primary_contact_id, lead_id";
  for (const part of chunkIds(companyIds, 150)) {
    const [{ data: ds }, { data: ks }] = await Promise.all([
      db
        .from("deals")
        .select(DEAL_COLS)
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .in("company_id", part),
      db
        .from("contracts")
        .select("counterparty_company_id")
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .in("counterparty_company_id", part),
    ]);
    for (const d of ds ?? []) mark(d.stage, (f) => add(companyFlags, d.company_id, f));
    for (const k of ks ?? []) add(companyFlags, k.counterparty_company_id, "customer");
  }
  for (const part of chunkIds(contactIds, 150)) {
    const [{ data: ds }, { data: links }] = await Promise.all([
      db
        .from("deals")
        .select(DEAL_COLS)
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .in("primary_contact_id", part),
      db.from("deal_contacts").select("deal_id, contact_id").in("contact_id", part),
    ]);
    for (const d of ds ?? []) mark(d.stage, (f) => add(contactFlags, d.primary_contact_id, f));
    const linkDealIds = [...new Set((links ?? []).map((l: { deal_id: string }) => l.deal_id))];
    for (const dp of chunkIds(linkDealIds as string[], 150)) {
      const { data: ld } = await db
        .from("deals")
        .select("id, stage")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .in("id", dp);
      const st = new Map((ld ?? []).map((d: { id: string; stage: string }) => [d.id, d.stage]));
      for (const l of links ?? [])
        if (st.has(l.deal_id))
          mark(st.get(l.deal_id) as string, (f) => add(contactFlags, l.contact_id, f));
    }
  }
  for (const part of chunkIds(leadIds, 150)) {
    const { data: ds } = await db
      .from("deals")
      .select(DEAL_COLS)
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .in("lead_id", part);
    for (const d of ds ?? []) mark(d.stage, (f) => add(leadFlags, d.lead_id, f));
  }
  for (const phone of uniq) {
    const merge = (s?: Set<CommercialFlag>) => s?.forEach((f) => add(out, phone, f));
    for (const c of contactsByPhone.get(phone) ?? []) {
      merge(contactFlags.get(c.id));
      if (c.company_id) merge(companyFlags.get(c.company_id));
    }
    for (const l of leadsByPhone.get(phone) ?? []) {
      merge(leadFlags.get(l.id));
      if (l.company_id) merge(companyFlags.get(l.company_id));
    }
  }
  return out;
}
