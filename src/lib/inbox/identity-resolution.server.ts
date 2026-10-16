import type { SupabaseClient } from "@supabase/supabase-js";

export type InboxIdentityStatus = "matched" | "ambiguous" | "not_found" | "unresolved" | "manual";
export type InboxIdentityResolution = {
  status: Exclude<InboxIdentityStatus, "unresolved" | "manual">;
  contactId: string | null;
  leadId: string | null;
  matchedCount: number;
};

function normalizeEmail(value?: string | null) {
  const email = value?.trim().toLowerCase();
  return email || null;
}

export function normalizeInboxPhone(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  // Valores lixo ("--", "0", ramais curtos) não são telefones pesquisáveis.
  return digits.length >= 8 ? digits : null;
}

/**
 * Gera formatos equivalentes de um telefone brasileiro: com/sem DDI 55 e
 * com/sem o 9º dígito de celular. Números fora do padrão BR retornam só o
 * próprio valor normalizado (busca exata).
 */
export function buildBrPhoneVariants(value?: string | null): string[] {
  const digits = normalizeInboxPhone(value);
  if (!digits) return [];
  let national = digits.replace(/^0+/, "");
  // 00 55 … (discagem internacional) e 0 XX DDD … (código de operadora).
  if (/^55\d{10,11}$/.test(national) === false && /^\d{2}\d{10,11}$/.test(national)) {
    national = national.slice(2);
  }
  if (national.startsWith("55") && (national.length === 12 || national.length === 13)) {
    national = national.slice(2);
  }
  if (national.length !== 10 && national.length !== 11) return [digits];
  const ddd = national.slice(0, 2);
  if (ddd[0] === "0" || ddd[1] === "0") return [digits];
  const local = national.slice(2);
  const locals = new Set<string>([local]);
  if (local.length === 9 && local[0] === "9") locals.add(local.slice(1));
  // Só celulares (8 dígitos começando em 6-9) ganham o 9 extra; fixos não.
  if (local.length === 8 && /^[6-9]/.test(local)) locals.add(`9${local}`);
  const out = new Set<string>([digits]);
  for (const l of locals) {
    out.add(`${ddd}${l}`);
    out.add(`55${ddd}${l}`);
  }
  return [...out];
}

export function chooseInboxIdentity(
  contactIds: string[],
  leadIds: string[],
): InboxIdentityResolution {
  const contacts = [...new Set(contactIds)];
  const leads = [...new Set(leadIds)];
  if (contacts.length === 1) {
    return { status: "matched", contactId: contacts[0], leadId: null, matchedCount: 1 };
  }
  if (contacts.length > 1) {
    return { status: "ambiguous", contactId: null, leadId: null, matchedCount: contacts.length };
  }
  if (leads.length === 1) {
    return { status: "matched", contactId: null, leadId: leads[0], matchedCount: 1 };
  }
  if (leads.length > 1) {
    return { status: "ambiguous", contactId: null, leadId: null, matchedCount: leads.length };
  }
  return { status: "not_found", contactId: null, leadId: null, matchedCount: 0 };
}

async function findMatches(
  supabase: SupabaseClient,
  table: "contacts" | "leads",
  workspaceId: string,
  phone: string | null,
  email: string | null,
) {
  const filters: string[] = [];
  const variants = buildBrPhoneVariants(phone);
  if (variants.length > 0) {
    const list = `(${variants.join(",")})`;
    filters.push(`phone_digits.in.${list}`, `mobile_phone_digits.in.${list}`);
  }
  if (email) filters.push(`email.ilike.${email}`);
  if (filters.length === 0) return [];

  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .or(filters.join(","))
    .limit(3);
  if (error) throw new Error(`Falha ao procurar ${table}: ${error.message}`);
  return [...new Set((data ?? []).map((row) => row.id))];
}

