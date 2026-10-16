import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { personName, type IdentityNameRow } from "@/lib/inbox/identity-names";

/** Nomes de Contatos/Leads associados às conversas visíveis, em lote (RLS do usuário). */
export function useInboxIdentityNames(
  rows: { contact_id?: string | null; lead_id?: string | null }[],
) {
  const contactIds = [...new Set(rows.map((r) => r.contact_id).filter(Boolean) as string[])].sort();
  const leadIds = [...new Set(rows.map((r) => r.lead_id).filter(Boolean) as string[])].sort();
  const q = useQuery({
    queryKey: ["inbox-channel", "whatsapp", "identity-names", contactIds, leadIds],
    enabled: contactIds.length + leadIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const load = async (table: "contacts" | "leads", ids: string[]) => {
        const map = new Map<string, string>();
        if (!ids.length) return map;
        const { data } = await supabase
          .from(table)
          .select("id, first_name, last_name, email")
          .in("id", ids);
        for (const r of (data ?? []) as IdentityNameRow[]) {
          const n = personName(r);
          if (n) map.set(r.id, n);
        }
        return map;
      };
      const [contacts, leads] = await Promise.all([
        load("contacts", contactIds),
        load("leads", leadIds),
      ]);
      return { contacts, leads };
    },
  });
  return q.data ?? { contacts: new Map<string, string>(), leads: new Map<string, string>() };
}
