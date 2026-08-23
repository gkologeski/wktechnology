import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Can } from "@/lib/access-control/use-permissions";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import type { Contact, Company } from "@/lib/db-types";
import { useGridColumns, type GridColumnDef } from "@/hooks/use-grid-columns";
import { useGridProjection } from "@/hooks/use-grid-projection";
import { buildGridSelect } from "@/lib/grid/dynamic-select";
import { cn } from "@/lib/utils";
import { toE164 } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  Download,
  Link2,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { BulkEditFieldsDialog } from "@/components/grid/bulk-edit-fields-dialog";
import { startFocusQueue } from "@/lib/focus-queue";
import { BulkEnrichDialog } from "@/components/enrichment/bulk-enrich-dialog";

import { useMyTools } from "@/lib/use-my-tools";
import { CreateContactDialog } from "@/components/contacts/create-contact-dialog";
import { useAutoCreateParam } from "@/hooks/use-auto-create-param";
import { OwnerFilter, splitOwnerIds, type OwnerFilterValue } from "@/components/owner-filter";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";

import { getDateRange, type CustomRange, type DatePreset } from "@/lib/date-presets";
import { DateFilter } from "@/components/date-filter";

import {
  CheckboxFilter,
  FilterGroup,
  FiltersSidebar,
  HeaderCheckbox,
  InitialsAvatar,
  Pagination,
  Pill,
  RadioFilter,
  Td,
  Th,
  TONES,
  ViewsTabs,
  timeAgo,
  type SortDir,
} from "@/components/crm/hubspot-shell";
import { formatDateTime } from "@/lib/crm";
import { exportRowsToCsv } from "@/lib/csv-export";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { deniedIfUnaffected } from "@/lib/access-control/rls-denied";

export const Route = createFileRoute("/_authenticated/contacts")({
  component: ContactsPage,
});

const LIFECYCLE_STAGES = [
  { value: "subscriber", label: "Assinante", tone: "slate" as const },
  { value: "lead", label: "Lead", tone: "sky" as const },
  { value: "marketingqualifiedlead", label: "MQL", tone: "violet" as const },
  { value: "salesqualifiedlead", label: "SQL", tone: "indigo" as const },
  { value: "opportunity", label: "Oportunidade", tone: "amber" as const },
  { value: "customer", label: "Cliente", tone: "emerald" as const },
  { value: "evangelist", label: "Evangelizador", tone: "fuchsia" as const },
  { value: "other", label: "Outro", tone: "slate" as const },
];

type ViewId = "all" | "mine" | "unassigned" | "new_week";
const VIEWS = [
  { id: "all" as const, label: "Todos os contatos" },
  { id: "mine" as const, label: "Meus contatos" },
  { id: "unassigned" as const, label: "Sem responsável" },
  { id: "new_week" as const, label: "Criados esta semana" },
];

type SortKey = string;
const DECLARED_SORT_KEYS = ["first_name", "created_at", "updated_at"] as const;

/**
 * Colunas sempre necessárias no grid de contatos (células, filtros, seleção em
 * massa e ações de linha). As colunas escolhidas no editor entram por cima,
 * validadas contra o catálogo real da entidade.
 */
const BASE_CONTACT_KEYS = [
  "id",
  "first_name",
  "last_name",
  "email",
  "phone",
  "mobile_phone",
  "job_title",
  "company_id",
  "company_name",
  "lifecyclestage",
  "owner_id",
  "assigned_to",
  "assigned_user_id",
  "hubspot_owner_id",
  "created_at",
  "updated_at",
] as const;

type Filters = {
  lifecycle: string[];
  companyIds: string[];
  createdPreset: DatePreset;
  createdCustom: CustomRange;
  ownerIds: string[];
  includeUnassigned: boolean;
};
const DEFAULT_FILTERS: Filters = {
  lifecycle: [],
  companyIds: [],
  createdPreset: "any",
  createdCustom: {},
  ownerIds: [],
  includeUnassigned: false,
};

function ContactsPage() {
  const location = useLocation();
  if (location.pathname !== "/contacts") return <Outlet />;
  return <ContactsHubspotView />;
}

