// Filtro reutilizável de "Responsável" — uma linha por pessoa (usuário do workspace
// + responsáveis do HubSpot correspondentes), agrupadas em Ativos e Inativos.
// Use dentro de um <FilterGroup title="Responsável">.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { listWorkspaceMembers } from "@/lib/rotation.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  buildOwnerOptions,
  selectionState,
  type OwnerFilterHubspot,
  type OwnerOption,
} from "@/lib/owner-filter-options";
import { cn } from "@/lib/utils";
import { responsibleOrExpr, type ResponsibleColumns } from "@/lib/entity/responsible";

export type OwnerFilterValue = {
  /** IDs podem ser uuid (usuário do workspace) ou prefixados com "hs:" (hubspot_owner_id). */
  ownerIds: string[];
  includeUnassigned: boolean;
};

export function OwnerFilter({
  value,
  onChange,
}: {
  value: OwnerFilterValue;
  onChange: (next: OwnerFilterValue) => void;
}) {
  const fetchMembers = useServerFn(listWorkspaceMembers);
  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["workspace-members"],
    queryFn: () => fetchMembers(),
    staleTime: 60_000,
  });

  const { data: hsOwners = [], isLoading: loadingHs } = useQuery({
    queryKey: ["owner-filter", "hubspot-owners", "all"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("hubspot_owners")
        .select("id, first_name, last_name, email, status, mapped_user_id");
      return (data ?? []) as OwnerFilterHubspot[];
    },
  });

  const isLoading = loadingMembers || loadingHs;
  const options = useMemo(() => buildOwnerOptions(members, hsOwners), [members, hsOwners]);
  const active = options.filter((o) => o.active);
  const inactive = options.filter((o) => !o.active);

  const toggle = (opt: OwnerOption, checked: boolean) => {
    const set = new Set(value.ownerIds);
    for (const id of opt.ids) {
      if (checked) set.add(id);
      else set.delete(id);
    }
    onChange({ ...value, ownerIds: [...set] });
  };

  return (
    <div className="space-y-0.5">
      <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
        <Checkbox
          checked={value.includeUnassigned}
          onCheckedChange={(v) => onChange({ ...value, includeUnassigned: !!v })}
        />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        <span>Sem responsável</span>
      </label>
      {isLoading ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">Carregando…</p>
      ) : options.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">Nenhum membro</p>
      ) : (
        <>
          <OwnerGroup
            title="Ativos"
            items={active}
            selected={value.ownerIds}
            onToggle={toggle}
            defaultOpen
          />
          <OwnerGroup
            title="Inativos"
            items={inactive}
            selected={value.ownerIds}
            onToggle={toggle}
          />
        </>
      )}
    </div>
  );
}

function OwnerGroup({
  title,
  items,
  selected,
  onToggle,
  defaultOpen = false,
}: {
  title: string;
  items: OwnerOption[];
  selected: string[];
  onToggle: (opt: OwnerOption, checked: boolean) => void;
  defaultOpen?: boolean;
}) {
  const selectedCount = items.filter((o) => selectionState(o.ids, selected) !== false).length;
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (selectedCount > 0) setOpen(true);
  }, [selectedCount]);
  if (items.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronRight
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")}
          aria-hidden="true"
        />
        <span>
          {title} ({items.length})
        </span>
        {selectedCount > 0 && (
          <span className="ml-auto text-primary">· {selectedCount} selecionado(s)</span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5">
        {items.map((opt) => (
          <label
            key={opt.key}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
          >
            <Checkbox
              checked={selectionState(opt.ids, selected)}
              onCheckedChange={(v) => onToggle(opt, v === true)}
            />
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                opt.active ? "bg-primary" : "bg-muted-foreground",
              )}
            />
            <span className={cn("truncate", !opt.active && "text-muted-foreground")}>
              {opt.label}
              {opt.is_me ? " (eu)" : ""}
            </span>
          </label>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Separa os IDs selecionados em owner_id (usuário) e hubspot_owner_id. */
export function splitOwnerIds(ids: string[]): { userIds: string[]; hubspotIds: string[] } {
  const userIds: string[] = [];
  const hubspotIds: string[] = [];
  for (const id of ids) {
    if (id.startsWith("hs:")) hubspotIds.push(id.slice(3));
    else userIds.push(id);
  }
  return { userIds, hubspotIds };
}

/** Constrói cláusula para Supabase com suporte a owner_id e hubspot_owner_id. */
export function applyOwnerFilter<
  T extends {
    in: (...args: unknown[]) => unknown;
    is: (...args: unknown[]) => unknown;
    or: (...args: unknown[]) => unknown;
  },
>(query: T, value: OwnerFilterValue): T {
  const { userIds, hubspotIds } = splitOwnerIds(value.ownerIds);
  const parts: string[] = [];
  if (userIds.length > 0) parts.push(`owner_id.in.(${userIds.join(",")})`);
  if (hubspotIds.length > 0) parts.push(`hubspot_owner_id.in.(${hubspotIds.join(",")})`);
  if (value.includeUnassigned) parts.push(`owner_id.is.null`);
  if (parts.length === 0) return query;
  if (
    parts.length === 1 &&
    value.includeUnassigned &&
    userIds.length === 0 &&
    hubspotIds.length === 0
  ) {
    return query.is("owner_id", null) as T;
  }
  return query.or(parts.join(",")) as T;
}

export const EMPTY_OWNER_FILTER: OwnerFilterValue = { ownerIds: [], includeUnassigned: false };

/** Expressão `or` com colunas de responsável (uuids) + hubspot_owner_id (ids "hs:"). */
export function ownerFilterOrExpr(value: OwnerFilterValue, columns: ResponsibleColumns): string {
  const { userIds, hubspotIds } = splitOwnerIds(value.ownerIds);
  const parts: string[] = [];
  const base = responsibleOrExpr(userIds, { columns, includeUnassigned: value.includeUnassigned });
  if (base) parts.push(base);
  if (hubspotIds.length > 0) parts.push(`hubspot_owner_id.in.(${hubspotIds.join(",")})`);
  return parts.join(",");
}
