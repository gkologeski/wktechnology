// Hook que carrega o cache de hubspot_owners do workspace e expõe um resolver por id.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type HubspotOwnerLite = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  status: string;
  mapped_user_id: string | null;
};

export function useHubspotOwners() {
  return useQuery({
    queryKey: ["hubspot-owners"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("hubspot_owners")
        .select("id, email, first_name, last_name, status, mapped_user_id");
      const list = (data ?? []) as HubspotOwnerLite[];
      const byId = new Map(list.map((o) => [o.id, o]));
      return { list, byId };
    },
  });
}

export function ownerDisplayName(o?: HubspotOwnerLite | null): string {
  if (!o) return "";
  const full = `${o.first_name ?? ""} ${o.last_name ?? ""}`.trim();
  return full || o.email || o.id;
}
