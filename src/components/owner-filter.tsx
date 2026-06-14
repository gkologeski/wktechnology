// Filtro reutilizável de "Responsável" — lista checkboxes com todos os membros do workspace
// + responsáveis vindos de integrações (HubSpot) + opção "Sem responsável".
// Use dentro de um <FilterGroup title="Responsável">.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Checkbox } from "@/components/ui/checkbox";
import { listWorkspaceMembers } from "@/lib/rotation.functions";
import { supabase } from "@/integrations/supabase/client";

export type OwnerFilterValue = {
  /** IDs podem ser uuid (usuário do workspace) ou prefixados com "hs:" (hubspot_owner_id). */
  ownerIds: string[];
  includeUnassigned: boolean;
};

type Option = {
  id: string; // já com prefixo quando necessário ("hs:<id>")
  label: string;
  kind: "user" | "hubspot";
  is_me?: boolean;
  archived?: boolean;
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

  // Responsáveis de integrações (ex.: HubSpot) que ainda não estão mapeados para um usuário.
  // Vão aparecer no filtro para permitir filtrar leads que vieram com esse "owner" externo.
  const { data: hsOwners = [], isLoading: loadingHs } = useQuery({
    queryKey: ["owner-filter", "hubspot-owners"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("hubspot_owners")
        .select("id, first_name, last_name, email, status, mapped_user_id")
        .is("mapped_user_id", null);
      return (data ?? []) as Array<{
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        status: string | null;
        mapped_user_id: string | null;
      }>;
    },
  });

  const isLoading = loadingMembers || loadingHs;

  const userOptions: Option[] = members.map((m) => ({
    id: m.user_id,
    label: m.full_name || m.user_id.slice(0, 8),
    kind: "user",
    is_me: m.is_me,
  }));
  const hsOptions: Option[] = hsOwners.map((o) => {
    const full = `${o.first_name ?? ""} ${o.last_name ?? ""}`.trim();
    return {
      id: `hs:${o.id}`,
      label: full || o.email || `HubSpot ${o.id}`,
      kind: "hubspot",
      archived: (o.status ?? "").toLowerCase() === "archived",
    };
  });
  const options: Option[] = [...userOptions, ...hsOptions].sort((a, b) => {
    if (!!a.is_me !== !!b.is_me) return a.is_me ? -1 : 1;
    return a.label.localeCompare(b.label);
  });

  const toggleOwner = (id: string, checked: boolean) => {
    onChange({
      ...value,
      ownerIds: checked
        ? Array.from(new Set([...value.ownerIds, id]))
        : value.ownerIds.filter((x) => x !== id),
    });
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
        options.map((opt) => {
          const checked = value.ownerIds.includes(opt.id);
          return (
            <label
              key={opt.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              <Checkbox checked={checked} onCheckedChange={(v) => toggleOwner(opt.id, !!v)} />
              <span
                className={
                  "h-1.5 w-1.5 rounded-full " +
                  (opt.kind === "hubspot" ? "bg-orange-500" : "bg-primary")
                }
              />
              <span className="truncate">
                {opt.label}
                {opt.is_me ? " (eu)" : ""}
                {opt.archived ? " (arquivado)" : ""}
              </span>
            </label>
          );
        })
      )}
    </div>
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
export function applyOwnerFilter<T extends { in: Function; is: Function; or: Function }>(
  query: T,
  value: OwnerFilterValue,
): T {
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
