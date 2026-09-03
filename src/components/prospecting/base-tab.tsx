/**
 * Aba "Base" — extração de listas a partir de entidades já cadastradas.
 *
 * Permite montar listas de clientes derivadas de negócios (ganhos, perdidos
 * ou em aberto), filtrando por serviço do catálogo e período. Exemplos:
 *  - clientes de negócios ganhos por serviço;
 *  - clientes de negócios de "Fábrica de Software" perdidos nos últimos 180 dias.
 *
 * Componente de apresentação + leitura via cliente Supabase (RLS aplicada).
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, AtsSectionHeader, FilterBar, MetricCard } from "@/components/ats/ui";
import { Database, Download, Copy, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/crm";
import { formatCompactDate } from "@/lib/format/compact-date";

type Outcome = "won" | "lost" | "open";

const OUTCOME_LABEL: Record<Outcome, string> = {
  won: "Ganhos",
  lost: "Perdidos",
  open: "Em aberto",
};

type ServiceOption = { id: string; name: string };

type DealRow = {
  id: string;
  name: string | null;
  value: number | null;
  stage: string | null;
  closed_at: string | null;
  lost_at: string | null;
  updated_at: string | null;
  companies: { id: string; name: string | null; domain: string | null; city: string | null } | null;
  primary_contact: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
  deal_line_items: { service_catalog_id: string | null; name: string | null }[] | null;
};

type ExtractedRow = {
  key: string;
  clientName: string;
  companyId: string | null;
  contactName: string | null;
  email: string | null;
  services: string[];
  dealsCount: number;
  totalValue: number;
  lastDate: string | null;
};

const sel = (s: string): string => s;

function contactName(c: DealRow["primary_contact"]): string | null {
  if (!c) return null;
  const n = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return n || null;
}

function dealDate(d: DealRow, outcome: Outcome): string | null {
  if (outcome === "lost") return d.lost_at ?? d.closed_at ?? d.updated_at ?? null;
  if (outcome === "won") return d.closed_at ?? d.updated_at ?? null;
  return d.updated_at ?? null;
}

export function BaseTab() {
  const [outcome, setOutcome] = useState<Outcome>("won");
  const [serviceId, setServiceId] = useState<string>("all");
  const [period, setPeriod] = useState<DateRangeValue>({ preset: "last_180d" });
  const [search, setSearch] = useState("");

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

  const {
    data: deals,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["prospecting", "base", "deals", outcome, serviceId, period],
    queryFn: async (): Promise<DealRow[]> => {
      const projection = sel(
        "id, name, value, stage, closed_at, lost_at, updated_at," +
          " companies(id, name, domain, city)," +
          " primary_contact:contacts!deals_primary_contact_id_fkey(id, first_name, last_name, email)," +
          (serviceId === "all"
            ? " deal_line_items(service_catalog_id, name)"
            : " deal_line_items!inner(service_catalog_id, name)"),
      );

      let query = supabase.from("deals").select(projection).is("deleted_at", null);

      if (outcome === "won") query = query.eq("stage", "won");
      else if (outcome === "lost") query = query.eq("stage", "lost");
      else query = query.not("stage", "in", "(won,lost)");

      if (serviceId !== "all") {
        query = query.eq("deal_line_items.service_catalog_id", serviceId);
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
        .limit(1000)
        .returns<DealRow[]>();
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const rows = useMemo<ExtractedRow[]>(() => {
    const map = new Map<string, ExtractedRow>();
    for (const d of deals ?? []) {
      const company = d.companies;
      const person = contactName(d.primary_contact);
      const name = company?.name ?? person ?? d.name ?? "Sem identificação";
      const key = company?.id ?? d.primary_contact?.id ?? d.id;
      const date = dealDate(d, outcome);
      const services = (d.deal_line_items ?? [])
        .map((li) => li.name)
        .filter((n): n is string => !!n);

      const existing = map.get(key);
      if (existing) {
        existing.dealsCount += 1;
        existing.totalValue += Number(d.value ?? 0);
        for (const s of services) if (!existing.services.includes(s)) existing.services.push(s);
        if (date && (!existing.lastDate || date > existing.lastDate)) existing.lastDate = date;
        if (!existing.email && d.primary_contact?.email) existing.email = d.primary_contact.email;
        if (!existing.contactName && person) existing.contactName = person;
      } else {
        map.set(key, {
          key,
          clientName: name,
          companyId: company?.id ?? null,
          contactName: person,
          email: d.primary_contact?.email ?? null,
          services: [...new Set(services)],
          dealsCount: 1,
          totalValue: Number(d.value ?? 0),
          lastDate: date,
        });
      }
    }
    const term = search.trim().toLowerCase();
    const list = [...map.values()];
    const filtered = term
      ? list.filter(
          (r) =>
            r.clientName.toLowerCase().includes(term) ||
            (r.contactName ?? "").toLowerCase().includes(term) ||
            (r.email ?? "").toLowerCase().includes(term) ||
            r.services.some((s) => s.toLowerCase().includes(term)),
        )
      : list;
    return filtered.sort((a, b) => b.totalValue - a.totalValue);
  }, [deals, outcome, search]);

  const totalValue = rows.reduce((acc, r) => acc + r.totalValue, 0);
  const totalDeals = rows.reduce((acc, r) => acc + r.dealsCount, 0);

  const serviceLabel =
    serviceId === "all"
      ? "Todos os serviços"
      : ((services ?? []).find((s) => s.id === serviceId)?.name ?? "Serviço");
  const periodLabel = describeRange(period);

  const copyNames = async () => {
    if (rows.length === 0) return;
    try {
      await navigator.clipboard.writeText(rows.map((r) => r.clientName).join("\n"));
      toast.success(`${rows.length} nome(s) copiado(s)`);
    } catch {
      toast.error("Não foi possível copiar a lista");
    }
  };

  const exportCsv = () => {
    if (rows.length === 0) return;
    const header = [
      "Cliente",
      "Contato",
      "E-mail",
      "Serviços",
      "Negócios",
      "Valor total",
      "Última data",
    ];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const body = rows.map((r) =>
      [
        r.clientName,
        r.contactName ?? "",
        r.email ?? "",
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
        title="Base de clientes"
        description="Extraia listas de clientes a partir dos negócios já cadastrados — por resultado, serviço e período."
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
            <Label htmlFor="base-service">Serviço</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger id="base-service">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os serviços</SelectItem>
                {(services ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="base-period">Período</Label>
            <DateRangeFilter className="w-full" value={period} onChange={setPeriod} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Clientes na lista" value={String(rows.length)} />
        <MetricCard label="Negócios considerados" value={String(totalDeals)} />
        <MetricCard label="Valor total" value={formatCurrency(totalValue)} />
      </div>

      <FilterBar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Filtrar por cliente, contato, e-mail ou serviço…",
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
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Não foi possível montar a lista</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Falha ao consultar os negócios."}
            </p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Database}
          title="Nenhum cliente encontrado"
          description="Ajuste o resultado, o serviço ou o período para extrair uma lista da sua base."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden md:table-cell">Contato</TableHead>
                    <TableHead className="hidden lg:table-cell">Serviços</TableHead>
                    <TableHead className="text-right">Negócios</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="hidden sm:table-cell">Última data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="font-medium">
                        {r.companyId ? (
                          <Link
                            to="/companies/$id"
                            params={{ id: r.companyId }}
                            className="hover:underline"
                          >
                            {r.clientName}
                          </Link>
                        ) : (
                          r.clientName
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {r.contactName ?? "—"}
                        {r.email ? <div className="text-xs">{r.email}</div> : null}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {r.services.length === 0 ? (
                            <span className="text-sm text-muted-foreground">—</span>
                          ) : (
                            r.services.slice(0, 3).map((s) => (
                              <Badge key={s} variant="secondary" className="font-normal">
                                {s}
                              </Badge>
                            ))
                          )}
                          {r.services.length > 3 ? (
                            <Badge variant="outline">+{r.services.length - 3}</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{r.dealsCount}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.totalValue)}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {r.lastDate ? formatCompactDate(r.lastDate) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