export async function resolveInboxIdentity(params: {
  supabase: SupabaseClient;
  workspaceId: string;
  phone?: string | null;
  email?: string | null;
}): Promise<InboxIdentityResolution> {
  const phone = normalizeInboxPhone(params.phone);
  const email = normalizeEmail(params.email);
  if (!phone && !email) {
    return { status: "not_found", contactId: null, leadId: null, matchedCount: 0 };
  }

  const contacts = await findMatches(params.supabase, "contacts", params.workspaceId, phone, email);
  if (contacts.length > 0) return chooseInboxIdentity(contacts, []);
  const leads = await findMatches(params.supabase, "leads", params.workspaceId, phone, email);
  return chooseInboxIdentity(contacts, leads);
}

export function identityColumns(resolution: InboxIdentityResolution) {
  return {
    contact_id: resolution.contactId,
    lead_id: resolution.leadId,
    identity_status: resolution.status,
  };
}

/** Origem gravada no destinatário de campanha: "lead:<uuid>", "company:<uuid>"… */
export function parseRecipientSource(
  source: unknown,
): { kind: "lead" | "contact" | "company" | "deal"; id: string } | null {
  if (typeof source !== "string") return null;
  const m = /^(lead|contact|company|deal):([0-9a-f-]{36})$/i.exec(source.trim());
  return m ? { kind: m[1].toLowerCase() as "lead", id: m[2] } : null;
}

/**
 * Associa uma conversa de WhatsApp sem vínculo a Contato/Lead pelo telefone
 * (variantes E.164 com/sem 9º dígito). Vínculo existente ou manual é preservado.
 * `source` (origem do destinatário de campanha) tem precedência quando aponta
 * para contato/lead; empresa restringe a busca aos contatos daquela empresa.
 */
export async function ensureWhatsAppConversationIdentity(
  supabase: SupabaseClient,
  conversationId: string,
  opts: { contactId?: string | null; source?: unknown } = {},
): Promise<InboxIdentityResolution["status"] | "kept" | null> {
  const { data: conv, error } = await supabase
    .from("whatsapp_conversations")
    .select("id, workspace_id, contact_phone, contact_id, lead_id, identity_status")
    .eq("id", conversationId)
    .maybeSingle();
  if (error || !conv) return null;
  if (conv.contact_id || conv.lead_id || conv.identity_status === "manual") return "kept";

  let resolution: InboxIdentityResolution | null = null;
  const src = parseRecipientSource(opts.source);
  if (opts.contactId) {
    resolution = { status: "matched", contactId: opts.contactId, leadId: null, matchedCount: 1 };
  } else if (src?.kind === "contact") {
    resolution = { status: "matched", contactId: src.id, leadId: null, matchedCount: 1 };
  } else if (src?.kind === "lead") {
    resolution = { status: "matched", contactId: null, leadId: src.id, matchedCount: 1 };
  } else if (src?.kind === "company") {
    const variants = buildBrPhoneVariants(conv.contact_phone);
    if (variants.length) {
      const list = `(${variants.join(",")})`;
      const { data } = await supabase
        .from("contacts")
        .select("id")
        .eq("workspace_id", conv.workspace_id)
        .eq("company_id", src.id)
        .is("deleted_at", null)
        .or(`phone_digits.in.${list},mobile_phone_digits.in.${list}`)
        .limit(3);
      const ids = (data ?? []).map((r: { id: string }) => r.id);
      if (ids.length) resolution = chooseInboxIdentity(ids, []);
    }
  } else if (src?.kind === "deal") {
    const { data } = await supabase
      .from("deals")
      .select("primary_contact_id")
      .eq("id", src.id)
      .eq("workspace_id", conv.workspace_id)
      .maybeSingle();
    const pc = (data as { primary_contact_id?: string | null } | null)?.primary_contact_id;
    if (pc) resolution = { status: "matched", contactId: pc, leadId: null, matchedCount: 1 };
  }
  if (!resolution) {
    resolution = await resolveInboxIdentity({
      supabase,
      workspaceId: conv.workspace_id,
      phone: conv.contact_phone,
    });
  }
  const { error: uErr } = await supabase
    .from("whatsapp_conversations")
    .update(identityColumns(resolution))
    .eq("id", conversationId)
    .is("contact_id", null)
    .is("lead_id", null)
    .neq("identity_status", "manual");
  if (uErr) return null;
  return resolution.status;
}
