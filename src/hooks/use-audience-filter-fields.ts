// Campos de filtro do público de campanhas: fixos + catálogo completo + personalizados.
import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getEntityFieldCatalog } from "@/lib/entity-fields.functions";
import { listCustomProperties } from "@/lib/custom-properties.functions";
import {
  FILTER_FIELDS,
  buildFilterFields,
  type AudienceBase,
  type FilterFieldCatalog,
} from "@/lib/whatsapp/campaign-audience";

const ENTITIES: AudienceBase[] = ["leads", "contacts", "companies", "deals"];

export function useAudienceFilterFields(): { fields: FilterFieldCatalog; isLoading: boolean } {
  const fetchCatalog = useServerFn(getEntityFieldCatalog);
  const fetchCustom = useServerFn(listCustomProperties);
  const catalogs = useQueries({
    queries: ENTITIES.map((entity) => ({
      queryKey: ["entity-field-catalog", entity],
      staleTime: 5 * 60_000,
      queryFn: () => fetchCatalog({ data: { entity } }),
    })),
  });
  const custom = useQuery({
    queryKey: ["custom-properties", "all"],
    staleTime: 5 * 60_000,
    queryFn: () => fetchCustom({ data: {} }),
  });
  const dataKey = catalogs.map((c) => c.dataUpdatedAt).join(",");
  const fields = useMemo(() => {
    const out = {} as FilterFieldCatalog;
    ENTITIES.forEach((e, i) => {
      const cat = catalogs[i]?.data?.fields;
      if (!cat) {
        out[e] = FILTER_FIELDS[e];
        return;
      }
      const cps = (
        (custom.data ?? []) as { entity: string; key: string; label: string; enabled: boolean }[]
      )
        .filter((c) => c.entity === e && c.enabled)
        .map((c) => ({ key: c.key, label: c.label }));
      out[e] = buildFilterFields(e, cat, cps);
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, custom.data]);
  return { fields, isLoading: catalogs.some((c) => c.isLoading) };
}
