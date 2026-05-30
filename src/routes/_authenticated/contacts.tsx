import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import type { Contact, Company } from "@/lib/db-types";
import { useGridColumns, type GridColumnDef } from "@/hooks/use-grid-columns";
import { cn } from "@/lib/utils";
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
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { BulkEnrichDialog } from "@/components/enrichment/bulk-enrich-dialog";
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
  TONES,
  ViewsTabs,
  timeAgo,
  type SortDir,
} from "@/components/crm/hubspot-shell";

export const Route = createFileRoute("/_authenticated/contacts")({
  component: ContactsPage,
});

const LIFECYCLE_STAGES = [
  { value: "subscriber", label: "Subscriber", tone: "slate" as const },
  { value: "lead", label: "Lead", tone: "sky" as const },
  { value: "marketingqualifiedlead", label: "MQL", tone: "violet" as const },
  { value: "salesqualifiedlead", label: "SQL", tone: "indigo" as const },
  { value: "opportunity", label: "Opportunity", tone: "amber" as const },
  { value: "customer", label: "Customer", tone: "emerald" as const },
  { value: "evangelist", label: "Evangelist", tone: "fuchsia" as const },
  { value: "other", label: "Other", tone: "slate" as const },
];

type ViewId = "all" | "mine" | "unassigned" | "new_week";
const VIEWS = [
  { id: "all" as const, label: "Todos os contatos" },
  { id: "mine" as const, label: "Meus contatos" },
  { id: "unassigned" as const, label: "Sem responsável" },
  { id: "new_week" as const, label: "Criados esta semana" },
];

type SortKey = "first_name" | "created_at" | "updated_at";

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
  const { nameFor, initialsFor } = useWorkspaceMembers();

  const qc = useQueryClient();
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState<ViewId>("all");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [enrichIds, setEnrichIds] = useState<string[] | null>(null);

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

  const { data: result, isLoading } = useQuery({
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
    ],
    queryFn: async () => {
      let q = supabase
        .from("contacts")
        .select(
          "id, first_name, last_name, email, phone, mobile_phone, job_title, company_id, lifecyclestage, owner_id, created_at, updated_at, custom_fields",
          { count: "exact" },
        );

      if (activeView === "mine" && user?.id) q = q.eq("owner_id", user.id);
      if (activeView === "unassigned") q = q.is("owner_id", null);
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
            `first_name.ilike.%${term}%`,
            `last_name.ilike.%${term}%`,
            `email.ilike.%${term}%`,
            `phone.ilike.%${term}%`,
          ].join(","),
        );
      }

      q = q.order(sortKey, { ascending: sortDir === "asc" });
      q = q.range(page * pageSize, page * pageSize + pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as Contact[], count: count ?? 0 };
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
  type ContactRow = (typeof rows)[number];
  const contactColumns = useMemo<GridColumnDef<ContactRow>[]>(
    () => [
      {
        key: "name",
        label: "Nome",
        header: (
          <Th sortable active={sortKey === "first_name"} dir={sortDir} onClick={() => onSort("first_name")}>
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
      { key: "email", label: "E-mail", className: "text-muted-foreground", render: (c) => c.email ?? "—" },
      {
        key: "phone",
        label: "Telefone",
        className: "text-muted-foreground",
        render: (c) => c.phone ?? c.mobile_phone ?? "—",
      },
      { key: "job_title", label: "Cargo", className: "text-muted-foreground", render: (c) => c.job_title ?? "—" },
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
          return stage ? <Pill tone={stage.tone} label={stage.label} /> : <span className="text-muted-foreground">—</span>;
        },
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
        key: "updated_at",
        label: "Última atividade",
        className: "text-muted-foreground",
        header: (
          <Th sortable active={sortKey === "updated_at"} dir={sortDir} onClick={() => onSort("updated_at")}>
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
          <Th sortable active={sortKey === "created_at"} dir={sortDir} onClick={() => onSort("created_at")}>
            Criado em
          </Th>
        ),
        render: (c) => timeAgo(c.created_at),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortKey, sortDir, nameFor, initialsFor, companyMap],
  );
  const DEFAULT_CONTACT_COLS = ["name", "email", "phone", "company", "lifecycle", "owner", "created_at"];
  const { columns: visibleColumns, ColumnsButton, ColumnsEditor } = useGridColumns<ContactRow>({
    gridKey: "contacts",
    columns: contactColumns,
    defaults: DEFAULT_CONTACT_COLS,
    customEntity: "contacts",
  });


  const hasActiveFilters =
    filters.lifecycle.length > 0 ||
    filters.companyIds.length > 0 ||
    filters.createdPreset !== "any";

  const removeOne = async (id: string) => {
    if (!confirm("Excluir este contato?")) return;
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    qc.invalidateQueries({ queryKey: ["contacts"] });
  };
  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!confirm(`Excluir ${ids.length} contato(s)?`)) return;
    const { error } = await supabase.from("contacts").delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} excluído(s)`);
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
          <Button variant="outline" size="sm" disabled>
            <Download className="mr-1.5 h-4 w-4" /> Exportar
          </Button>
          <Button size="sm" disabled>
            <Plus className="mr-1.5 h-4 w-4" /> Criar contato
          </Button>
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
                setFilters((f) => ({ ...f, ownerIds: v.ownerIds, includeUnassigned: v.includeUnassigned }))
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
                  onClick={() => setEnrichIds(Array.from(selectedIds))}
                >
                  <Sparkles className="mr-1 h-3.5 w-3.5" /> Enriquecer
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
                      Carregando contatos…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length + 2} className="px-3 py-16 text-center text-sm text-muted-foreground">
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

      <BulkEnrichDialog
        open={!!enrichIds}
        onOpenChange={(o) => !o && setEnrichIds(null)}
        ids={enrichIds ?? []}
        entity="contact"
        onDone={() => qc.invalidateQueries({ queryKey: ["contacts"] })}
      />
    </div>
  );
}