function ContactsHubspotView() {
  const { user } = useAuth();
  const { can } = useMyTools();
  const { nameFor, initialsFor } = useWorkspaceMembers();

  const qc = useQueryClient();
  useRealtimeInvalidate([{ table: "contacts", queryKeys: [["contacts"]] }]);
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState<ViewId>("all");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const projection = useGridProjection({
    gridKey: "contacts",
    entity: "contacts",
    declaredSortKeys: DECLARED_SORT_KEYS,
  });
  // Reaplica a ordenação salva do usuário na primeira carga da preferência.
  const sortHydrated = useRef(false);
  useEffect(() => {
    if (sortHydrated.current || !projection.sortKey) return;
    sortHydrated.current = true;
    setSortKey(projection.sortKey);
    setSortDir(projection.sortDir ?? "asc");
  }, [projection.sortKey, projection.sortDir]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [enrichIds, setEnrichIds] = useState<string[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  useAutoCreateParam(() => setCreateOpen(true));

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    setPage(0);
  }, [activeView, filters, debouncedSearch, sortKey, sortDir, pageSize]);

  const { data: companies = [] } = useQuery({
    queryKey: ["companies", "select"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id,name").order("name");
      return (data ?? []) as Pick<Company, "id" | "name">[];
    },
  });
  const companyMap = new Map(companies.map((c) => [c.id, c.name]));

  const {
    data: result,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      "contacts",
      "hubspot-list",
      activeView,
      filters,
      sortKey,
      sortDir,
      debouncedSearch,
      page,
      pageSize,
      user?.id,
      projection.selectSignature,
      projection.needsCustomFields,
    ],
    enabled: !projection.isLoading,
    queryFn: async () => {
      let q = supabase.from("contacts").select(
        // Projeção sob demanda: colunas base + colunas visíveis do catálogo.
        buildGridSelect(BASE_CONTACT_KEYS, projection.selectKeys, {
          customFields: projection.needsCustomFields,
          allowed: projection.knownColumns,
        }),
        { count: "exact" },
      );

      if (activeView === "mine" && user?.id) {
        q = q.or(
          `assigned_user_id.eq.${user.id},and(assigned_user_id.is.null,owner_id.eq.${user.id})`,
        );
      }
      if (activeView === "unassigned") q = q.is("assigned_user_id", null).is("owner_id", null);
      if (activeView === "new_week") {
        const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
        q = q.gte("created_at", since);
      }
      if (filters.lifecycle.length) q = q.in("lifecyclestage", filters.lifecycle);
      if (filters.companyIds.length) q = q.in("company_id", filters.companyIds);
      if (filters.createdPreset !== "any") {
        const { start, end } = getDateRange(
          filters.createdPreset,
          new Date(),
          filters.createdCustom,
        );
        if (start) q = q.gte("created_at", start.toISOString());
        if (end) q = q.lt("created_at", end.toISOString());
      }

      const { userIds, hubspotIds } = splitOwnerIds(filters.ownerIds);
      const ownerClauses: string[] = [];
      if (userIds.length > 0) {
        ownerClauses.push(`assigned_user_id.in.(${userIds.join(",")})`);
        ownerClauses.push(`and(assigned_user_id.is.null,owner_id.in.(${userIds.join(",")}))`);
      }
      if (hubspotIds.length > 0) ownerClauses.push(`hubspot_owner_id.in.(${hubspotIds.join(",")})`);
      if (filters.includeUnassigned) ownerClauses.push("assigned_user_id.is.null,owner_id.is.null");
      if (ownerClauses.length > 0) {
        q = q.or(ownerClauses.join(","));
      }

      const term = debouncedSearch.trim().replace(/[,()]/g, " ").trim();
      if (term) {
        // Suporta múltiplas palavras: cada token precisa casar com algum dos
        // campos (AND entre tokens, OR entre campos).
        const tokens = term.split(/\s+/).filter(Boolean);
        for (const tk of tokens) {
          q = q.or(
            [
              `first_name.ilike.%${tk}%`,
              `last_name.ilike.%${tk}%`,
              `email.ilike.%${tk}%`,
              `phone.ilike.%${tk}%`,
            ].join(","),
          );
        }
      }

      q = q.order(sortKey, { ascending: sortDir === "asc" });
      q = q.range(page * pageSize, page * pageSize + pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as Contact[], count: count ?? 0 };
    },
  });

  const rows = result?.rows ?? [];
  const total = result?.count ?? 0;
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const someSelected = rows.some((r) => selectedIds.has(r.id));

  const exportCsv = () => {
    if (!rows.length) return toast.error("Nenhum registro para exportar");
    exportRowsToCsv("contatos", rows as unknown as Record<string, unknown>[], [
      { key: "first_name", label: "Nome" },
      { key: "last_name", label: "Sobrenome" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Telefone" },
      { key: "job_title", label: "Cargo" },
      { key: "lifecycle_stage", label: "Estágio" },
      { key: "created_at", label: "Criado em" },
      { key: "updated_at", label: "Atualizado em" },
    ]);
  };

  const toggleAll = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) for (const r of rows) next.delete(r.id);
      else for (const r of rows) next.add(r.id);
      return next;
    });
  const toggleOne = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSelection = () => setSelectedIds(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);

  const onSort = (k: SortKey) => {
    const nextDir: SortDir = sortKey === k ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    setSortKey(k);
    setSortDir(nextDir);
    persistSort(k, nextDir);
  };

  /** Cabeçalho ordenável para as colunas do catálogo dinâmico ("Outros campos"). */
  const autoSortHeader = useCallback(
    (col: { key: string; label: string }) => (
      <Th sortable active={sortKey === col.key} dir={sortDir} onClick={() => onSort(col.key)}>
        {col.label}
      </Th>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortKey, sortDir],
  );

  // ----- Columns ----------------------------------------------------------
  type ContactRow = (typeof rows)[number];
  const contactColumns = useMemo<GridColumnDef<ContactRow>[]>(
    () => [
      {
        key: "name",
        label: "Nome",
        header: (
          <Th
            sortable
            active={sortKey === "first_name"}
            dir={sortDir}
            onClick={() => onSort("first_name")}
          >
            Nome
          </Th>
        ),
        render: (c) => {
          const full = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Sem nome";
          const initials = ((c.first_name ?? "")[0] ?? "") + ((c.last_name ?? "")[0] ?? "");
          return (
            <div className="flex items-center gap-2.5">
              <InitialsAvatar text={initials.toUpperCase() || "?"} seed={c.id} />
              <Link
                to="/contacts/$id"
                params={{ id: c.id }}
                className="truncate font-medium text-primary hover:underline"
              >
                {full}
              </Link>
            </div>
          );
        },
      },
      {
        key: "email",
        label: "E-mail",
        className: "text-muted-foreground",
        render: (c) => (c.email ? <span className="truncate">{c.email}</span> : "—"),
      },
      {
        key: "phone",
        label: "Telefone",
        className: "text-muted-foreground",
        render: (c) => {
          const raw = c.phone ?? c.mobile_phone;
          return raw ? (toE164(raw) ?? raw) : "—";
        },
      },
      {
        key: "job_title",
        label: "Cargo",
        className: "text-muted-foreground",
        render: (c) => c.job_title ?? "—",
      },
      {
        key: "company",
        label: "Empresa",
        render: (c) =>
          c.company_id ? (
            <span className="truncate">{companyMap.get(c.company_id) ?? "—"}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "lifecycle",
        label: "Etapa do ciclo",
        render: (c) => {
          const stage = LIFECYCLE_STAGES.find((s) => s.value === c.lifecyclestage);
          return stage ? (
            <Pill tone={stage.tone} label={stage.label} />
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        key: "owner",
        label: "Responsável",
        render: (c) => {
          const responsibleId = c.assigned_user_id ?? c.owner_id;
          return responsibleId ? (
            <div className="flex items-center gap-2" title={nameFor(responsibleId)}>
              <InitialsAvatar text={initialsFor(responsibleId)} seed={responsibleId} size={6} />
              <span className="truncate text-sm">{nameFor(responsibleId)}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        key: "updated_at",
        label: "Última atividade",
        className: "text-muted-foreground",
        header: (
          <Th
            sortable
            active={sortKey === "updated_at"}
            dir={sortDir}
            onClick={() => onSort("updated_at")}
          >
            Última atividade
          </Th>
        ),
        render: (c) => timeAgo(c.updated_at),
      },
      {
        key: "created_at",
        label: "Criado em",
        className: "text-muted-foreground",
        header: (
          <Th
            sortable
            active={sortKey === "created_at"}
            dir={sortDir}
            onClick={() => onSort("created_at")}
          >
            Criado em
          </Th>
        ),
        render: (c) => formatDateTime(c.created_at),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortKey, sortDir, nameFor, initialsFor, companyMap],
  );
  const DEFAULT_CONTACT_COLS = [
    "name",
    "email",
    "phone",
    "company",
    "lifecycle",
    "owner",
    "created_at",
  ];
  const {
    columns: visibleColumns,
    ColumnsButton,
    ColumnsEditor,
    persistSort,
  } = useGridColumns<ContactRow>({
    gridKey: "contacts",
    columns: contactColumns,
    defaults: DEFAULT_CONTACT_COLS,
    customEntity: "contacts",
    catalogEntity: "contacts",
    sortHeader: autoSortHeader,
  });

  const hasActiveFilters =
    filters.lifecycle.length > 0 ||
    filters.companyIds.length > 0 ||
    filters.createdPreset !== "any";

  const removeOne = async (id: string) => {
    if (!(await confirmDialog("Excluir este contato?"))) return;
    const { data: affected, error } = await supabase
      .from("contacts")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) return toast.error(error.message);
    if (deniedIfUnaffected(affected)) return;
    toast.success("Removido");
    qc.invalidateQueries({ queryKey: ["contacts"] });
  };
  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!(await confirmDialog(`Excluir ${ids.length} contato(s)?`))) return;
    const { data: affected, error } = await supabase
      .from("contacts")
      .delete()
      .in("id", ids)
      .select("id");
    if (error) return toast.error(error.message);
    if (deniedIfUnaffected(affected)) return;
    if (affected.length < ids.length) {
      toast.warning(`${affected.length} de ${ids.length} excluído(s). Verifique suas permissões.`);
    } else {
      toast.success(`${ids.length} excluído(s)`);
    }

    clearSelection();
    qc.invalidateQueries({ queryKey: ["contacts"] });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contatos</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Carregando…" : `${total.toLocaleString("pt-BR")} registros`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                let q = supabase.from("contacts").select("id");
                if (activeView === "mine" && user?.id) {
                  q = q.or(
                    `assigned_user_id.eq.${user.id},and(assigned_user_id.is.null,owner_id.eq.${user.id})`,
                  );
                }
                if (activeView === "unassigned")
                  q = q.is("assigned_user_id", null).is("owner_id", null);
                if (activeView === "new_week") {
                  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
                  q = q.gte("created_at", since);
                }
                if (filters.lifecycle.length) q = q.in("lifecyclestage", filters.lifecycle);
                if (filters.companyIds.length) q = q.in("company_id", filters.companyIds);
                if (filters.createdPreset !== "any") {
                  const { start, end } = getDateRange(
                    filters.createdPreset,
                    new Date(),
                    filters.createdCustom,
                  );
                  if (start) q = q.gte("created_at", start.toISOString());
                  if (end) q = q.lt("created_at", end.toISOString());
                }
                const { userIds, hubspotIds } = splitOwnerIds(filters.ownerIds);
                const ownerClauses: string[] = [];
                if (userIds.length > 0) {
                  ownerClauses.push(`assigned_user_id.in.(${userIds.join(",")})`);
                  ownerClauses.push(
                    `and(assigned_user_id.is.null,owner_id.in.(${userIds.join(",")}))`,
                  );
                }
                if (hubspotIds.length > 0)
                  ownerClauses.push(`hubspot_owner_id.in.(${hubspotIds.join(",")})`);
                if (filters.includeUnassigned)
                  ownerClauses.push("assigned_user_id.is.null,owner_id.is.null");
                if (ownerClauses.length > 0) q = q.or(ownerClauses.join(","));
                const term = debouncedSearch.trim().replace(/[,()]/g, " ").trim();
                if (term) {
                  for (const tk of term.split(/\s+/).filter(Boolean)) {
                    q = q.or(
                      [
                        `first_name.ilike.%${tk}%`,
                        `last_name.ilike.%${tk}%`,
                        `email.ilike.%${tk}%`,
                        `phone.ilike.%${tk}%`,
                      ].join(","),
                    );
                  }
                }
                q = q.order(sortKey, { ascending: sortDir === "asc" }).limit(5000);
                const { data, error } = await q;
                if (error) throw error;
                const ids = (data ?? []).map((r) => r.id as string);
                if (!ids.length) return toast.error("Nenhum contato para percorrer.");
                startFocusQueue(
                  "contacts",
                  ids,
                  `Contatos · ${ids.length.toLocaleString("pt-BR")}`,
                );
                toast.success(`Fila iniciada com ${ids.length} contato(s)`);
                navigate({ to: "/contacts/$id", params: { id: ids[0] } });
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
            disabled={isLoading || total === 0}
            title="Percorrer todos os contatos do filtro atual, um a um"
          >
            <Play className="mr-1.5 h-4 w-4" /> Iniciar fila
          </Button>
          {can("export") && (
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-1.5 h-4 w-4" /> Exportar
            </Button>
          )}
          <Can permission="techsales.contacts.create.own">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Criar contato
            </Button>
          </Can>
        </div>
      </div>

      <ViewsTabs views={VIEWS} active={activeView} onChange={setActiveView} />

      <div className="flex min-h-0 flex-1">
        <FiltersSidebar
          hasActiveFilters={hasActiveFilters}
          onClear={() => setFilters(DEFAULT_FILTERS)}
        >
          <FilterGroup title="Etapa do ciclo" defaultOpen>
            {LIFECYCLE_STAGES.map((s) => (
              <CheckboxFilter
                key={s.value}
                label={s.label}
                dotClass={TONES[s.tone]?.dot}
                checked={filters.lifecycle.includes(s.value)}
                onChange={(v) =>
                  setFilters((f) => ({
                    ...f,
                    lifecycle: v
                      ? [...f.lifecycle, s.value]
                      : f.lifecycle.filter((x) => x !== s.value),
                  }))
                }
              />
            ))}
          </FilterGroup>

          <FilterGroup title="Responsável" defaultOpen>
            <OwnerFilter
              value={{ ownerIds: filters.ownerIds, includeUnassigned: filters.includeUnassigned }}
              onChange={(v: OwnerFilterValue) =>
                setFilters((f) => ({
                  ...f,
                  ownerIds: v.ownerIds,
                  includeUnassigned: v.includeUnassigned,
                }))
              }
            />
          </FilterGroup>

          <FilterGroup title="Empresa">
            {companies.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">Sem empresas</p>
            ) : (
              companies.slice(0, 30).map((c) => (
                <CheckboxFilter
                  key={c.id}
                  label={c.name}
                  checked={filters.companyIds.includes(c.id)}
                  onChange={(v) =>
                    setFilters((f) => ({
                      ...f,
                      companyIds: v
                        ? [...f.companyIds, c.id]
                        : f.companyIds.filter((x) => x !== c.id),
                    }))
                  }
                />
              ))
            )}
          </FilterGroup>

          <FilterGroup title="Data de criação">
            <DateFilter
              name="contacts-created"
              value={filters.createdPreset}
              custom={filters.createdCustom}
              onChange={({ value, custom }) =>
                setFilters((f) => ({ ...f, createdPreset: value, createdCustom: custom }))
              }
            />
          </FilterGroup>
        </FiltersSidebar>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nome, email, telefone…"
                className="h-9 pl-8"
              />
            </div>

            {selectedIds.size > 0 ? (
              <div className="flex items-center gap-2 rounded-md border bg-primary/5 px-2 py-1">
                <span className="text-xs font-medium text-primary">
                  {selectedIds.size} selecionado(s)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    const ids = Array.from(selectedIds);
                    if (!ids.length) return;
                    startFocusQueue(
                      "contacts",
                      ids,
                      `Contatos · ${ids.length.toLocaleString("pt-BR")}`,
                    );
                    toast.success(`Fila iniciada com ${ids.length} contato(s)`);
                    navigate({ to: "/contacts/$id", params: { id: ids[0] } });
                  }}
                >
                  <Play className="mr-1 h-3.5 w-3.5" /> Iniciar fila
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => setEnrichIds(Array.from(selectedIds))}
                >
                  <Sparkles className="mr-1 h-3.5 w-3.5" /> Enriquecer
                </Button>
                <Can any={["techsales.contacts.delete.workspace", "techsales.contacts.delete.own"]}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-destructive hover:text-destructive"
                    onClick={bulkDelete}
                  >
                    Excluir
                  </Button>
                </Can>

                <Can permission="techsales.contacts.update.workspace">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    onClick={() => setBulkEditOpen(true)}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Editar em massa
                  </Button>
                </Can>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearSelection}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <ColumnsButton />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!user?.id}
                  onClick={async () => {
                    if (!user?.id) return;
                    const t = toast.loading("Vinculando contatos por domínio…");
                    const { data, error } = await supabase.rpc("link_contacts_by_email_domain", {
                      p_workspace: user.id,
                    });
                    toast.dismiss(t);
                    if (error) {
                      toast.error(error.message);
                      return;
                    }
                    const n = Number(data ?? 0);
                    toast.success(
                      n === 0
                        ? "Nenhum contato novo foi vinculado"
                        : `${n} contato${n === 1 ? "" : "s"} vinculado${n === 1 ? "" : "s"} à empresa pelo domínio`,
                    );
                    if (n > 0) qc.invalidateQueries({ queryKey: ["contacts"] });
                  }}
                >
                  <Link2 className="mr-1 h-3.5 w-3.5" /> Vincular por domínio
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Ações <ChevronDown className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={exportCsv}>Exportar CSV</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="w-10 border-b px-3 py-2.5">
                    <HeaderCheckbox
                      allSelected={allSelected}
                      someSelected={someSelected}
                      onToggle={toggleAll}
                    />
                  </th>
                  {visibleColumns.map(
                    (col) =>
                      col.header ?? (
                        <Th key={col.key} className={col.headerClassName}>
                          {col.label}
                        </Th>
                      ),
                  )}
                  <th className="w-10 border-b px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={visibleColumns.length + 2}
                      className="px-3 py-16 text-center text-sm text-muted-foreground"
                    >
                      Carregando contatos…
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td
                      colSpan={visibleColumns.length + 2}
                      className="px-3 py-16 text-center text-sm"
                    >
                      <p className="text-muted-foreground">
                        Não foi possível carregar os contatos.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => void refetch()}
                      >
                        Tentar novamente
                      </Button>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={visibleColumns.length + 2}
                      className="px-3 py-16 text-center text-sm text-muted-foreground"
                    >
                      Nenhum contato encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  rows.map((c) => {
                    const checked = selectedIds.has(c.id);
                    return (
                      <tr
                        key={c.id}
                        className={cn(
                          "group h-12 border-b transition-colors hover:bg-primary/5",
                          checked && "bg-primary/5",
                        )}
                      >
                        <Td className="w-10">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleOne(c.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </Td>
                        {visibleColumns.map((col) => (
                          <Td key={col.key} className={col.className}>
                            {col.render(c)}
                          </Td>
                        ))}
                        <Td className="w-10">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  navigate({ to: "/contacts/$id", params: { id: c.id } })
                                }
                              >
                                Abrir
                              </DropdownMenuItem>
                              <Can permission="techsales.contacts.delete.workspace">
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => removeOne(c.id)}
                                >
                                  Excluir
                                </DropdownMenuItem>
                              </Can>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </Td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            setPage={setPage}
            setPageSize={setPageSize}
          />
        </div>

        <ColumnsEditor />
      </div>

      <BulkEditFieldsDialog
        open={bulkEditOpen}
        setOpen={setBulkEditOpen}
        entity="contacts"
        ids={Array.from(selectedIds)}
        entityLabel="contato(s)"
        onDone={() => {
          clearSelection();
          qc.invalidateQueries({ queryKey: ["contacts"] });
        }}
      />

      <BulkEnrichDialog
        open={!!enrichIds}
        onOpenChange={(o) => !o && setEnrichIds(null)}
        ids={enrichIds ?? []}
        entity="contact"
        onDone={() => qc.invalidateQueries({ queryKey: ["contacts"] })}
      />

      <CreateContactDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ["contacts"] })}
      />
    </div>
  );
}
