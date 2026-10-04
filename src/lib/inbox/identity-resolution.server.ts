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
  return digits || null;
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
  if (phone) filters.push(`phone_digits.eq.${phone}`, `mobile_phone_digits.eq.${phone}`);
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
