/**
 * Aba "Base" — extração de listas de prospecção a partir de entidades já
 * cadastradas.
 *
 * A lista é orientada a pessoas (contatos) das empresas com negócios ganhos,
 * perdidos ou em aberto, filtrando por serviços do catálogo e período.
 * Exemplos:
 *  - contatos de clientes com negócios ganhos de um serviço;
 *  - contatos de clientes que perderam "Fábrica de Software" nos últimos 180 dias.
 *
 * Componente de apresentação + leitura via cliente Supabase (RLS aplicada).
 * A criação de fila é delegada ao `CreateQueueFromBaseDialog`.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DateRangeFilter,
  describeRange,
  resolveDateRange,
  type DateRangeValue,
} from "@/components/date-range-filter";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AutocompleteChips } from "@/components/ui/autocomplete-chips";
import { EmptyState, AtsSectionHeader, FilterBar, MetricCard } from "@/components/ats/ui";
import { AssigneeCell } from "@/components/entity/assignee-cell";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { CreateQueueFromBaseDialog } from "@/components/prospecting/create-queue-from-base-dialog";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { QUEUE_CREATE, QUEUE_UPDATE, asKeys } from "@/lib/prospecting/permission-keys";
import { Database, Download, Copy, AlertTriangle, ListPlus } from "lucide-react";
import { formatCurrency } from "@/lib/crm";
import { formatCompactDate } from "@/lib/format/compact-date";

type Outcome = "won" | "lost" | "open";

const OUTCOME_LABEL: Record<Outcome, string> = {
  won: "Ganhos",
  lost: "Perdidos",
  open: "Em aberto",
};

const DEAL_LIMIT = 1000;
const CONTACT_LIMIT = 1000;

type ServiceOption = { id: string; name: string };

type DealRow = {
  id: string;
  name: string | null;
  value: number | null;
  stage: string | null;
  closed_at: string | null;
  lost_at: string | null;
  updated_at: string | null;
  company_id: string | null;
  primary_contact_id: string | null;
  companies: { id: string; name: string | null; domain: string | null; city: string | null } | null;
  deal_line_items: { service_catalog_id: string | null; name: string | null }[] | null;
};

type ContactRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile_phone: string | null;
  job_title: string | null;
  company_id: string | null;
  company_name: string | null;
  assigned_to: string | null;
  lifecyclestage: string | null;
};

/** Linha da lista de prospecção: uma pessoa a abordar. */
type ProspectRow = {
  id: string;
  name: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  companyId: string | null;
  companyName: string | null;
  assignedTo: string | null;
  services: string[];
  dealsCount: number;
  totalValue: number;
  lastDate: string | null;
  isPrimary: boolean;
};

const sel = (s: string): string => s;

function dealDate(d: DealRow, outcome: Outcome): string | null {
  if (outcome === "lost") return d.lost_at ?? d.closed_at ?? d.updated_at ?? null;
  if (outcome === "won") return d.closed_at ?? d.updated_at ?? null;
  return d.updated_at ?? null;
}

function fullName(c: ContactRow): string {
  const n = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return n || c.email || "Sem identificação";
}

