import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileDiff,
  FileStack,
  FileText,
  Filter,
  Link2,
  Plus,
  Search,
  SearchX,
  Type,
  Upload,
  X,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listContractsPaged, listContractGroupings } from "@/lib/contracts.functions";
import { countContractsPendingLink } from "@/lib/contracts/import.functions";
import { listLegalEntities } from "@/lib/legal-entities.functions";
import { QuickCreateContractDialog } from "@/components/contracts/quick-create-contract-dialog";
import { ImportContractFileDialog } from "@/components/contracts/import-contract-file-dialog";
import { BatchImportContractsDialog } from "@/components/contracts/batch-import-contracts-dialog";
import { ContractTitlesStandardizeDialog } from "@/components/contracts/contract-titles-standardize-dialog";
import { ContractDocKindReviewDialog } from "@/components/contracts/contract-doc-kind-review-dialog";

import { ApplyContractTemplateDialog } from "@/components/contracts/apply-contract-template-dialog";
import {
  AssigneeFilter,
  ASSIGNEE_ALL,
  ASSIGNEE_ME,
  ASSIGNEE_NONE,
} from "@/components/entity/assignee-filter";
import { CompanyPicker } from "@/components/ui/company-picker";
import { useCurrentUserId } from "@/hooks/use-current-user-id";
import {
  ContractsTable,
  ContractsGroupedList,
  type ContractRow,
} from "@/components/contracts/contracts-grouped-list";
import { ContractsBulkBar } from "@/components/contracts/contracts-bulk-bar";
import { useCanDelete } from "@/lib/access-control/use-can-delete";
import { Checkbox } from "@/components/ui/checkbox";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { ViewModeToggle, type ListViewMode } from "@/components/kanban/view-mode-toggle";

type GroupBy = "none" | "company" | "service" | "job_profile" | "seniority";


const GROUP_BY_VALUES: GroupBy[] = ["none", "company", "service", "job_profile", "seniority"];
const PAGE_SIZES = [25, 50, 100, 200];

