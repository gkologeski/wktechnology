// Hook de licenças de módulo do workspace ativo.
// Usado pelo ModuleSwitcher, pelo menu e pelo gate de rotas de módulo.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getModuleLicenses, type ModuleLicenses } from "@/lib/modules/licenses.functions";

const NO_SESSION: ModuleLicenses = { workspaceId: null, enabled: [], unrestricted: true };

export function useModuleLicenses() {
  const fn = useServerFn(getModuleLicenses);
  const query = useQuery<ModuleLicenses>({
    queryKey: ["module-licenses"],
    queryFn: async () => {
      // Sem sessão (ex.: /login) a server fn protegida retornaria 401.
      const { data } = await supabase.auth.getSession();
      if (!data.session) return NO_SESSION;
      return await fn();
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const data = query.data;

  /** Enquanto carrega (ou sem controle configurado) não bloqueia nada. */
  const isLicensed = (moduleId: string): boolean => {
    if (!data) return true;
    if (data.unrestricted) return true;
    return data.enabled.includes(moduleId);
  };

  return { isLicensed, loading: query.isLoading, licenses: data };
}
