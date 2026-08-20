// Gera colunas de grid a partir do catálogo dinâmico de campos da entidade,
// permitindo que o usuário escolha qualquer campo da tabela no editor de colunas.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { getEntityFieldCatalog, type EntityFieldDef } from "@/lib/entity-fields.functions";
import { renderAutoCell, isSortableField } from "@/lib/grid/auto-column-render";
import type { GridColumnDef } from "@/hooks/use-grid-columns";

export type CatalogEntity =
  | "leads"
  | "contacts"
  | "companies"
  | "deals"
  | "tickets"
  | "activities"
  | "ats_jobs"
  | "ats_candidates"
  | "ats_applications"
  | "ats_interviews"
  | "projects"
  | "project_tasks"
  | "project_milestones"
  | "contracts"
  | "financial_entries"
  | "bank_payments"
  | "quotes"
  | "proposals"
  | "products"
  | "services"
  | "recurring_plans"
  | "subscription_invoices"
  | "customer_invoices";

type RefKind = NonNullable<EntityFieldDef["ref"]>;

const REF_SOURCE: Record<
  Exclude<RefKind, "user">,
  {
    table: "companies" | "contacts" | "pipelines" | "deals" | "contracts" | "legal_entities";
    select: string;
  }
> = {
  company: { table: "companies", select: "id, name" },
  contact: { table: "contacts", select: "id, first_name, last_name" },
  pipeline: { table: "pipelines", select: "id, name" },
  deal: { table: "deals", select: "id, name" },
  contract: { table: "contracts", select: "id, title" },
  legal_entity: { table: "legal_entities", select: "id, name" },
};

function rowLabel(r: Record<string, unknown>): string {
  const name = (r.name ?? r.title) as string | undefined;
  if (name) return name;
  const full = `${(r.first_name as string) ?? ""} ${(r.last_name as string) ?? ""}`.trim();
  return full;
}

/** Mapa id → nome para os tipos de referência realmente usados nas colunas visíveis. */
function useRefMaps(kinds: RefKind[]) {
  const needed = Array.from(new Set(kinds)).filter(
    (k): k is Exclude<RefKind, "user"> => k !== "user",
  );
  const key = needed.slice().sort().join(",");

  const query = useQuery({
    queryKey: ["auto-grid-ref-maps", key],
    enabled: needed.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const out: Partial<Record<RefKind, Map<string, string>>> = {};
      await Promise.all(
        needed.map(async (kind) => {
          const src = REF_SOURCE[kind];
          const { data, error } = await supabase.from(src.table).select(src.select).limit(1000);
          if (error) throw error;
          const map = new Map<string, string>();
          for (const r of (data ?? []) as unknown as Record<string, unknown>[]) {
            const id = r.id as string | undefined;
            if (!id) continue;
            const label = rowLabel(r);
            if (label) map.set(id, label);
          }
          out[kind] = map;
        }),
      );
      return out;
    },
  });

  return query.data ?? {};
}

export function useAutoGridColumns<T extends object>({
  entity,
  exclude,
}: {
  entity?: CatalogEntity;
  /** Chaves já declaradas manualmente na tela (não são duplicadas). */
  exclude: string[];
}): { columns: GridColumnDef<T>[]; fieldByKey: Map<string, EntityFieldDef> } {
  const fetchCatalog = useServerFn(getEntityFieldCatalog);
  const { nameFor } = useWorkspaceMembers();

  const catalog = useQuery({
    queryKey: ["entity-field-catalog", entity],
    enabled: !!entity,
    staleTime: 5 * 60_000,
    queryFn: () => fetchCatalog({ data: { entity: entity! } }),
  });

  const excluded = useMemo(() => new Set(exclude), [exclude]);

  const fields = useMemo(
    () => (catalog.data?.fields ?? []).filter((f) => !excluded.has(f.name)),
    [catalog.data, excluded],
  );

  const refMaps = useRefMaps(fields.filter((f) => !!f.ref).map((f) => f.ref!));

  const refLabel = useMemo(
    () => (kind: RefKind, id: string) => {
      if (kind === "user") return nameFor(id) || null;
      return refMaps[kind]?.get(id) ?? null;
    },
    [nameFor, refMaps],
  );

  const columns = useMemo<GridColumnDef<T>[]>(
    () =>
      fields.map((f) => ({
        key: f.name,
        label: f.label,
        group: "Outros campos",
        sortable: isSortableField(f),
        render: (row: T) => renderAutoCell(f, row as Record<string, unknown>, refLabel),
      })),
    [fields, refLabel],
  );

  const fieldByKey = useMemo(() => new Map(fields.map((f) => [f.name, f])), [fields]);

  return { columns, fieldByKey };
}
