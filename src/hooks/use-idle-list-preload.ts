// Pré-carrega, com o navegador ocioso, o código e as preferências de grade das
// listagens pesadas — apenas as do módulo ativo e com permissão de leitura.
// Roda uma de cada vez, depois da primeira tela, nunca durante uma navegação,
// respeita economia de dados e é cancelado ao trocar usuário/workspace/módulo.
// O pré-carregamento por intenção (passar o mouse no link) continua no roteador.
import { useEffect } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { getGridPreference } from "@/lib/grid-preferences.functions";
import { getEntityFieldCatalog } from "@/lib/entity-fields.functions";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useModuleAccess } from "@/hooks/use-module-access";
import { useActiveModule } from "@/lib/modules/active-module";
import { planIdlePreload, type ConnectionHint } from "@/lib/preload/idle-list-plan";

const START_DELAY_MS = 4000;

export function useIdleListPreload(enabled: boolean, identity: string | null) {
  const router = useRouter();
  const qc = useQueryClient();
  const activeModule = useActiveModule();
  const { canAny, isLoading: permLoading, workspaceId } = usePermissions();
  const { canAccessModule, loading: accessLoading } = useModuleAccess();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const permissionsReady = !permLoading && !accessLoading && !!workspaceId;

  useEffect(() => {
    if (!enabled || !identity || !permissionsReady || typeof window === "undefined") return;
    const connection = (navigator as Navigator & { connection?: ConnectionHint }).connection;
    const plan = planIdlePreload({
      activeModule,
      canAccessModule,
      canAny,
      permissionsReady,
      currentPath: path,
      connection,
    });
    if (!plan.length) return;

    let cancelled = false;
    const idle =
      window.requestIdleCallback ??
      ((cb: () => void) => window.setTimeout(cb, 200) as unknown as number);
    const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout;
    let idleHandle: number | null = null;

    const runNext = async (index: number) => {
      if (cancelled || index >= plan.length) return;
      // Não compete com uma navegação em andamento.
      if (router.state.status === "pending") {
        idleHandle = idle(() => void runNext(index));
        return;
      }
      const l = plan[index];
      try {
        await router.preloadRoute({ to: l.to });
        if (cancelled) return;
        await qc.prefetchQuery({
          queryKey: ["grid-pref", l.gridKey],
          queryFn: () => getGridPreference({ data: { gridKey: l.gridKey } }),
          staleTime: 60_000,
        });
        if (cancelled) return;
        await qc.prefetchQuery({
          queryKey: ["entity-field-catalog", l.entity],
          queryFn: () => getEntityFieldCatalog({ data: { entity: l.entity } }),
          staleTime: 5 * 60_000,
        });
      } catch {
        // Pré-carregamento é oportunista; falha não afeta a tela.
      }
      if (!cancelled) idleHandle = idle(() => void runNext(index + 1));
    };

    const start = window.setTimeout(() => {
      idleHandle = idle(() => void runNext(0));
    }, START_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(start);
      if (idleHandle !== null) cancelIdle(idleHandle);
    };
    // `path` fica fora: trocar de tela não reinicia o ciclo; a tela atual
    // é só excluída do plano inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, identity, permissionsReady, activeModule, workspaceId, router, qc]);
}
