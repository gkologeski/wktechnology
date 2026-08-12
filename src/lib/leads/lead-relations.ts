/**
 * Regra única de vínculo do Lead com Empresa e Contato.
 *
 * Sempre que um lead é criado (modal, API pública, formulários, MCP, agente de
 * IA, onboarding, importações, agendamento e workflows), garantimos que exista
 * uma empresa e um contato correspondentes, reaproveitando registros já
 * existentes no mesmo workspace antes de criar novos.
 *
 * A função é idempotente: se o lead já tem `company_id`/`converted_contact_id`,
 * nada é criado.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Cliente Supabase (browser, autenticado por usuário ou admin). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySupabase = SupabaseClient<Database, "public", any>;

export type LeadRelationsInput = {
  id: string;
  workspace_id?: string | null;
  owner_id?: string | null;
  assigned_user_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  company_id?: string | null;
  company_name?: string | null;
  converted_contact_id?: string | null;
};

export type LeadRelationsResult = {
  companyId: string | null;
  contactId: string | null;
  createdCompany: boolean;
  createdContact: boolean;
  reusedCompany: boolean;
  reusedContact: boolean;
};

const LEAD_COLUMNS =
  "id, workspace_id, owner_id, assigned_user_id, first_name, last_name, email, phone, company_id, company_name, converted_contact_id";

function text(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

/**
 * Garante empresa e contato vinculados ao lead.
 *
 * @param client Cliente Supabase a usar (respeita RLS quando for o do usuário).
 * @param lead Registro do lead ou apenas seu id (nesse caso é carregado).
 */
export async function ensureLeadRelations(
  client: AnySupabase,
  lead: LeadRelationsInput | string,
): Promise<LeadRelationsResult> {
  const result: LeadRelationsResult = {
    companyId: null,
    contactId: null,
    createdCompany: false,
    createdContact: false,
    reusedCompany: false,
    reusedContact: false,
  };

  let row: LeadRelationsInput | null = typeof lead === "string" ? null : lead;
  if (!row) {
    const { data, error } = await client
      .from("leads")
      .select(LEAD_COLUMNS)
      .eq("id", lead as string)
      .maybeSingle();
    if (error) throw new Error(error.message);
    row = (data as LeadRelationsInput | null) ?? null;
  } else if (row.workspace_id == null || row.owner_id === undefined) {
    // Registro parcial (ex.: retorno de insert com select reduzido): recarrega.
    const { data, error } = await client
      .from("leads")
      .select(LEAD_COLUMNS)
      .eq("id", row.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    row = (data as LeadRelationsInput | null) ?? row;
  }
  if (!row) return result;

  const workspaceId = row.workspace_id ?? null;
  const base: Record<string, unknown> = {};
  if (row.owner_id) base["owner_id"] = row.owner_id;
  if (workspaceId) base["workspace_id"] = workspaceId;
  if (row.assigned_user_id) base["assigned_user_id"] = row.assigned_user_id;

  const patch: Record<string, unknown> = {};

  // ---------- Empresa ----------
  let companyId = text(row.company_id);
  const companyName = text(row.company_name);
  if (!companyId && companyName) {
    let q = client.from("companies").select("id").ilike("name", companyName).limit(1);
    if (workspaceId) q = q.eq("workspace_id", workspaceId);
    const { data: existing, error: findErr } = await q.maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (existing?.id) {
      companyId = existing.id as string;
      result.reusedCompany = true;
    } else {
      const { data: created, error: insErr } = await client
        .from("companies")
        .insert({ ...base, name: companyName } as never)
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      companyId = (created as { id: string }).id;
      result.createdCompany = true;
    }
    patch["company_id"] = companyId;
  }
  result.companyId = companyId;

  // ---------- Contato ----------
  let contactId = text(row.converted_contact_id);
  const email = text(row.email);
  const phone = text(row.phone);
  const firstName = text(row.first_name);
  if (!contactId) {
    if (email) {
      let q = client.from("contacts").select("id").ilike("email", email).limit(1);
      if (workspaceId) q = q.eq("workspace_id", workspaceId);
      const { data: existing, error: findErr } = await q.maybeSingle();
      if (findErr) throw new Error(findErr.message);
      if (existing?.id) {
        contactId = existing.id as string;
        result.reusedContact = true;
      }
    }
    if (!contactId && !email && phone) {
      let q = client.from("contacts").select("id").eq("phone", phone).limit(1);
      if (workspaceId) q = q.eq("workspace_id", workspaceId);
      const { data: existing, error: findErr } = await q.maybeSingle();
      if (findErr) throw new Error(findErr.message);
      if (existing?.id) {
        contactId = existing.id as string;
        result.reusedContact = true;
      }
    }
    if (!contactId && firstName) {
      const { data: created, error: insErr } = await client
        .from("contacts")
        .insert({
          ...base,
          first_name: firstName,
          last_name: text(row.last_name),
          email,
          phone,
          company_id: companyId,
          company_name: companyId ? null : companyName,
        } as never)
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      contactId = (created as { id: string }).id;
      result.createdContact = true;
    }
    if (contactId) patch["converted_contact_id"] = contactId;
  }
  result.contactId = contactId;

  // Mantém a empresa do contato reaproveitado alinhada com a do lead.
  if (result.reusedContact && contactId && companyId) {
    const { data: c } = await client
      .from("contacts")
      .select("company_id")
      .eq("id", contactId)
      .maybeSingle();
    if (c && !(c as { company_id: string | null }).company_id) {
      await client.from("contacts").update({ company_id: companyId }).eq("id", contactId);
    }
  }

  if (Object.keys(patch).length > 0) {
    const { error: upErr } = await client.from("leads").update(patch).eq("id", row.id);
    if (upErr) throw new Error(upErr.message);
  }

  return result;
}

/**
 * Versão tolerante a falhas: nunca lança, para não travar criação de lead em
 * formulários públicos e integrações.
 */
export async function ensureLeadRelationsSafe(
  client: AnySupabase,
  lead: LeadRelationsInput | string,
): Promise<LeadRelationsResult | null> {
  try {
    return await ensureLeadRelations(client, lead);
  } catch (e) {
    console.warn("[ensureLeadRelations] falhou:", e instanceof Error ? e.message : e);
    return null;
  }
}
