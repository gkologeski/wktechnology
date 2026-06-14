import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Calcula IDs "relacionados" para priorizar em campos de busca de entidades.
 *
 * Dado o estado parcial do form (contact_id, company_id, deal_id), retorna,
 * para cada entidade-alvo, a lista de ids já associados via:
 *   - contacts.company_id
 *   - deals.company_id / deals.primary_contact_id
 *   - deal_contacts (N:N)
 *
 * Uso: passe o retorno como `priorityIds` para o EntityCombobox correspondente.
 */
export type RelatedFormState = {
  contactId?: string | null;
  companyId?: string | null;
  dealId?: string | null;
};

export type RelatedIds = {
  contacts: string[];
  companies: string[];
  deals: string[];
};

const EMPTY: RelatedIds = { contacts: [], companies: [], deals: [] };

export function useRelatedIds({ contactId, companyId, dealId }: RelatedFormState): RelatedIds {
  const [ids, setIds] = useState<RelatedIds>(EMPTY);

  useEffect(() => {
    let cancel = false;
    if (!contactId && !companyId && !dealId) {
      setIds(EMPTY);
      return;
    }
    (async () => {
      const contacts = new Set<string>();
      const companies = new Set<string>();
      const deals = new Set<string>();

      // A partir de contact_id
      if (contactId) {
        contacts.add(contactId);
        const [{ data: c }, { data: dc }, { data: dPrim }] = await Promise.all([
          supabase.from("contacts").select("company_id").eq("id", contactId).maybeSingle(),
          supabase.from("deal_contacts").select("deal_id").eq("contact_id", contactId),
          supabase.from("deals").select("id").eq("primary_contact_id", contactId),
        ]);
        if (c?.company_id) companies.add(c.company_id as string);
        (dc ?? []).forEach((r) => r.deal_id && deals.add(r.deal_id as string));
        (dPrim ?? []).forEach((r) => r.id && deals.add(r.id as string));
      }

      // A partir de company_id
      if (companyId) {
        companies.add(companyId);
        const [{ data: cs }, { data: ds }] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from("contacts").select("id").eq("company_id", companyId).limit(50),
          supabase
            .from("deals")
            .select("id, primary_contact_id")
            .eq("company_id", companyId)
            .limit(50),
        ]);
        (cs ?? []).forEach((r: { id: string }) => contacts.add(r.id));
        (ds ?? []).forEach((r) => {
          if (r.id) deals.add(r.id as string);
          if (r.primary_contact_id) contacts.add(r.primary_contact_id as string);
        });
      }

      // A partir de deal_id
      if (dealId) {
        deals.add(dealId);
        const [{ data: d }, { data: dc2 }] = await Promise.all([
          supabase
            .from("deals")
            .select("company_id, primary_contact_id")
            .eq("id", dealId)
            .maybeSingle(),
          supabase.from("deal_contacts").select("contact_id").eq("deal_id", dealId),
        ]);
        if (d?.company_id) companies.add(d.company_id as string);
        if (d?.primary_contact_id) contacts.add(d.primary_contact_id as string);
        (dc2 ?? []).forEach((r) => r.contact_id && contacts.add(r.contact_id as string));
      }

      if (cancel) return;
      setIds({
        contacts: Array.from(contacts),
        companies: Array.from(companies),
        deals: Array.from(deals),
      });
    })();
    return () => {
      cancel = true;
    };
  }, [contactId, companyId, dealId]);

  return ids;
}
