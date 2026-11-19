import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getContractLegacyState } from "@/lib/contracts/legacy.functions";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { legacyGate, legacyMode } from "@/lib/contracts/legacy-view";

/** Situação de legado do contrato importado. Sem arquivo importado, o contrato é comum (sem consulta). */
export function useContractLegacy(contractId: string, imported: boolean) {
  const { can } = usePermissions();
  // Sem a chave de leitura não há consulta: o banco também negaria; a tela não presume "não legado".
  const canView = can("techcontracts.legacy_contracts.view.workspace");
  const load = useServerFn(getContractLegacyState);
  const query = useQuery({
    queryKey: ["contract-legacy", contractId],
    queryFn: () => load({ data: { contractId } }),
    enabled: imported && canView,
    retry: 1,
    staleTime: 0,
  });
  const mode = !imported
    ? "ineligible"
    : !canView
      ? "denied"
      : legacyMode({ isLoading: query.isLoading, isError: query.isError, data: query.data });
  return { query, mode, gate: legacyGate(mode) };
}
