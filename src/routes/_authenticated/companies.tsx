import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import type { Company } from "@/lib/db-types";
import { useGridColumns, type GridColumnDef } from "@/hooks/use-grid-columns";
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
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  X,
} from "lucide-react";
import { enrichCompaniesAddress } from "@/lib/integrations/viacep.functions";
import { ConfirmCountDialog } from "@/components/confirm-count-dialog";
import { OwnerFilter, type OwnerFilterValue } from "@/components/owner-filter";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";

import {
  getDateRange,
  type CustomRange,
  type DatePreset,
} from "@/lib/date-presets";
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

type SortKey = "name" | "created_at" | "updated_at";

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
  const { can } = useMyTools();
  const { nameFor, initialsFor } = useWorkspaceMembers();

  const qc = useQueryClient();
  const navigate = useNavigate();
  const enrichCeps = useServerFn(enrichCompaniesAddress);

  const [activeView, setActiveView] = useState<ViewId>("all");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

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


  const { data: result, isLoading } = useQuery({
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
    ],
    queryFn: async () => {
      let q = supabase
        .from("companies")
        .select(
          "id, name, domain, industry, size, city, state, country, phone, owner_id, is_target_account, target_account_tier, created_at, updated_at, custom_fields",
          { count: "exact" },
        );

      if (activeView === "mine" && user?.id) q = q.eq("owner_id", user.id);
      if (activeView === "unassigned") q = q.is("owner_id", null);
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
        q = q.or(`owner_id.in.(${filters.ownerIds.join(",")}),owner_id.is.null`);
      } else if (filters.ownerIds.length > 0) {
        q = q.in("owner_id", filters.ownerIds);
      } else if (filters.includeUnassigned) {
        q = q.is("owner_id", null);
      }

      const term = debouncedSearch.trim().replace(/[,()]/g, " ").trim();
      if (term) {
        q = q.or(
          [
            `name.ilike.%${term}%`,
            `domain.ilike.%${term}%`,
            `website.ilike.%${term}%`,
          ].join(","),
        );
      }

      q = q.order(sortKey, { ascending: sortDir === "asc" });
      q = q.range(page * pageSize, page * pageSize + pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as Company[], count: count ?? 0 };
    },
  });

  const rows = result?.rows ?? [];
  const total = result?.count ?? 0;
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const someSelected = rows.some((r) => selectedIds.has(r.id));

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

  const onSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

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
      { key: "domain", label: "Domínio", className: "text-muted-foreground", render: (c) => c.domain ?? "—" },
      { key: "industry", label: "Setor", className: "text-muted-foreground", render: (c) => c.industry ?? "—" },
      { key: "size", label: "Porte", className: "text-muted-foreground", render: (c) => c.size ?? "—" },
      { key: "city", label: "Cidade", className: "text-muted-foreground", render: (c) => c.city ?? "—" },
      { key: "state", label: "UF", className: "text-muted-foreground", render: (c) => c.state ?? "—" },
      { key: "country", label: "País", className: "text-muted-foreground", render: (c) => c.country ?? "—" },
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
          c.owner_id ? (
            <div className="flex items-center gap-2" title={nameFor(c.owner_id)}>
              <InitialsAvatar text={initialsFor(c.owner_id)} seed={c.owner_id} size={6} />
              <span className="truncate text-sm">{nameFor(c.owner_id)}</span>
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
          <Th sortable active={sortKey === "created_at"} dir={sortDir} onClick={() => onSort("created_at")}>
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
  const DEFAULT_COMPANY_COLS = ["name", "domain", "industry", "size", "city", "state", "abm", "owner", "created_at"];
  const { columns: visibleColumns, ColumnsButton, ColumnsEditor } = useGridColumns<CompanyRow>({
    gridKey: "companies",
    columns: companyColumns,
    defaults: DEFAULT_COMPANY_COLS,
    customEntity: "companies",
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
    if (!confirm("Excluir esta empresa?")) return;
    const { error } = await supabase.from("companies").delete().eq("id", id);
    if (error) return toast.error(error.message);
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
    const { error } = await supabase.from("companies").delete().in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${ids.length} excluída(s)`);
    clearSelection();
    qc.invalidateQueries({ queryKey: ["companies"] });
  };
  const runBulkCep = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!confirm(`Buscar endereço (ViaCEP) de ${ids.length} empresa(s)?`)) return;
    const r = await enrichCeps({ data: { ids } });
    toast.success(`${r.succeeded} ok · ${r.failed} falhas · ${r.skipped} sem CEP`);
    qc.invalidateQueries({ queryKey: ["companies"] });
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
          <Button variant="outline" size="sm" disabled>
            <Download className="mr-1.5 h-4 w-4" /> Exportar
          </Button>
          <Button size="sm" disabled>
            <Plus className="mr-1.5 h-4 w-4" /> Criar empresa
          </Button>
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
                  label={s.value}
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
                    state: v
                      ? [...f.state, s.value]
                      : f.state.filter((x) => x !== s.value),
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
                setFilters((f) => ({ ...f, ownerIds: v.ownerIds, includeUnassigned: v.includeUnassigned }))
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

            {selectedIds.size > 0 ? (
              <div className="flex items-center gap-2 rounded-md border bg-primary/5 px-2 py-1">
                <span className="text-xs font-medium text-primary">
                  {selectedIds.size} selecionada(s)
                </span>
                <Button variant="ghost" size="sm" className="h-7" onClick={runBulkCep}>
                  <MapPin className="mr-1 h-3.5 w-3.5" /> Buscar CEP
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-destructive hover:text-destructive"
                  onClick={bulkDelete}
                >
                  Excluir
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={clearSelection}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <ColumnsButton />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Ações <ChevronDown className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem disabled>Salvar visualização</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled>Exportar CSV</DropdownMenuItem>
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
                  {visibleColumns.map((col) =>
                    col.header ?? <Th key={col.key} className={col.headerClassName}>{col.label}</Th>,
                  )}
                  <th className="w-10 border-b px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={visibleColumns.length + 2} className="px-3 py-16 text-center text-sm text-muted-foreground">
                      Carregando empresas…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length + 2} className="px-3 py-16 text-center text-sm text-muted-foreground">
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
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => removeOne(c.id)}
                              >
                                Excluir
                              </DropdownMenuItem>
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
    </div>
  );
}
