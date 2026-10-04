import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CompanyLogoInfo = {
  id: string;
  name: string | null;
  logo_url: string | null;
  logo_source: string | null;
  domain: string | null;
  website: string | null;
};

/** Carrega, em uma única consulta, os dados de logotipo das empresas visíveis. */
export function useCompanyLogos(ids: Array<string | null | undefined>) {
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x))).sort();
  return useQuery({
    queryKey: ["company-logos", unique],
    enabled: unique.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const map = new Map<string, CompanyLogoInfo>();
      for (let i = 0; i < unique.length; i += 200) {
        const { data, error } = await supabase
          .from("companies")
          .select("id, name, logo_url, logo_source, domain, website")
          .in("id", unique.slice(i, i + 200));
        if (error) throw error;
        (data ?? []).forEach((c) => map.set(c.id, c as CompanyLogoInfo));
      }
      return map;
    },
  });
}

/** Empresa do contato ou lead associado (Inbox). */
export function useLinkedCompany(contactId?: string | null, leadId?: string | null) {
  return useQuery({
    queryKey: ["linked-company", contactId ?? null, leadId ?? null],
    enabled: !!contactId || !!leadId,
    queryFn: async (): Promise<CompanyLogoInfo | null> => {
      const table = contactId ? "contacts" : "leads";
      const { data: row } = await supabase
        .from(table)
        .select("company_id")
        .eq("id", (contactId ?? leadId) as string)
        .maybeSingle();
      const companyId = (row as { company_id?: string | null } | null)?.company_id;
      if (!companyId) return null;
      const { data } = await supabase
        .from("companies")
        .select("id, name, logo_url, logo_source, domain, website")
        .eq("id", companyId)
        .maybeSingle();
      return (data as CompanyLogoInfo | null) ?? null;
    },
  });
}
