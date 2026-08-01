// TechERP Access Control — hook client para o escopo efetivo de leitura por recurso.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getResourceScope,
  type ResourceScope,
  type ResourceScopeResult,
} from "./resource-scope.functions";

export function useResourceScope(resource: string, action = "view") {
  const fn = useServerFn(getResourceScope);
  const q = useQuery<ResourceScopeResult>({
    queryKey: ["access-control", "resource-scope", resource, action],
    queryFn: () => fn({ data: { resource, action } }),
    staleTime: 60_000,
  });
  const scope: ResourceScope = q.data?.scope ?? "own";
  return {
    scope,
    ownerIds: q.data?.owner_ids ?? null,
    isLoading: q.isLoading,
    isWorkspaceWide: scope === "workspace",
    isTeam: scope === "team",
    isOwnOnly: scope === "own",
    hasNoAccess: scope === "none",
  };
}
