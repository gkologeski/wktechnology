import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "@/lib/db-types";

export type ConvertResult = {
  companyId: string | null;
  contactId: string;
  dealId: string;
  reusedCompany: boolean;
};

/**
 * Converts a lead into Company (deduped by name, case-insensitive, per owner) +
 * Contact + Deal, and marks the lead as `qualified`.
 *
 * Throws on first error so the caller can surface it via toast.
 */
export async function convertLead(lead: Lead, ownerId: string): Promise<ConvertResult> {
  let companyId: string | null = null;
  let reusedCompany = false;

  const rawName = (lead.company_name ?? "").trim();
  if (rawName) {
    const { data: existing, error: findErr } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_id", ownerId)
      .ilike("name", rawName)
      .limit(1)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);

    if (existing?.id) {
      companyId = existing.id;
      reusedCompany = true;
    } else {
      const { data: c, error: ce } = await supabase
        .from("companies")
        .insert({ owner_id: ownerId, name: rawName })
        .select("id")
        .single();
      if (ce) throw new Error(ce.message);
      companyId = c?.id ?? null;
    }
  }

  const { data: contact, error: cte } = await supabase
    .from("contacts")
    .insert({
      owner_id: ownerId,
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email,
      phone: lead.phone,
      company_id: companyId,
    })
    .select("id")
    .single();
  if (cte) throw new Error(cte.message);

  const dealName = `Negócio - ${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim();
  const { data: deal, error: de } = await supabase
    .from("deals")
    .insert({
      owner_id: ownerId,
      name: dealName || "Novo negócio",
      stage: "qualified",
      company_id: companyId,
      primary_contact_id: contact?.id,
    })
    .select("id")
    .single();
  if (de) throw new Error(de.message);

  const { error: ue } = await supabase
    .from("leads")
    .update({
      status: "qualified",
      converted_at: new Date().toISOString(),
      converted_contact_id: contact?.id,
      converted_deal_id: deal?.id,
    })
    .eq("id", lead.id);
  if (ue) throw new Error(ue.message);

  return {
    companyId,
    contactId: contact!.id,
    dealId: deal!.id,
    reusedCompany,
  };
}
