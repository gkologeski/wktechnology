// TechERP Access Control — Fase 5: hook client para consultar o escopo de dados efetivo.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyDataScope, type DataScope } from "./scope.functions";

export function useDataScope() {
  const fn = useServerFn(getMyDataScope);
  const q = useQuery({
    queryKey: ["access-control", "data-scope"],
    queryFn: () => fn({}),
    staleTime: 60_000,
  });
  const scope: DataScope = q.data?.scope ?? "own";
  return {
    scope,
    workspaceId: q.data?.workspace_id ?? null,
    isLoading: q.isLoading,
    isWorkspaceWide: scope === "workspace" || scope === "custom",
    isTeamOnly: scope === "team",
    isOwnOnly: scope === "own",
  };
}
