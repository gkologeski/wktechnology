// Campos da alocação: contrato de compra e projeto com busca, e rateio por empresa cliente.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { listOwnContractingPurchaseContracts } from "@/lib/contracts.functions";
import { listProjects } from "@/lib/projects.functions";
import { searchCompanies } from "@/lib/workflow-refs.functions";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { groupProjectsByContract, splitsError } from "@/lib/people/allocation-rules";

type Opt = { id: string; label: string; hint?: string | null };

function SearchCombo({
  id,
  value,
  placeholder,
  emptyLabel,
  noneLabel,
  groups,
  loading,
  onChange,
  onSearch,
  selectedLabel,
}: {
  id?: string;
  value: string | null;
  placeholder: string;
  emptyLabel: string;
  noneLabel?: string;
  groups: Array<{ heading?: string; items: Opt[] }>;
  loading?: boolean;
  onChange: (v: string | null, label?: string) => void;
  onSearch?: (q: string) => void;
  selectedLabel?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const all = groups.flatMap((g) => g.items);
  const current = selectedLabel ?? all.find((o) => o.id === value)?.label ?? null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{current ?? (loading ? "Carregando…" : placeholder)}</span>
          <ChevronsUpDown aria-hidden="true" className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(28rem,90vw)] p-0">
        <Command shouldFilter={!onSearch}>
          <CommandInput placeholder="Buscar…" onValueChange={onSearch} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            {noneLabel ? (
              <CommandGroup>
                <CommandItem
                  value={`__none ${noneLabel}`}
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  {noneLabel}
                </CommandItem>
              </CommandGroup>
            ) : null}
            {groups
              .filter((g) => g.items.length > 0)
              .map((g, i) => (
                <CommandGroup key={g.heading ?? i} heading={g.heading}>
                  {g.items.map((o) => (
                    <CommandItem
                      key={o.id}
                      value={`${o.label} ${o.id}`}
                      onSelect={() => {
                        onChange(o.id, o.label);
                        setOpen(false);
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                      {o.hint ? (
                        <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                          {o.hint}
                        </span>
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function PurchaseContractSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const listFn = useServerFn(listOwnContractingPurchaseContracts);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["allocations-purchase-contracts", "main"],
    queryFn: () => listFn({ data: {} }),
    staleTime: 60_000,
  });
  const items = (
    rows as Array<{ id: string; number: string | null; title: string; company_name: string | null }>
  ).map((c) => ({
    id: c.id,
    label: `${c.number ? `${c.number} · ` : ""}${c.title}`,
    hint: c.company_name,
  }));
  return (
    <SearchCombo
      value={value}
      onChange={onChange}
      loading={isLoading}
      placeholder="Selecionar contrato de compra…"
      emptyLabel="Nenhum contrato de compra encontrado."
      noneLabel="Sem contrato de compra"
      groups={[{ items }]}
    />
  );
}

export function ProjectSelect({
  value,
  onChange,
  contractId,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  contractId: string | null;
}) {
  const listFn = useServerFn(listProjects);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["allocations-projects"],
    queryFn: () => listFn({ data: {} }),
    staleTime: 60_000,
  });
  const projects = rows as Array<{ id: string; name: string; contract_id?: string | null }>;
  const { fromContract, others } = groupProjectsByContract(projects, contractId);
  const toOpt = (p: { id: string; name: string }) => ({ id: p.id, label: p.name });
  return (
    <SearchCombo
      value={value}
      onChange={onChange}
      loading={isLoading}
      placeholder="Selecionar projeto…"
      emptyLabel="Nenhum projeto encontrado."
      noneLabel="Sem projeto"
      groups={[
        { heading: "Projetos do contrato de prestação", items: fromContract.map(toOpt) },
        {
          heading: fromContract.length > 0 ? "Outros projetos" : undefined,
          items: others.map(toOpt),
        },
      ]}
    />
  );
}

export type SplitDraft = { company_id: string; company_name: string | null; pct: string };

function CompanyPicker({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string | null;
  onChange: (id: string, name: string | null) => void;
}) {
  const fn = useServerFn(searchCompanies);
  const [q, setQ] = useState("");
  const term = useDebouncedValue(q, 250);
  const { data = [], isLoading } = useQuery({
    queryKey: ["allocation-split-companies", term],
    queryFn: () => fn({ data: { q: term || undefined } }),
    staleTime: 60_000,
    placeholderData: (p) => p,
  });
  return (
    <SearchCombo
      value={value || null}
      selectedLabel={label}
      onChange={(id, name) => id && onChange(id, name ?? null)}
      onSearch={setQ}
      loading={isLoading}
      placeholder="Selecionar empresa…"
      emptyLabel="Nenhuma empresa encontrada."
      groups={[{ items: data.map((c) => ({ id: c.id, label: c.name })) }]}
    />
  );
}

export function CompanySplitEditor({
  value,
  onChange,
  unavailable,
}: {
  value: SplitDraft[];
  onChange: (v: SplitDraft[]) => void;
  unavailable?: boolean;
}) {
  const parsed = value.map((s) => ({ company_id: s.company_id, pct: Number(s.pct) || 0 }));
  const error = value.length ? splitsError(parsed) : null;
  const total = parsed.reduce((a, s) => a + s.pct, 0);
  const set = (i: number, patch: Partial<SplitDraft>) =>
    onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label>Rateio por cliente (opcional)</Label>
          <p className="text-xs text-muted-foreground">
            Divida a alocação entre empresas clientes. A soma precisa ser 100%.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={unavailable}
          onClick={() =>
            onChange([
              ...value,
              { company_id: "", company_name: null, pct: value.length ? "" : "100" },
            ])
          }
        >
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Empresa
        </Button>
      </div>
      {unavailable ? (
        <p className="text-xs text-muted-foreground" role="status">
          O rateio fica disponível depois que esta versão for aplicada.
        </p>
      ) : null}
      {value.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <CompanyPicker
              value={s.company_id}
              label={s.company_name}
              onChange={(id, name) => set(i, { company_id: id, company_name: name })}
            />
          </div>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.01"
            className="w-24"
            aria-label={`Percentual da empresa ${i + 1}`}
            value={s.pct}
            onChange={(e) => set(i, { pct: e.target.value })}
          />
          <span className="text-sm text-muted-foreground">%</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remover empresa ${i + 1} do rateio`}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {value.length > 0 ? (
        <p
          className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
          aria-live="polite"
        >
          {error ?? `Total: ${Math.round(total * 100) / 100}%`}
        </p>
      ) : null}
    </div>
  );
}
