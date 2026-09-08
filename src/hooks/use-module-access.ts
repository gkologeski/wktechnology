// Acesso efetivo a módulos (licença do workspace ∩ permissões do usuário).
// Fonte única para o troca-módulos, o gate de rotas e o painel de módulos.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyModuleAccess, type MyModuleAccess } from "@/lib/modules/module-access.functions";
import type { ModuleId } from "@/lib/modules/registry";

export function useModuleAccess() {
  const fn = useServerFn(getMyModuleAccess);
  const query = useQuery<MyModuleAccess>({
    queryKey: ["my-module-access"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
  });

  const data = query.data;
  const unrestricted = !data || data.unrestricted;

  /** Enquanto carrega (ou sem restrição aplicável) não bloqueia nada. */
  const canAccessModule = (moduleId: string): boolean => {
    if (unrestricted) return true;
    return data.allowed.includes(moduleId);
  };

  const allowedModules = (unrestricted ? [] : (data.allowed as ModuleId[])) as ModuleId[];

  /** Único módulo disponível, quando houver exatamente um. */
  const soleModule: ModuleId | null =
    !unrestricted && allowedModules.length === 1 ? allowedModules[0] : null;

  return {
    loading: query.isLoading,
    unrestricted,
    allowedModules,
    soleModule,
    canAccessModule,
  };
}
