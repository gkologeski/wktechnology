import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Can } from "@/lib/access-control/use-permissions";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { deleteRowGuarded, deleteRowsGuarded, partialDeleteMessage } from "@/lib/delete-guard";
import type { Company } from "@/lib/db-types";
import { useGridColumns, type GridColumnDef } from "@/hooks/use-grid-columns";
import { useGridProjection } from "@/hooks/use-grid-projection";
import { buildGridSelect } from "@/lib/grid/dynamic-select";
import { cn } from "@/lib/utils";
import { toE164 } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { BulkEditFieldsDialog } from "@/components/grid/bulk-edit-fields-dialog";
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
  MapPin,
  MoreHorizontal,
  Play,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { startFocusQueue } from "@/lib/focus-queue";
import { enrichCompaniesAddress } from "@/lib/integrations/viacep.functions";
import { ConfirmCountDialog } from "@/components/confirm-count-dialog";
import { QuickCreateCompanyDialog } from "@/components/record/quick-create-dialogs";
import { useAutoCreateParam } from "@/hooks/use-auto-create-param";
import { exportRowsToCsv } from "@/lib/csv-export";
import { OwnerFilter, type OwnerFilterValue } from "@/components/owner-filter";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";

import { getDateRange, type CustomRange, type DatePreset } from "@/lib/date-presets";
import { DateFilter } from "@/components/date-filter";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { translateFieldValue } from "@/lib/i18n/hubspot-values";
import {
  RESPONSIBLE_COLUMNS_FULL,
  responsibleId,
  responsibleOrExpr,
} from "@/lib/entity/responsible";

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
  ViewsTabs,
  timeAgo,
  type SortDir,
} from "@/components/crm/hubspot-shell";

export const Route = createFileRoute("/_authenticated/companies")({
  component: CompaniesPage,
});

type ViewId = "all" | "mine" | "unassigned" | "new_week";
const VIEWS = [
  { id: "all" as const, label: "Todas as empresas" },
  { id: "mine" as const, label: "Minhas empresas" },
  { id: "unassigned" as const, label: "Sem responsável" },
  { id: "new_week" as const, label: "Criadas esta semana" },
];

type SortKey = string;
const DECLARED_SORT_KEYS = ["name", "created_at", "updated_at"] as const;

/** Colunas sempre necessárias no grid de empresas (células, filtros e ações). */
const BASE_COMPANY_KEYS = [
  "id",
  "name",
  "domain",
  "website",
  "industry",
  "size",
  "city",
  "state",
  "country",
  "phone",
  "cnpj",
  "is_target_account",
  "target_account_tier",
  "owner_id",
  "assigned_to",
  "assigned_user_id",
  "hubspot_owner_id",
  "created_at",
  "updated_at",
] as const;

type Filters = {
  industry: string[];
  size: string[];
  state: string[];
  createdPreset: DatePreset;
  createdCustom: CustomRange;
  targetOnly: boolean;
  ownerIds: string[];
  includeUnassigned: boolean;
};
const DEFAULT_FILTERS: Filters = {
  industry: [],
  size: [],
  state: [],
  createdPreset: "any",
  createdCustom: {},
  targetOnly: false,
  ownerIds: [],
  includeUnassigned: false,
};

function CompaniesPage() {
  const location = useLocation();
  if (location.pathname !== "/companies") return <Outlet />;
  return <CompaniesHubspotView />;
}

