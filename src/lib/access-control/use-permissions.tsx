// Hook client para checagem de permissões na UI.
// Usa TanStack Query e cache global; recarregue com invalidateQueries(["my-permissions"]).
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useCallback } from "react";
import { getMyPermissions } from "@/lib/access-control/permissions.functions";

export type UsePermissionsResult = {
  isLoading: boolean;
  /** true quando a consulta de permissões falhou (≠ "não tem permissão"). */
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  workspaceId: string | null;
  permissions: Set<string>;
  /** true se o usuário tem a permissão. */
  can: (key: string) => boolean;
  /** true se tem QUALQUER uma das permissões. */
  canAny: (keys: string[]) => boolean;
  /** true se tem TODAS as permissões. */
  canAll: (keys: string[]) => boolean;
};

export function usePermissions(): UsePermissionsResult {
  const fetchPerms = useServerFn(getMyPermissions);
  const query = useQuery({
    queryKey: ["my-permissions"],
    queryFn: () => fetchPerms(),
    staleTime: 5 * 60_000,
    retry: 2,
  });

  const set = useMemo(
    () => new Set<string>(query.data?.permissions ?? []),
    [query.data?.permissions],
  );

  const can = useCallback((key: string) => set.has(key), [set]);
  const canAny = useCallback((keys: string[]) => keys.some((k) => set.has(k)), [set]);
  const canAll = useCallback((keys: string[]) => keys.every((k) => set.has(k)), [set]);

  const refetch = useCallback(() => {
    void query.refetch();
  }, [query]);

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    error: (query.error as Error) ?? null,
    refetch,
    workspaceId: query.data?.workspace_id ?? null,
    permissions: set,
    can,
    canAny,
    canAll,
  };
}

/**
 * Componente utilitário: renderiza `children` apenas se o usuário tem a permissão.
 * Uso:  <Can permission="ats.jobs.create"><Button>Nova vaga</Button></Can>
 */
export function Can({
  permission,
  any,
  all,
  fallback = null,
  children,
}: {
  permission?: string;
  any?: string[];
  all?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { can, canAny, canAll, isLoading } = usePermissions();
  if (isLoading) return null;
  let ok = true;
  if (permission) ok = ok && can(permission);
  if (any && any.length) ok = ok && canAny(any);
  if (all && all.length) ok = ok && canAll(all);
  return <>{ok ? children : fallback}</>;
}