type ContractSearch = {
  view?: ListViewMode;
  groupBy: GroupBy;

  page: number;
  pageSize: number;
  q: string;
  role: string;
  status: string;
  assignee: string;
  companyId: string;
  companyName: string;
  legalEntityId: string;
  startsFrom: string;
  startsTo: string;
  endsFrom: string;
  endsTo: string;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

export const Route = createFileRoute("/_authenticated/contracts/")({
  validateSearch: (search: Record<string, unknown>): ContractSearch => {
    const raw = String(search["groupBy"] ?? "none");
    const groupBy: GroupBy = (GROUP_BY_VALUES as string[]).includes(raw)
      ? (raw as GroupBy)
      : "none";
    return {
      view: search["view"] === "kanban" ? "kanban" : "table",
      groupBy,
      page: num(search["page"], 1),
      pageSize: num(search["pageSize"], 50),
      q: str(search["q"]),
      role: str(search["role"]),
      status: str(search["status"]),
      assignee: str(search["assignee"]),
      companyId: str(search["companyId"]),
      companyName: str(search["companyName"]),
      legalEntityId: str(search["legalEntityId"]),
      startsFrom: str(search["startsFrom"]),
      startsTo: str(search["startsTo"]),
      endsFrom: str(search["endsFrom"]),
      endsTo: str(search["endsTo"]),
    };
  },
  head: () => ({
    meta: [
      { title: "Contratos" },
      { name: "description", content: "Gestão do ciclo de vida de contratos." },
    ],
  }),
  component: ContractsPage,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  in_negotiation: "Em negociação",
  awaiting_signature: "Aguard. assinatura",
  active: "Ativo",
  renewing: "Renovando",
  ended: "Encerrado",
  terminated: "Rescindido",
};

// Tons por status usando tokens semânticos.
const CONTRACT_KANBAN_TONE: Record<string, string> = {
  draft: "bg-muted-foreground/40",
  in_review: "bg-primary/40",
  in_negotiation: "bg-primary/60",
  awaiting_signature: "bg-primary",
  active: "bg-emerald-500",
  renewing: "bg-amber-500",
  ended: "bg-muted-foreground/60",
  terminated: "bg-destructive",
};

const ROLE_LABEL: Record<string, string> = { provider: "Prestação", client: "Compra" };


const iso = (d: Date) => d.toISOString().slice(0, 10);
const plusDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return iso(d);
};

function ContractsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate({ from: Route.fullPath });
  const sp = Route.useSearch();
  const meId = useCurrentUserId();
  const list = useServerFn(listContractsPaged);
  const groupings = useServerFn(listContractGroupings);
  const countPending = useServerFn(countContractsPendingLink);
  const legalEntitiesFn = useServerFn(listLegalEntities);
  const { canDeleteRecord, isLoading: deletePermLoading } = useCanDelete("techcontracts.contracts");

  const [searchDraft, setSearchDraft] = useState(sp.q);
  const [openNew, setOpenNew] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [openBatch, setOpenBatch] = useState(false);
  const [openTemplate, setOpenTemplate] = useState(false);
  const [openStandardize, setOpenStandardize] = useState(false);
  const [openDocKind, setOpenDocKind] = useState(false);

  const [openFilters, setOpenFilters] = useState(false);
  const [nestLinks, setNestLinks] = useState(true);
  const [selectedMap, setSelectedMap] = useState<Map<string, ContractRow>>(new Map());

  // Atualiza a busca na URL com debounce, voltando para a página 1.
  useEffect(() => {
    if (searchDraft === sp.q) return;
    const t = setTimeout(() => {
      navigate({ search: (prev: ContractSearch) => ({ ...prev, q: searchDraft, page: 1 }) });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  useEffect(() => {
    setSearchDraft(sp.q);
  }, [sp.q]);

  const setFilter = (patch: Partial<ContractSearch>) =>
    navigate({ search: (prev: ContractSearch) => ({ ...prev, ...patch, page: 1 }) });

  const setPage = (page: number) =>
    navigate({ search: (prev: ContractSearch) => ({ ...prev, page }) });

  const assigneeParam = useMemo(() => {
    if (!sp.assignee || sp.assignee === ASSIGNEE_ALL) return undefined;
    if (sp.assignee === ASSIGNEE_NONE) return "__none__";
    if (sp.assignee === ASSIGNEE_ME) return meId ?? undefined;
    return sp.assignee;
  }, [sp.assignee, meId]);

  const legalEntitiesQuery = useQuery({
    queryKey: ["legal-entities", "contracts-filter"],
    queryFn: () => legalEntitiesFn(),
    staleTime: 300_000,
  });
  const legalEntityName = useMemo(
    () => (legalEntitiesQuery.data ?? []).find((e) => e.id === sp.legalEntityId)?.name ?? "",
    [legalEntitiesQuery.data, sp.legalEntityId],
  );

  const pendingQuery = useQuery({
    queryKey: ["contracts", "pending-link-count"],
    queryFn: () => countPending(),
    staleTime: 60_000,
  });
  const pendingCount = pendingQuery.data?.count ?? 0;

  const queryInput = {
    role: sp.role ? (sp.role as "provider" | "client") : undefined,
    status: sp.status ? (sp.status as keyof typeof STATUS_LABEL) : undefined,
    search: sp.q || undefined,
    companyId: sp.companyId || undefined,
    legalEntityId: sp.legalEntityId || undefined,
    legalEntityName: legalEntityName || undefined,
    assignedTo: assigneeParam,
    startsFrom: sp.startsFrom || undefined,
    startsTo: sp.startsTo || undefined,
    endsFrom: sp.endsFrom || undefined,
    endsTo: sp.endsTo || undefined,
    page: sp.page,
    pageSize: sp.pageSize,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["contracts", "paged", queryInput],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => list({ data: queryInput as any }),
    placeholderData: (prev) => prev,
  });

  const rows = (data?.rows ?? []) as ContractRow[];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / sp.pageSize));

  const contractIds = useMemo(() => rows.map((c) => c.id), [rows]);

  const groupQuery = useQuery({
    queryKey: ["contracts", "groupings", contractIds],
    queryFn: () => groupings({ data: { contractIds } }),
    enabled: sp.groupBy !== "none" && contractIds.length > 0,
  });

  const selectedIds = useMemo(() => new Set(selectedMap.keys()), [selectedMap]);

  const selection = useMemo(
    () => ({
      selectedIds,
      onToggle: (id: string) =>
        setSelectedMap((prev) => {
          const next = new Map(prev);
          if (next.has(id)) next.delete(id);
          else {
            const row = rows.find((r) => r.id === id);
            if (row) next.set(id, row);
          }
          return next;
        }),
      onToggleMany: (ids: string[], checked: boolean) =>
        setSelectedMap((prev) => {
          const next = new Map(prev);
          for (const id of ids) {
            if (checked) {
              const row = rows.find((r) => r.id === id);
              if (row) next.set(id, row);
            } else next.delete(id);
          }
          return next;
        }),
    }),
    [selectedIds, rows],
  );

  const selectedRows = useMemo(() => Array.from(selectedMap.values()), [selectedMap]);

  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (sp.role)
    activeChips.push({
      key: "role",
      label: `Tipo: ${ROLE_LABEL[sp.role] ?? sp.role}`,
      clear: () => setFilter({ role: "" }),
    });
  if (sp.status)
    activeChips.push({
      key: "status",
      label: `Status: ${STATUS_LABEL[sp.status] ?? sp.status}`,
      clear: () => setFilter({ status: "" }),
    });
  if (sp.companyId)
    activeChips.push({
      key: "company",
      label: `Empresa: ${sp.companyName || "selecionada"}`,
      clear: () => setFilter({ companyId: "", companyName: "" }),
    });
  if (sp.legalEntityId)
    activeChips.push({
      key: "legalEntity",
      label: `Contratante: ${legalEntityName || "selecionado"}`,
      clear: () => setFilter({ legalEntityId: "" }),
    });
  if (sp.startsFrom || sp.startsTo)
    activeChips.push({
      key: "starts",
      label: `Início: ${sp.startsFrom || "…"} → ${sp.startsTo || "…"}`,
      clear: () => setFilter({ startsFrom: "", startsTo: "" }),
    });
  if (sp.endsFrom || sp.endsTo)
    activeChips.push({
      key: "ends",
      label: `Término: ${sp.endsFrom || "…"} → ${sp.endsTo || "…"}`,
      clear: () => setFilter({ endsFrom: "", endsTo: "" }),
    });

  const advancedCount =
    (sp.companyId ? 1 : 0) +
    (sp.legalEntityId ? 1 : 0) +
    (sp.startsFrom || sp.startsTo ? 1 : 0) +
    (sp.endsFrom || sp.endsTo ? 1 : 0);

  const hasFilters =
    activeChips.length > 0 || Boolean(sp.q) || (sp.assignee && sp.assignee !== ASSIGNEE_ALL);

  const clearAll = () =>
    navigate({
      search: (prev: ContractSearch) => ({
        ...prev,
        q: "",
        role: "",
        status: "",
        assignee: ASSIGNEE_ALL,
        companyId: "",
        companyName: "",
        legalEntityId: "",
        startsFrom: "",
        startsTo: "",
        endsFrom: "",
        endsTo: "",
        page: 1,
      }),
    });

  const firstIndex = total === 0 ? 0 : (sp.page - 1) * sp.pageSize + 1;
  const lastIndex = Math.min(sp.page * sp.pageSize, total);

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Contratos"
        description="Ciclo de vida de contratos com clientes e fornecedores."
        count={total}
        countLabel={total === 1 ? "contrato" : "contratos"}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setOpenTemplate(true)}>
              <FileStack className="h-4 w-4 mr-1" /> Gerar de modelo
            </Button>
            <Button variant="outline" onClick={() => setOpenImport(true)}>
              <Upload className="h-4 w-4 mr-1" /> Importar contrato
            </Button>
            <Button variant="outline" onClick={() => setOpenBatch(true)}>
              <Upload className="h-4 w-4 mr-1" /> Importar em lote
            </Button>
            <Button variant="outline" onClick={() => setOpenStandardize(true)}>
              <Type className="h-4 w-4 mr-1" /> Padronizar títulos
            </Button>
            <Button variant="outline" onClick={() => setOpenDocKind(true)}>
              <FileDiff className="h-4 w-4 mr-1" /> Revisar tipo de documento
            </Button>

            <Button
              variant="outline"
              asChild
              aria-label={
                pendingCount > 0
                  ? `Vincular contratos, ${pendingCount} pendentes`
                  : "Vincular contratos"
              }
            >
              <Link to="/contracts/links">
                <Link2 className="h-4 w-4 mr-1" /> Vincular contratos
                {pendingCount > 0 && (
                  <Badge variant="destructive" className="ml-2 px-1.5">
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </Badge>
                )}
              </Link>
            </Button>

            <Button onClick={() => setOpenNew(true)}>
              <Plus className="h-4 w-4 mr-1" /> Novo contrato
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título ou número…"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            className="pl-8"
            aria-label="Buscar contratos"
          />
        </div>
        <Select
          value={sp.role || "all"}
          onValueChange={(v) => setFilter({ role: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-40" aria-label="Tipo">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="provider">Prestação</SelectItem>
            <SelectItem value="client">Compra</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sp.status || "all"}
          onValueChange={(v) => setFilter({ status: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-52" aria-label="Status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <AssigneeFilter
          value={sp.assignee || ASSIGNEE_ALL}
          onChange={(next) => setFilter({ assignee: next })}
        />
        <ViewModeToggle
          value={sp.view ?? "table"}
          onChange={(v) => navigate({ search: (prev) => ({ ...prev, view: v }) })}
        />


        <Popover open={openFilters} onOpenChange={setOpenFilters}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-1">
              <Filter className="h-4 w-4" /> Filtros
              {advancedCount > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5">
                  {advancedCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-96 space-y-4">
            <div className="space-y-1.5">
              <Label>Empresa (contraparte)</Label>
              <CompanyPicker
                mode="pick"
                hydrateById={false}
                value={{ id: sp.companyId || null, name: sp.companyName }}
                onChange={(v) => setFilter({ companyId: v.id ?? "", companyName: v.name })}
                placeholder="Buscar empresa"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-legal-entity">Contratante</Label>
              <Select
                value={sp.legalEntityId || "all"}
                onValueChange={(v) => setFilter({ legalEntityId: v === "all" ? "" : v })}
              >
                <SelectTrigger id="filter-legal-entity">
                  <SelectValue placeholder="Todos os contratantes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os contratantes</SelectItem>
                  {(legalEntitiesQuery.data ?? []).map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Vigência</Label>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setFilter({ endsFrom: iso(new Date()), endsTo: plusDays(30) })}
                >
                  Vencendo em 30 dias
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setFilter({ endsFrom: iso(new Date()), endsTo: plusDays(60) })}
                >
                  60 dias
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setFilter({ endsFrom: iso(new Date()), endsTo: plusDays(90) })}
                >
                  90 dias
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setFilter({
                      startsTo: iso(new Date()),
                      endsFrom: iso(new Date()),
                      endsTo: "",
                      startsFrom: "",
                    })
                  }
                >
                  Vigentes hoje
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setFilter({
                      endsTo: iso(new Date()),
                      endsFrom: "",
                      startsFrom: "",
                      startsTo: "",
                    })
                  }
                >
                  Já encerrados
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="starts-from" className="text-xs text-muted-foreground">
                    Início de
                  </Label>
                  <Input
                    id="starts-from"
                    type="date"
                    value={sp.startsFrom}
                    onChange={(e) => setFilter({ startsFrom: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="starts-to" className="text-xs text-muted-foreground">
                    Início até
                  </Label>
                  <Input
                    id="starts-to"
                    type="date"
                    value={sp.startsTo}
                    onChange={(e) => setFilter({ startsTo: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ends-from" className="text-xs text-muted-foreground">
                    Término de
                  </Label>
                  <Input
                    id="ends-from"
                    type="date"
                    value={sp.endsFrom}
                    onChange={(e) => setFilter({ endsFrom: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ends-to" className="text-xs text-muted-foreground">
                    Término até
                  </Label>
                  <Input
                    id="ends-to"
                    type="date"
                    value={sp.endsTo}
                    onChange={(e) => setFilter({ endsTo: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
                Limpar filtros
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-2">
          <Label htmlFor="contracts-group-by" className="text-sm text-muted-foreground">
            Agrupar por
          </Label>
          <Select
            value={sp.groupBy}
            onValueChange={(next) =>
              navigate({
                search: (prev: ContractSearch) => ({ ...prev, groupBy: next as GroupBy }),
              })
            }
          >
            <SelectTrigger id="contracts-group-by" className="w-44">
              <SelectValue placeholder="Nenhum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              <SelectItem value="company">Empresa</SelectItem>
              <SelectItem value="service">Serviço</SelectItem>
              <SelectItem value="job_profile">Cargo</SelectItem>
              <SelectItem value="seniority">Senioridade</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="nest-links"
            checked={nestLinks}
            onCheckedChange={(v) => setNestLinks(v === true)}
          />
          <Label htmlFor="nest-links" className="text-sm text-muted-foreground">
            Aninhar vínculos
          </Label>
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <Badge key={chip.key} variant="secondary" className="gap-1 pr-1">
              {chip.label}
              <button
                type="button"
                aria-label={`Remover filtro ${chip.label}`}
                onClick={chip.clear}
                className="rounded p-0.5 hover:bg-background/60"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Limpar filtros
          </Button>
        </div>
      )}

      {selectedRows.length > 0 ? (
        <ContractsBulkBar
          selected={selectedRows}
          onClear={() => setSelectedMap(new Map())}
          canDelete={(row) => canDeleteRecord(row)}
          canDeleteLoading={deletePermLoading}
        />
      ) : null}

      {isLoading ? (
        <div className="space-y-2 rounded-lg border bg-card p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : rows.length === 0 && hasFilters ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <SearchX className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">Nenhum resultado para os filtros</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Ajuste ou limpe os filtros para ver mais contratos.
          </p>
          <Button className="mt-4" variant="outline" onClick={clearAll}>
            Limpar filtros
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">Nenhum contrato ainda</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Comece criando um contrato ou gere um a partir de um negócio ganho.
          </p>
          <Button className="mt-4" onClick={() => setOpenNew(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo contrato
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {(sp.groupBy !== "none" || nestLinks) && total > rows.length && (
            <p className="text-xs text-muted-foreground">
              O agrupamento e o aninhamento de aditivos consideram apenas os contratos da página
              exibida.
            </p>
          )}

          {(sp.view ?? "table") === "kanban" ? (
            <KanbanBoard
              rows={rows as Array<ContractRow & { id: string }>}
              table="contracts"
              stageField="status"
              selectable
              entityLabel="contrato"
              canDelete={false}
              readOnly
              ariaLabel="Quadro de contratos por status"
              columns={Object.entries(STATUS_LABEL).map(([value, label]) => ({
                value,
                label,
                tone: CONTRACT_KANBAN_TONE[value],
              }))}
              renderCard={(c) => (
                <div className="space-y-1">
                  <Link
                    to="/contracts/$id"
                    params={{ id: c.id }}
                    className="block text-sm font-medium hover:underline"
                  >
                    {c.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {ROLE_LABEL[c.role as string] ?? c.role}
                    {c.number ? ` · ${c.number}` : ""}
                  </p>
                  {c.starts_at ? (
                    <p className="text-xs text-muted-foreground">
                      Início {new Date(c.starts_at).toLocaleDateString("pt-BR")}
                    </p>
                  ) : null}


                </div>
              )}
            />
          ) : sp.groupBy === "none" ? (
            <div className="rounded-lg border bg-card">
              <ContractsTable rows={rows} selection={selection} editable nestLinks={nestLinks} />
            </div>

          ) : (
            <ContractsGroupedList
              rows={rows}
              groupBy={sp.groupBy}
              groupings={groupQuery.data}
              isLoading={groupQuery.isLoading}
              isError={groupQuery.isError}
              onRetry={() => groupQuery.refetch()}
              selection={selection}
              editable
              nestLinks={nestLinks}
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Exibindo {firstIndex}–{lastIndex} de {total} contratos
              {isFetching ? " · atualizando…" : ""}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="page-size" className="text-sm text-muted-foreground">
                  Por página
                </Label>
                <Select
                  value={String(sp.pageSize)}
                  onValueChange={(v) => setFilter({ pageSize: Number(v) })}
                >
                  <SelectTrigger id="page-size" className="h-9 w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Primeira página"
                  disabled={sp.page <= 1}
                  onClick={() => setPage(1)}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Página anterior"
                  disabled={sp.page <= 1}
                  onClick={() => setPage(sp.page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 text-sm">
                  {sp.page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Próxima página"
                  disabled={sp.page >= totalPages}
                  onClick={() => setPage(sp.page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Última página"
                  disabled={sp.page >= totalPages}
                  onClick={() => setPage(totalPages)}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <QuickCreateContractDialog
        open={openNew}
        onOpenChange={setOpenNew}
        onCreated={() => qc.invalidateQueries({ queryKey: ["contracts"] })}
      />

      <ApplyContractTemplateDialog
        open={openTemplate}
        onOpenChange={(next) => {
          setOpenTemplate(next);
          if (!next) qc.invalidateQueries({ queryKey: ["contracts"] });
        }}
      />

      <BatchImportContractsDialog
        open={openBatch}
        onOpenChange={setOpenBatch}
        onImported={() => qc.invalidateQueries({ queryKey: ["contracts"] })}
      />

      <ImportContractFileDialog
        open={openImport}
        onOpenChange={(next) => {
          setOpenImport(next);
          if (!next) qc.invalidateQueries({ queryKey: ["contracts"] });
        }}
      />

      {openStandardize ? (
        <ContractTitlesStandardizeDialog onOpenChange={setOpenStandardize} />
      ) : null}

      {openDocKind ? <ContractDocKindReviewDialog onOpenChange={setOpenDocKind} /> : null}
    </div>
  );
}