function CompaniesHubspotView() {
  const { user } = useAuth();
  const { nameFor, initialsFor } = useWorkspaceMembers();

  const qc = useQueryClient();
  useRealtimeInvalidate([{ table: "companies", queryKeys: [["companies"]] }]);
  const navigate = useNavigate();
  const enrichCeps = useServerFn(enrichCompaniesAddress);

  const [activeView, setActiveView] = useState<ViewId>("all");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const projection = useGridProjection({
    gridKey: "companies",
    entity: "companies",
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
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  useAutoCreateParam(() => setCreateOpen(true));

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    setPage(0);
  }, [activeView, filters, debouncedSearch, sortKey, sortDir, pageSize]);

  const { data: facets } = useQuery({
    queryKey: ["companies", "facets"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("companies_facets", {
        p_limit: 50,
      });
      if (error) throw error;
      const pick = (f: "industry" | "size" | "state") =>
        (data ?? [])
          .filter((r: { facet: string }) => r.facet === f)
          .map((r: { value: string; count: number }) => ({
            value: r.value,
            count: Number(r.count),
          }))
          .slice(0, 15);
      return {
        industry: pick("industry"),
        size: pick("size"),
        state: pick("state"),
      };
    },
  });

  const {
    data: result,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      "companies",
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
      let q = supabase.from("companies").select(
        // Projeção sob demanda: colunas base + colunas visíveis do catálogo.
        buildGridSelect(BASE_COMPANY_KEYS, projection.selectKeys, {
          customFields: projection.needsCustomFields,
          allowed: projection.knownColumns,
        }),
        { count: "exact" },
      );

      if (activeView === "mine" && user?.id)
        q = q.or(responsibleOrExpr([user.id], { columns: RESPONSIBLE_COLUMNS_FULL }));
      if (activeView === "unassigned")
        q = q.or(
          responsibleOrExpr([], { columns: RESPONSIBLE_COLUMNS_FULL, includeUnassigned: true }),
        );
      if (activeView === "new_week") {
        const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
        q = q.gte("created_at", since);
      }
      if (filters.industry.length) q = q.in("industry", filters.industry);
      if (filters.size.length) q = q.in("size", filters.size);
      if (filters.state.length) q = q.in("state", filters.state);
      if (filters.targetOnly) q = q.eq("is_target_account", true);
      if (filters.createdPreset !== "any") {
        const { start, end } = getDateRange(
          filters.createdPreset,
          new Date(),
          filters.createdCustom,
        );
        if (start) q = q.gte("created_at", start.toISOString());
        if (end) q = q.lt("created_at", end.toISOString());
      }

      if (filters.ownerIds.length > 0 && filters.includeUnassigned) {
        q = q.or(
          responsibleOrExpr(filters.ownerIds, {
            columns: RESPONSIBLE_COLUMNS_FULL,
            includeUnassigned: true,
          }),
        );
      } else if (filters.ownerIds.length > 0) {
        q = q.or(responsibleOrExpr(filters.ownerIds, { columns: RESPONSIBLE_COLUMNS_FULL }));
      } else if (filters.includeUnassigned) {
        q = q.or(
          responsibleOrExpr([], { columns: RESPONSIBLE_COLUMNS_FULL, includeUnassigned: true }),
        );
      }

      const term = debouncedSearch.trim().replace(/[,()]/g, " ").trim();
      if (term) {
        q = q.or(
          [`name.ilike.%${term}%`, `domain.ilike.%${term}%`, `website.ilike.%${term}%`].join(","),
        );
      }

      q = q.order(sortKey, { ascending: sortDir === "asc" });
      q = q.range(page * pageSize, page * pageSize + pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as Company[], count: count ?? 0 };
    },
  });

  const rows = result?.rows ?? [];
  const total = result?.count ?? 0;
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const someSelected = rows.some((r) => selectedIds.has(r.id));

  const exportCsv = () => {
    if (!rows.length) return toast.error("Nenhum registro para exportar");
    exportRowsToCsv("empresas", rows as unknown as Record<string, unknown>[], [
      { key: "name", label: "Nome" },
      { key: "domain", label: "Domínio" },
      { key: "industry", label: "Setor" },
      { key: "phone", label: "Telefone" },
      { key: "city", label: "Cidade" },
      { key: "state", label: "Estado" },
      { key: "country", label: "País" },
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
  type CompanyRow = (typeof rows)[number];
  const companyColumns = useMemo<GridColumnDef<CompanyRow>[]>(
    () => [
      {
        key: "name",
        label: "Nome",
        header: (
          <Th sortable active={sortKey === "name"} dir={sortDir} onClick={() => onSort("name")}>
            Nome
          </Th>
        ),
        render: (c) => {
          const initials = (c.name ?? "?").slice(0, 2).toUpperCase();
          return (
            <div className="flex items-center gap-2.5">
              <InitialsAvatar text={initials} seed={c.id} />
              <Link
                to="/companies/$id"
                params={{ id: c.id }}
                className="truncate font-medium text-primary hover:underline"
              >
                {c.name}
              </Link>
            </div>
          );
        },
      },
      {
        key: "domain",
        label: "Domínio",
        className: "text-muted-foreground",
        render: (c) => c.domain ?? "—",
      },
      {
        key: "industry",
        label: "Setor",
        className: "text-muted-foreground",
        render: (c) => translateFieldValue("industry", c.industry) || "—",
      },
      {
        key: "size",
        label: "Porte",
        className: "text-muted-foreground",
        render: (c) => c.size ?? "—",
      },
      {
        key: "city",
        label: "Cidade",
        className: "text-muted-foreground",
        render: (c) => c.city ?? "—",
      },
      {
        key: "state",
        label: "UF",
        className: "text-muted-foreground",
        render: (c) => c.state ?? "—",
      },
      {
        key: "country",
        label: "País",
        className: "text-muted-foreground",
        render: (c) => c.country ?? "—",
      },
      {
        key: "phone",
        label: "Telefone",
        className: "text-muted-foreground",
        render: (c) => (c.phone ? (toE164(c.phone) ?? c.phone) : "—"),
      },
      {
        key: "abm",
        label: "ABM",
        render: (c) =>
          c.is_target_account ? (
            <Pill tone="amber" label={`★ ${c.target_account_tier ?? "Tier"}`} />
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "owner",
        label: "Responsável",
        render: (c) =>
          responsibleId(c as Parameters<typeof responsibleId>[0]) ? (
            <div
              className="flex items-center gap-2"
              title={nameFor(responsibleId(c as Parameters<typeof responsibleId>[0]) ?? "")}
            >
              <InitialsAvatar
                text={initialsFor(responsibleId(c as Parameters<typeof responsibleId>[0]) ?? "")}
                seed={responsibleId(c as Parameters<typeof responsibleId>[0]) ?? ""}
                size={6}
              />
              <span className="truncate text-sm">
                {nameFor(responsibleId(c as Parameters<typeof responsibleId>[0]) ?? "")}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "created_at",
        label: "Criada em",
        className: "text-muted-foreground",
        header: (
          <Th
            sortable
            active={sortKey === "created_at"}
            dir={sortDir}
            onClick={() => onSort("created_at")}
          >
            Criada em
          </Th>
        ),
        render: (c) => timeAgo(c.created_at),
      },
      {
        key: "updated_at",
        label: "Atualizada em",
        className: "text-muted-foreground",
        render: (c) => timeAgo(c.updated_at),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortKey, sortDir, nameFor, initialsFor],
  );
  const DEFAULT_COMPANY_COLS = [
    "name",
    "domain",
    "industry",
    "size",
    "city",
    "state",
    "abm",
    "owner",
    "created_at",
  ];
  const {
    columns: visibleColumns,
    ColumnsButton,
    ColumnsEditor,
    persistSort,
  } = useGridColumns<CompanyRow>({
    gridKey: "companies",
    columns: companyColumns,
    defaults: DEFAULT_COMPANY_COLS,
    customEntity: "companies",
    catalogEntity: "companies",
    sortHeader: autoSortHeader,
  });

  const hasActiveFilters =
    filters.industry.length > 0 ||
    filters.size.length > 0 ||
    filters.state.length > 0 ||
    filters.targetOnly ||
    filters.createdPreset !== "any" ||
    filters.ownerIds.length > 0 ||
    filters.includeUnassigned;

  const removeOne = async (id: string) => {
    if (!(await confirmDialog("Excluir esta empresa?"))) return;
    const res = await deleteRowGuarded("companies", id);
    if (!res.ok) return toast.error(res.message);
    toast.success("Removida");
    qc.invalidateQueries({ queryKey: ["companies"] });
  };
  const bulkDelete = () => {
    if (!selectedIds.size) return;
    setBulkDeleteOpen(true);
  };
  const confirmBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const res = await deleteRowsGuarded("companies", ids);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    if (res.deleted < res.requested)
      toast.warning(partialDeleteMessage(res.deleted, res.requested));
    else toast.success(`${res.deleted} excluída(s)`);
    clearSelection();
    qc.invalidateQueries({ queryKey: ["companies"] });
  };
  const runBulkCep = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!(await confirmDialog(`Buscar endereço (ViaCEP) de ${ids.length} empresa(s)?`))) return;
    const r = await enrichCeps({ data: { ids } });
    toast.success(`${r.succeeded} ok · ${r.failed} falhas · ${r.skipped} sem CEP`);
    qc.invalidateQueries({ queryKey: ["companies"] });
  };

  const [startingQueue, setStartingQueue] = useState(false);
  const startQueueFromFilters = async (opts?: { fromSelection?: boolean }) => {
    setStartingQueue(true);
    try {
      let ids: string[] = [];
      if (opts?.fromSelection && selectedIds.size > 0) {
        ids = Array.from(selectedIds);
      } else {
        // Refaz a query atual sem paginação (limit defensivo de 5.000).
        let q = supabase.from("companies").select("id");
        if (activeView === "mine" && user?.id)
        q = q.or(responsibleOrExpr([user.id], { columns: RESPONSIBLE_COLUMNS_FULL }));
        if (activeView === "unassigned")
        q = q.or(
          responsibleOrExpr([], { columns: RESPONSIBLE_COLUMNS_FULL, includeUnassigned: true }),
        );
        if (activeView === "new_week") {
          const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
          q = q.gte("created_at", since);
        }
        if (filters.industry.length) q = q.in("industry", filters.industry);
        if (filters.size.length) q = q.in("size", filters.size);
        if (filters.state.length) q = q.in("state", filters.state);
        if (filters.targetOnly) q = q.eq("is_target_account", true);
        if (filters.createdPreset !== "any") {
          const { start, end } = getDateRange(
            filters.createdPreset,
            new Date(),
            filters.createdCustom,
          );
          if (start) q = q.gte("created_at", start.toISOString());
          if (end) q = q.lt("created_at", end.toISOString());
        }
        if (filters.ownerIds.length > 0 && filters.includeUnassigned) {
          q = q.or(
          responsibleOrExpr(filters.ownerIds, {
            columns: RESPONSIBLE_COLUMNS_FULL,
            includeUnassigned: true,
          }),
        );
        } else if (filters.ownerIds.length > 0) {
          q = q.or(responsibleOrExpr(filters.ownerIds, { columns: RESPONSIBLE_COLUMNS_FULL }));
        } else if (filters.includeUnassigned) {
          q = q.or(
          responsibleOrExpr([], { columns: RESPONSIBLE_COLUMNS_FULL, includeUnassigned: true }),
        );
        }
        const term = debouncedSearch.trim().replace(/[,()]/g, " ").trim();
        if (term) {
          q = q.or(
            [`name.ilike.%${term}%`, `domain.ilike.%${term}%`, `website.ilike.%${term}%`].join(","),
          );
        }
        q = q.order(sortKey, { ascending: sortDir === "asc" }).limit(5000);
        const { data, error } = await q;
        if (error) throw error;
        ids = (data ?? []).map((r) => r.id as string);
      }
      if (!ids.length) {
        toast.error("Nenhuma empresa para percorrer.");
        return;
      }
      const label =
        opts?.fromSelection && selectedIds.size > 0
          ? `${ids.length} empresa(s) selecionada(s)`
          : `${VIEWS.find((v) => v.id === activeView)?.label ?? "Empresas"} · ${ids.length.toLocaleString("pt-BR")}`;
      startFocusQueue("companies", ids, label);
      toast.success(`Fila iniciada com ${ids.length.toLocaleString("pt-BR")} empresa(s)`);
      navigate({ to: "/companies/$id", params: { id: ids[0] } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStartingQueue(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Empresas</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Carregando…" : `${total.toLocaleString("pt-BR")} registros`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => startQueueFromFilters()}
            disabled={startingQueue || isLoading || total === 0}
            title="Percorrer todas as empresas do filtro atual, uma por uma"
          >
            <Play className="mr-1.5 h-4 w-4" /> Iniciar fila
          </Button>
          <Can permission="techsales.companies.export.workspace">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-1.5 h-4 w-4" /> Exportar
            </Button>
          </Can>
          <Can
            any={[
              "techsales.companies.manage.workspace",
              "techsales.companies.create.workspace",
              "techsales.companies.create.own",
            ]}
          >
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Criar empresa
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
          <FilterGroup title="Setor" defaultOpen>
            {(facets?.industry ?? []).length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">Sem indústrias</p>
            ) : (
              (facets?.industry ?? []).map((s) => (
                <CheckboxFilter
                  key={s.value}
                  label={translateFieldValue("industry", s.value) || s.value}
                  count={s.count}
                  checked={filters.industry.includes(s.value)}
                  onChange={(v) =>
                    setFilters((f) => ({
                      ...f,
                      industry: v
                        ? [...f.industry, s.value]
                        : f.industry.filter((x) => x !== s.value),
                    }))
                  }
                />
              ))
            )}
          </FilterGroup>

          <FilterGroup title="Porte">
            {(facets?.size ?? []).map((s) => (
              <CheckboxFilter
                key={s.value}
                label={s.value}
                count={s.count}
                checked={filters.size.includes(s.value)}
                onChange={(v) =>
                  setFilters((f) => ({
                    ...f,
                    size: v ? [...f.size, s.value] : f.size.filter((x) => x !== s.value),
                  }))
                }
              />
            ))}
          </FilterGroup>

          <FilterGroup title="Estado/UF">
            {(facets?.state ?? []).map((s) => (
              <CheckboxFilter
                key={s.value}
                label={s.value}
                count={s.count}
                checked={filters.state.includes(s.value)}
                onChange={(v) =>
                  setFilters((f) => ({
                    ...f,
                    state: v ? [...f.state, s.value] : f.state.filter((x) => x !== s.value),
                  }))
                }
              />
            ))}
          </FilterGroup>

          <FilterGroup title="ABM (Target account)">
            <CheckboxFilter
              label="Apenas ABM"
              checked={filters.targetOnly}
              onChange={(v) => setFilters((f) => ({ ...f, targetOnly: v }))}
            />
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

          <FilterGroup title="Data de criação">
            <DateFilter
              name="companies-created"
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
                placeholder="Buscar nome, domínio, website…"
                className="h-9 pl-8"
              />
            </div>

            {selectedIds.size > 0 && (
              <BulkActionBar count={selectedIds.size} onClear={clearSelection}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => startQueueFromFilters({ fromSelection: true })}
                  disabled={startingQueue}
                >
                  <Play className="mr-1 h-3.5 w-3.5" /> Iniciar fila
                </Button>
                <Button variant="ghost" size="sm" className="h-7" onClick={runBulkCep}>
                  <MapPin className="mr-1 h-3.5 w-3.5" /> Buscar CEP
                </Button>
                <Can
                  any={[
                    "techsales.companies.manage.workspace",
                    "techsales.companies.delete.workspace",
                    "techsales.companies.delete.own",
                  ]}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-destructive hover:text-destructive"
                    onClick={bulkDelete}
                  >
                    Excluir
                  </Button>
                </Can>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => setBulkEditOpen(true)}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Editar em massa
                </Button>
              </BulkActionBar>
            )}
            <div className="flex items-center gap-1.5">
              <ColumnsButton />
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
                      Carregando empresas…
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td
                      colSpan={visibleColumns.length + 2}
                      className="px-3 py-16 text-center text-sm"
                    >
                      <p className="text-muted-foreground">
                        Não foi possível carregar as empresas.
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
                      Nenhuma empresa encontrada com os filtros atuais.
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
                                  navigate({ to: "/companies/$id", params: { id: c.id } })
                                }
                              >
                                Abrir
                              </DropdownMenuItem>
                              <Can
                                any={[
                                  "techsales.companies.manage.workspace",
                                  "techsales.companies.delete.workspace",
                                  "techsales.companies.delete.own",
                                ]}
                              >
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
      </div>
      <ColumnsEditor />
      <ConfirmCountDialog
        open={bulkDeleteOpen}
        setOpen={setBulkDeleteOpen}
        count={selectedIds.size}
        entity="empresa(s)"
        onConfirm={confirmBulkDelete}
      />
      <QuickCreateCompanyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          qc.invalidateQueries({ queryKey: ["companies"] });
          navigate({ to: "/companies/$id", params: { id } });
        }}
      />

      <BulkEditFieldsDialog
        open={bulkEditOpen}
        setOpen={setBulkEditOpen}
        entity="companies"
        ids={Array.from(selectedIds)}
        entityLabel="empresa(s)"
        onDone={() => {
          clearSelection();
          qc.invalidateQueries({ queryKey: ["companies"] });
        }}
      />
    </div>
  );
}
