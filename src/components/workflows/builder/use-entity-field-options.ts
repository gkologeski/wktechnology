import type { FieldOpt } from "./step-tree";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getEntityFieldCatalog } from "@/lib/entity-fields.functions";
import { ENTITY_FIELDS, type WorkflowEntity } from "@/lib/workflows/types";

export function useEntityFieldOptions(entity: WorkflowEntity): FieldOpt[] {
  const fetchCatalog = useServerFn(getEntityFieldCatalog);
  const { data } = useQuery({
    queryKey: ["wf-entity-fields", entity],
    queryFn: () => fetchCatalog({ data: { entity } }),
    staleTime: 5 * 60_000,
  });
  if (data?.fields?.length) {
    return data.fields.map((f) => ({
      name: f.name,
      label: f.label,
      type: f.type,
      options: f.options,
      ref: (f as { ref?: FieldOpt["ref"] }).ref,
      system: (f as { system?: boolean }).system,
    }));
  }
  // Fallback: usa constantes locais enquanto o catálogo carrega.
  return (ENTITY_FIELDS[entity] ?? []).map((n) => ({ name: n, label: n }));
}
