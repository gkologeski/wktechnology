// Pré-carrega, com o navegador ocioso, o código das listagens mais pesadas e
// as preferências de grade (colunas/ordenação) e o catálogo de campos delas.
// Assim, ao abrir Contatos, Empresas etc., a tela monta na hora e a lista não
// precisa esperar essas duas consultas em sequência.
import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { getGridPreference } from "@/lib/grid-preferences.functions";
import { getEntityFieldCatalog } from "@/lib/entity-fields.functions";
import type { CatalogEntity } from "@/hooks/use-auto-grid-columns";

const HEAVY_LISTS: { to: string; gridKey: string; entity: CatalogEntity }[] = [
  { to: "/contacts", gridKey: "contacts", entity: "contacts" },
  { to: "/companies", gridKey: "companies", entity: "companies" },
  { to: "/deals", gridKey: "deals", entity: "deals" },
  { to: "/tasks", gridKey: "tasks", entity: "activities" },
];

export function useIdleListPreload(enabled: boolean) {
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const idle =
      window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500) as number);
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => {
      for (const l of HEAVY_LISTS) {
        void router.preloadRoute({ to: l.to }).catch(() => undefined);
        void qc.prefetchQuery({
          queryKey: ["grid-pref", l.gridKey],
          queryFn: () => getGridPreference({ data: { gridKey: l.gridKey } }),
          staleTime: 60_000,
        });
        void qc.prefetchQuery({
          queryKey: ["entity-field-catalog", l.entity],
          queryFn: () => getEntityFieldCatalog({ data: { entity: l.entity } }),
          staleTime: 5 * 60_000,
        });
      }
    });
    return () => cancel(handle);
  }, [enabled, router, qc]);
}
