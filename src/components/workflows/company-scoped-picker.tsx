// Seletor em dois estágios usado em "Contrato principal" (`parent_contract_id`)
// e "Negócio" (`deal_id`):
// 1) busca de empresa por nome; 2) lista lateral de registros daquela empresa.
// Ao manter o mouse (ou foco) 2s sobre um item, exibe abaixo do nome um card
// translúcido com os detalhes (vigência/valor no contrato; etapa/valor/previsão
// no negócio).
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Check, Building2, FileText, Handshake } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchCompanies, searchContracts, searchDeals } from "@/lib/workflow-refs.functions";
import { CONTRACT_FIELD_OPTIONS } from "@/lib/contracts/workflow-field-meta";
import { DEAL_STAGES } from "@/lib/crm";

export type CompanyScopedKind = "contract" | "deal";

export interface CompanyScopedItem {
  id: string;
  name: string;
  status?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  monthly_value?: number | null;
  total_value?: number | null;
  value?: number | null;
  expected_close_date?: string | null;
  currency?: string | null;
}

const HOVER_DELAY_MS = 2000;

function contractStatusLabel(status?: string | null): string {
  if (!status) return "Sem status";
  return CONTRACT_FIELD_OPTIONS.status?.find((o) => o.value === status)?.label ?? status;
}

function dealStageLabel(stage?: string | null): string {
  if (!stage) return "Sem etapa";
  return DEAL_STAGES.find((s) => s.value === stage)?.label ?? stage;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function fmtMoney(value?: number | null, currency?: string | null): string | null {
  if (value == null) return null;
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency || "BRL",
    }).format(value);
  } catch {
    return String(value);
  }
}

const COPY: Record<
  CompanyScopedKind,
  { listLabel: string; withCompany: (name: string) => string; empty: string; error: string }
> = {
  contract: {
    listLabel: "Contratos",
    withCompany: (name) => `Contratos de ${name}`,
    empty: "Esta empresa não possui contratos.",
    error: "Erro ao buscar contratos.",
  },
  deal: {
    listLabel: "Negócios",
    withCompany: (name) => `Negócios de ${name}`,
    empty: "Esta empresa não possui negócios.",
    error: "Erro ao buscar negócios.",
  },
};

export function CompanyScopedPicker({
  kind,
  value,
  onSelect,
}: {
  kind: CompanyScopedKind;
  value: string;
  onSelect: (id: string) => void;
}) {
  const fetchCompanies = useServerFn(searchCompanies);
  const fetchContracts = useServerFn(searchContracts);
  const fetchDeals = useServerFn(searchDeals);

  const [rawQ, setRawQ] = useState("");
  const [q, setQ] = useState("");
  const [company, setCompany] = useState<{ id: string; name: string } | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copy = COPY[kind];

  useEffect(() => {
    const t = setTimeout(() => setQ(rawQ.trim()), 200);
    return () => clearTimeout(t);
  }, [rawQ]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const companies = useQuery({
    queryKey: ["wf-scoped-picker-companies", q],
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    queryFn: async () => await fetchCompanies({ data: { q: q || undefined } }),
  });

  const records = useQuery({
    queryKey: ["wf-scoped-picker-records", kind, company?.id],
    enabled: !!company?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const input = { data: { company_id: company!.id } };
      const rows = kind === "deal" ? await fetchDeals(input) : await fetchContracts(input);
      return rows as CompanyScopedItem[];
    },
  });

  const companyItems = (companies.data ?? []) as Array<{ id: string; name: string }>;
  const recordItems = useMemo(() => records.data ?? [], [records.data]);

  const startHover = (id: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHoverId(id), HOVER_DELAY_MS);
  };
  const endHover = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHoverId(null);
  };

  const subtitleFor = (it: CompanyScopedItem) =>
    kind === "deal" ? dealStageLabel(it.status) : contractStatusLabel(it.status);

  return (
    <div className="flex flex-col divide-border/60 sm:flex-row sm:divide-x">
      {/* Coluna 1 — busca de empresa */}
      <div className="min-w-0 sm:w-1/2">
        <div className="border-b border-border/60 p-2">
          <Input
            value={rawQ}
            onChange={(e) => setRawQ(e.target.value)}
            placeholder="Buscar empresa por nome..."
            aria-label="Buscar empresa por nome"
            className="h-8"
          />
        </div>
        <ul className="max-h-64 overflow-y-auto py-1" aria-label="Empresas">
          {companies.isFetching && companyItems.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">Buscando…</li>
          )}
          {companies.isError && (
            <li className="px-3 py-6 text-center text-xs text-destructive">
              Erro ao buscar empresas.
            </li>
          )}
          {!companies.isFetching && !companies.isError && companyItems.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">
              Nenhuma empresa encontrada.
            </li>
          )}
          {companyItems.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setCompany(c)}
                aria-pressed={company?.id === c.id}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs",
                  "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  company?.id === c.id && "bg-accent text-accent-foreground",
                )}
              >
                <Building2 className="h-3.5 w-3.5 shrink-0 opacity-60" />
                <span className="truncate">{c.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Coluna 2 — registros da empresa */}
      <div className="min-w-0 border-t border-border/60 sm:w-1/2 sm:border-t-0">
        <div className="border-b border-border/60 px-3 py-2 text-[11px] font-medium text-muted-foreground">
          {company ? copy.withCompany(company.name) : copy.listLabel}
        </div>
        <ul className="max-h-64 overflow-y-auto py-1" aria-label={copy.listLabel}>
          {!company && (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">
              Selecione uma empresa para ver os registros.
            </li>
          )}
          {company && records.isFetching && (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">Buscando…</li>
          )}
          {company && records.isError && (
            <li className="px-3 py-6 text-center text-xs text-destructive">{copy.error}</li>
          )}
          {company && !records.isFetching && !records.isError && recordItems.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">{copy.empty}</li>
          )}
          {recordItems.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => onSelect(it.id)}
                onMouseEnter={() => startHover(it.id)}
                onMouseLeave={endHover}
                onFocus={() => startHover(it.id)}
                onBlur={endHover}
                className={cn(
                  "flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs",
                  "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <Check
                  className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", value === it.id ? "" : "opacity-0")}
                />
                <span className="min-w-0">
                  <span className="block truncate">{it.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {subtitleFor(it)}
                  </span>
                </span>
              </button>
              {hoverId === it.id && (
                <div
                  role="tooltip"
                  className="pointer-events-none mx-3 mb-1 mt-1 rounded-md border border-border bg-popover/80 p-2.5 text-[11px] text-popover-foreground shadow-sm backdrop-blur-sm"
                >
                  {kind === "deal" ? (
                    <>
                      <Handshake className="mb-1 h-3.5 w-3.5 opacity-60" />
                      <p>
                        <span className="text-muted-foreground">Etapa: </span>
                        {dealStageLabel(it.status)}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Valor: </span>
                        {fmtMoney(it.value, it.currency) ?? "não informado"}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Previsão: </span>
                        {fmtDate(it.expected_close_date)}
                      </p>
                    </>
                  ) : (
                    <>
                      <FileText className="mb-1 h-3.5 w-3.5 opacity-60" />
                      <p>
                        <span className="text-muted-foreground">Vigência: </span>
                        {fmtDate(it.starts_at)} – {fmtDate(it.ends_at)}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Valor: </span>
                        {fmtMoney(it.monthly_value, it.currency)
                          ? `${fmtMoney(it.monthly_value, it.currency)} / mês`
                          : (fmtMoney(it.total_value, it.currency) ?? "não informado")}
                      </p>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
