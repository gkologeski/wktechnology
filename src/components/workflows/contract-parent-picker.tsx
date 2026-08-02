// Seletor de "Contrato principal" em dois estágios:
// 1) busca de empresa por nome; 2) lista lateral de contratos da empresa.
// Ao manter o mouse (ou foco) 2s sobre um contrato, exibe um card translúcido
// com a vigência e o valor do contrato.
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Check, Building2, FileText } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchCompanies, searchContracts } from "@/lib/workflow-refs.functions";
import { CONTRACT_FIELD_OPTIONS } from "@/lib/contracts/workflow-field-meta";

export interface ContractItem {
  id: string;
  name: string;
  status?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  monthly_value?: number | null;
  total_value?: number | null;
  currency?: string | null;
}

const HOVER_DELAY_MS = 2000;

function statusLabel(status?: string | null): string {
  if (!status) return "Sem status";
  return CONTRACT_FIELD_OPTIONS.status?.find((o) => o.value === status)?.label ?? status;
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

export function ContractParentPicker({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (id: string) => void;
}) {
  const fetchCompanies = useServerFn(searchCompanies);
  const fetchContracts = useServerFn(searchContracts);

  const [rawQ, setRawQ] = useState("");
  const [q, setQ] = useState("");
  const [company, setCompany] = useState<{ id: string; name: string } | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    queryKey: ["wf-contract-picker-companies", q],
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    queryFn: async () => await fetchCompanies({ data: { q: q || undefined } }),
  });

  const contracts = useQuery({
    queryKey: ["wf-contract-picker-contracts", company?.id],
    enabled: !!company?.id,
    staleTime: 30_000,
    queryFn: async () =>
      (await fetchContracts({ data: { company_id: company!.id } })) as ContractItem[],
  });

  const companyItems = (companies.data ?? []) as Array<{ id: string; name: string }>;
  const contractItems = useMemo(() => contracts.data ?? [], [contracts.data]);

  const startHover = (id: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHoverId(id), HOVER_DELAY_MS);
  };
  const endHover = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHoverId(null);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:divide-x divide-border/60">
      {/* Coluna 1 — busca de empresa */}
      <div className="sm:w-1/2 min-w-0">
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

      {/* Coluna 2 — contratos da empresa */}
      <div className="sm:w-1/2 min-w-0 border-t border-border/60 sm:border-t-0">
        <div className="border-b border-border/60 px-3 py-2 text-[11px] font-medium text-muted-foreground">
          {company ? `Contratos de ${company.name}` : "Contratos"}
        </div>
        <ul className="max-h-64 overflow-y-auto py-1" aria-label="Contratos da empresa">
          {!company && (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">
              Selecione uma empresa para ver os contratos.
            </li>
          )}
          {company && contracts.isFetching && (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">Buscando…</li>
          )}
          {company && contracts.isError && (
            <li className="px-3 py-6 text-center text-xs text-destructive">
              Erro ao buscar contratos.
            </li>
          )}
          {company && !contracts.isFetching && !contracts.isError && contractItems.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">
              Esta empresa não possui contratos.
            </li>
          )}
          {contractItems.map((it) => (
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
                    {statusLabel(it.status)}
                  </span>
                </span>
              </button>
              {hoverId === it.id && (
                <div
                  role="tooltip"
                  className="pointer-events-none mx-3 mb-1 mt-1 rounded-md border border-border bg-popover/80 p-2.5 text-[11px] text-popover-foreground shadow-sm backdrop-blur-sm"
                >
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
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
