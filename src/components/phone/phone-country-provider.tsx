import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PhoneCountryContext } from "@/lib/phone/phone-country-context";
import { PLATFORM_DEFAULT_PHONE_COUNTRY, asCountry } from "@/lib/phone/e164";

export const PHONE_COUNTRY_QUERY_KEY = ["workspace-phone-country"] as const;

/** Carrega o país padrão do workspace ativo para os campos de telefone. */
export function PhoneCountryProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery({
    queryKey: PHONE_COUNTRY_QUERY_KEY,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return PLATFORM_DEFAULT_PHONE_COUNTRY;
      const { data: profile } = await supabase
        .from("profiles")
        .select("active_workspace_id")
        .eq("id", uid)
        .maybeSingle();
      const ws = (profile as { active_workspace_id?: string | null } | null)?.active_workspace_id;
      if (!ws) return PLATFORM_DEFAULT_PHONE_COUNTRY;
      const { data: c } = await supabase.rpc("workspace_phone_country", { _workspace: ws });
      return asCountry(typeof c === "string" ? c : null) ?? PLATFORM_DEFAULT_PHONE_COUNTRY;
    },
  });
  return (
    <PhoneCountryContext.Provider value={data ?? PLATFORM_DEFAULT_PHONE_COUNTRY}>
      {children}
    </PhoneCountryContext.Provider>
  );
}

/** Para telas públicas: país já conhecido (ex.: vindo do servidor). */
export function StaticPhoneCountry({
  country,
  children,
}: {
  country?: string | null;
  children: ReactNode;
}) {
  return (
    <PhoneCountryContext.Provider value={asCountry(country) ?? PLATFORM_DEFAULT_PHONE_COUNTRY}>
      {children}
    </PhoneCountryContext.Provider>
  );
}