export function BaseTab() {
  const [outcome, setOutcome] = useState<Outcome>("won");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [period, setPeriod] = useState<DateRangeValue>({ preset: "last_180d" });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [queueOpen, setQueueOpen] = useState(false);

  const { canAny } = usePermissions();
  const canQueue = canAny(asKeys(QUEUE_CREATE)) || canAny(asKeys(QUEUE_UPDATE));

  const { data: services } = useQuery({
    queryKey: ["prospecting", "base", "services"],
    queryFn: async (): Promise<ServiceOption[]> => {
      const { data, error } = await supabase
        .from("service_catalog")
        .select(sel("id, name"))
        .eq("active", true)
        .order("name")
        .returns<ServiceOption[]>();
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 300_000,
  });

  const serviceOptions = useMemo(
    () => (services ?? []).map((s) => ({ value: s.id, label: s.name })),
    [services],
  );

  const {
    data: deals,
    isLoading: loadingDeals,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["prospecting", "base", "deals", outcome, serviceIds, period],
    queryFn: async (): Promise<DealRow[]> => {
      const filtered = serviceIds.length > 0;
      const projection = sel(
        "id, name, value, stage, closed_at, lost_at, updated_at, company_id, primary_contact_id," +
          " companies(id, name, domain, city)," +
          (filtered
            ? " deal_line_items!inner(service_catalog_id, name)"
            : " deal_line_items(service_catalog_id, name)"),
      );

      let query = supabase.from("deals").select(projection).is("deleted_at", null);

      if (outcome === "won") query = query.eq("stage", "won");
      else if (outcome === "lost") query = query.eq("stage", "lost");
      else query = query.not("stage", "in", "(won,lost)");

      if (filtered) {
        query = query.in("deal_line_items.service_catalog_id", serviceIds);
      }

      const { start, end } = resolveDateRange(period);
      if (start || end) {
        const dateCol =
          outcome === "lost" ? "lost_at" : outcome === "won" ? "closed_at" : "updated_at";
        if (start) {
          const since = new Date(`${start}T00:00:00`).toISOString();
          query = query.or(
            `${dateCol}.gte.${since},and(${dateCol}.is.null,updated_at.gte.${since})`,
          );
        }
        if (end) {
          const until = new Date(`${end}T00:00:00`).toISOString();
          query = query.or(`${dateCol}.lt.${until},and(${dateCol}.is.null,updated_at.lt.${until})`);
        }
      }

      const { data, error } = await query
        .order("updated_at", { ascending: false })
        .limit(DEAL_LIMIT)
        .returns<DealRow[]>();
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  /** Contexto agregado por empresa (serviços, negócios, valor, data). */
  const companyContext = useMemo(() => {
    const map = new Map<
      string,
      {
        services: string[];
        dealsCount: number;
        totalValue: number;
        lastDate: string | null;
        companyName: string | null;
      }
    >();
    const primaryIds = new Set<string>();
    for (const d of deals ?? []) {
      if (d.primary_contact_id) primaryIds.add(d.primary_contact_id);
      const key = d.company_id;
      if (!key) continue;
      const date = dealDate(d, outcome);
      const svcs = (d.deal_line_items ?? [])
        .map((li) => li.name)
        .filter((n): n is string => !!n);
      const entry = map.get(key) ?? {
        services: [] as string[],
        dealsCount: 0,
        totalValue: 0,
        lastDate: null as string | null,
        companyName: d.companies?.name ?? null,
      };
      entry.dealsCount += 1;
      entry.totalValue += Number(d.value ?? 0);
      for (const s of svcs) if (!entry.services.includes(s)) entry.services.push(s);
      if (date && (!entry.lastDate || date > entry.lastDate)) entry.lastDate = date;
      if (!entry.companyName && d.companies?.name) entry.companyName = d.companies.name;
      map.set(key, entry);
    }
    return { byCompany: map, primaryIds };
  }, [deals, outcome]);

  const companyIds = useMemo(() => [...companyContext.byCompany.keys()], [companyContext]);
  const primaryContactIds = useMemo(() => [...companyContext.primaryIds], [companyContext]);

  const {
    data: contacts,
    isLoading: loadingContacts,
    isError: contactsError,
  } = useQuery({
    queryKey: ["prospecting", "base", "contacts", companyIds, primaryContactIds],
    enabled: companyIds.length > 0 || primaryContactIds.length > 0,
    queryFn: async (): Promise<ContactRow[]> => {
      const projection = sel(
        "id, first_name, last_name, email, phone, mobile_phone, job_title," +
          " company_id, company_name, assigned_to, lifecyclestage",
      );
      const byId = new Map<string, ContactRow>();

      if (companyIds.length > 0) {
        const { data, error } = await supabase
          .from("contacts")
          .select(projection)
          .is("deleted_at", null)
          .in("company_id", companyIds.slice(0, 500))
          .order("first_name")
          .limit(CONTACT_LIMIT)
          .returns<ContactRow[]>();
        if (error) throw new Error(error.message);
        for (const c of data ?? []) byId.set(c.id, c);
      }

      // Contatos principais dos negócios podem não estar ligados à empresa.
      const missing = primaryContactIds.filter((id) => !byId.has(id)).slice(0, 500);
      if (missing.length > 0) {
        const { data, error } = await supabase
          .from("contacts")
          .select(projection)
          .is("deleted_at", null)
          .in("id", missing)
          .returns<ContactRow[]>();
        if (error) throw new Error(error.message);
        for (const c of data ?? []) byId.set(c.id, c);
      }

      return [...byId.values()];
    },
  });

  const isLoading = loadingDeals || loadingContacts;

  const rows = useMemo<ProspectRow[]>(() => {
    const list: ProspectRow[] = (contacts ?? []).map((c) => {
      const ctx = c.company_id ? companyContext.byCompany.get(c.company_id) : undefined;
      return {
        id: c.id,
        name: fullName(c),
        jobTitle: c.job_title,
        email: c.email,
        phone: c.mobile_phone ?? c.phone,
        companyId: c.company_id,
        companyName: ctx?.companyName ?? c.company_name,
        assignedTo: c.assigned_to,
        services: ctx?.services ?? [],
        dealsCount: ctx?.dealsCount ?? 0,
        totalValue: ctx?.totalValue ?? 0,
        lastDate: ctx?.lastDate ?? null,
        isPrimary: companyContext.primaryIds.has(c.id),
      };
    });

    const term = search.trim().toLowerCase();
    const filtered = term
      ? list.filter(
          (r) =>
            r.name.toLowerCase().includes(term) ||
            (r.companyName ?? "").toLowerCase().includes(term) ||
            (r.email ?? "").toLowerCase().includes(term) ||
            (r.jobTitle ?? "").toLowerCase().includes(term) ||
            r.services.some((s) => s.toLowerCase().includes(term)),
        )
      : list;

    return filtered.sort(
      (a, b) =>
        Number(b.isPrimary) - Number(a.isPrimary) ||
        b.totalValue - a.totalValue ||
        a.name.localeCompare(b.name, "pt-BR"),
    );
  }, [contacts, companyContext, search]);

  const companiesCount = companyContext.byCompany.size;
  const totalValue = [...companyContext.byCompany.values()].reduce(
    (acc, c) => acc + c.totalValue,
    0,
  );

  const selectedIds = useMemo(
    () => rows.filter((r) => selected.has(r.id)).map((r) => r.id),
    [rows, selected],
  );
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggleAll = () => {
    setSelected((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        for (const r of rows) next.delete(r.id);
        return next;
      }
      return new Set([...prev, ...rows.map((r) => r.id)]);
    });
  };

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const serviceLabel =
    serviceIds.length === 0
      ? "Todos os serviços"
      : serviceIds
          .map((id) => (services ?? []).find((s) => s.id === id)?.name ?? "Serviço")
          .join(", ");
  const periodLabel = describeRange(period);
  const suggestedQueueName = `Base · ${OUTCOME_LABEL[outcome]} · ${
    serviceIds.length === 0 ? "Todos os serviços" : serviceLabel
  }`.slice(0, 120);

  const copyNames = async () => {
    if (rows.length === 0) return;
    try {
      await navigator.clipboard.writeText(rows.map((r) => r.name).join("\n"));
      toast.success(`${rows.length} nome(s) copiado(s)`);
    } catch {
      toast.error("Não foi possível copiar a lista");
    }
  };

  const exportCsv = () => {
    if (rows.length === 0) return;
    const header = [
      "Contato",
      "Cargo",
      "Empresa",
      "E-mail",
      "Telefone",
      "Serviços",
      "Negócios",
      "Valor total",
      "Última data",
    ];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const body = rows.map((r) =>
      [
        r.name,
        r.jobTitle ?? "",
        r.companyName ?? "",
        r.email ?? "",
        r.phone ?? "",
        r.services.join("; "),
        String(r.dealsCount),
        String(r.totalValue),
        r.lastDate ? new Date(r.lastDate).toISOString().slice(0, 10) : "",
      ]
        .map(esc)
        .join(","),
    );
    const csv = [header.map(esc).join(","), ...body].join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `base-${outcome}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <AtsSectionHeader
        title="Base de prospecção"
        description="Monte listas de contatos a partir dos negócios já cadastrados — por resultado, serviços e período — e trabalhe em fila."
      />

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="base-outcome">Resultado do negócio</Label>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as Outcome)}>
              <SelectTrigger id="base-outcome">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(OUTCOME_LABEL) as Outcome[]).map((o) => (
                  <SelectItem key={o} value={o}>
                    {OUTCOME_LABEL[o]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="base-service">Serviços</Label>
            <AutocompleteChips
              value={serviceIds}
              onChange={setServiceIds}
              options={serviceOptions}
              allowCustom={false}
              placeholder="Todos os serviços"
              emptyLabel="Nenhum serviço encontrado"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="base-period">Período</Label>
            <DateRangeFilter className="w-full" value={period} onChange={setPeriod} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Contatos na lista" value={String(rows.length)} />
        <MetricCard label="Empresas consideradas" value={String(companiesCount)} />
        <MetricCard label="Valor total" value={formatCurrency(totalValue)} />
      </div>

      {(deals?.length ?? 0) >= DEAL_LIMIT ? (
        <p className="text-xs text-muted-foreground">
          Exibindo os {DEAL_LIMIT} negócios mais recentes do filtro. Refine período ou serviços para
          uma lista completa.
        </p>
      ) : null}

      <FilterBar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Filtrar por contato, empresa, cargo, e-mail ou serviço…",
        }}
        chips={
          <>
            <Badge variant="secondary">{OUTCOME_LABEL[outcome]}</Badge>
            <Badge variant="outline">{serviceLabel}</Badge>
            <Badge variant="outline">{periodLabel}</Badge>
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={copyNames} disabled={rows.length === 0}>
              <Copy className="mr-2 h-4 w-4" /> Copiar nomes
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Exportar CSV
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : isError || contactsError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Não foi possível montar a lista</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Falha ao consultar a base."}
            </p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Database}
          title="Nenhum contato encontrado"
          description="Ajuste o resultado, os serviços ou o período para extrair uma lista de prospecção da sua base."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-3 border-b px-4 py-2.5">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
                aria-label="Selecionar todos os contatos"
              />
              <span className="text-xs text-muted-foreground">
                {selectedIds.length > 0
                  ? `${selectedIds.length} selecionado(s)`
                  : `${rows.length} contato(s)`}
              </span>
            </div>
            <div className="divide-y">
              {rows.map((r) => (
                <div key={r.id} className="flex items-start gap-3 px-4 py-3">
                  <Checkbox
                    className="mt-1"
                    checked={selected.has(r.id)}
                    onCheckedChange={() => toggleOne(r.id)}
                    aria-label={`Selecionar ${r.name}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to="/contacts/$id"
                        params={{ id: r.id }}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {r.name}
                      </Link>
                      {r.isPrimary ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Contato principal
                        </Badge>
                      ) : null}
                      <AssigneeCell assignedTo={r.assignedTo} />
                      {!r.email && !r.phone ? (
                        <Badge variant="outline" className="text-[10px]">
                          sem canal
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[r.jobTitle, r.companyName].filter(Boolean).join(" · ") || "—"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[r.email, r.phone].filter(Boolean).join(" · ") || "sem e-mail/telefone"}
                    </p>
                    {r.services.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.services.slice(0, 3).map((s) => (
                          <Badge key={s} variant="secondary" className="font-normal">
                            {s}
                          </Badge>
                        ))}
                        {r.services.length > 3 ? (
                          <Badge variant="outline">+{r.services.length - 3}</Badge>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <div className="text-sm">{formatCurrency(r.totalValue)}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.dealsCount} negócio(s)
                      {r.lastDate ? ` · ${formatCompactDate(r.lastDate)}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedIds.length > 0 ? (
        <BulkActionBar count={selectedIds.length} onClear={() => setSelected(new Set())}>
          {canQueue ? (
            <Button size="sm" onClick={() => setQueueOpen(true)}>
              <ListPlus className="mr-2 h-4 w-4" /> Criar fila de prospecção
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              Sem permissão para criar filas de prospecção.
            </span>
          )}
        </BulkActionBar>
      ) : null}

      <CreateQueueFromBaseDialog
        open={queueOpen}
        onOpenChange={setQueueOpen}
        ids={selectedIds}
        suggestedName={suggestedQueueName}
        onCreated={() => setSelected(new Set())}
      />
    </div>
  );
}
