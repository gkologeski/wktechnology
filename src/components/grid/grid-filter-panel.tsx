import { useState } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { OwnerFilter } from "@/components/owner-filter";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import {
  activeCount,
  chipText,
  fieldOptions,
  isActive,
  type GridFilterField,
} from "@/lib/grid-filters";
import type { GridFiltersController } from "@/hooks/use-grid-filters";
import { IsoDateRangePicker } from "@/components/iso-date-range-picker";
import type { GridFilterOption } from "@/lib/grid-filters";

/** Busca digitável com seleção múltipla em pills removíveis. */
function SearchablePills({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: GridFilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const term = q.trim().toLocaleLowerCase("pt-BR");
  const matches = term
    ? options
        .filter((o) => !selected.includes(o.value))
        .filter((o) => o.label.toLocaleLowerCase("pt-BR").includes(term))
        .slice(0, 8)
    : [];
  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((v) => (
            <span
              key={v}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs text-accent-foreground"
            >
              <span className="truncate">{labelOf(v)}</span>
              <button
                type="button"
                onClick={() => onChange(selected.filter((x) => x !== v))}
                aria-label={`Remover ${labelOf(v)}`}
                className="rounded-full p-0.5 hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Digite parte do nome…"
        aria-label={`Buscar ${label}`}
        className="h-9"
      />
      {term && (
        <ul
          role="listbox"
          aria-label={`Sugestões de ${label}`}
          className="rounded-md border bg-popover p-1"
        >
          {matches.length === 0 ? (
            <li className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum resultado.</li>
          ) : (
            matches.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    onChange([...selected, o.value]);
                    setQ("");
                  }}
                  className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                >
                  {o.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export function FieldEditor<T>({
  ctl,
  field,
}: {
  ctl: GridFiltersController<T>;
  field: GridFilterField<T>;
}) {
  const v = ctl.state[field.key];
  if (field.type === "owner") {
    const value = v?.kind === "owner" ? v : { ownerIds: [], includeUnassigned: false };
    return (
      <OwnerFilter
        value={value}
        onChange={(next) =>
          ctl.setField(
            field.key,
            next.ownerIds.length || next.includeUnassigned ? { kind: "owner", ...next } : undefined,
          )
        }
      />
    );
  }
  if (field.type === "multi" && field.searchable) {
    const selected = v?.kind === "in" ? v.values : [];
    return (
      <SearchablePills
        label={field.label}
        options={fieldOptions(field, ctl.rows)}
        selected={selected}
        onChange={(next) =>
          ctl.setField(field.key, next.length ? { kind: "in", values: next } : undefined)
        }
      />
    );
  }
  if (field.type === "multi") {
    const selected = v?.kind === "in" ? v.values : [];
    const opts = fieldOptions(field, ctl.rows);
    if (opts.length === 0)
      return <p className="text-xs text-muted-foreground">Sem opções nesta lista.</p>;
    return (
      <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
        {opts.map((o) => {
          const id = `gf-${field.key}-${o.value}`;
          const on = selected.includes(o.value);
          return (
            <div key={o.value} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={on}
                onCheckedChange={(c) => {
                  const next = c ? [...selected, o.value] : selected.filter((x) => x !== o.value);
                  ctl.setField(field.key, next.length ? { kind: "in", values: next } : undefined);
                }}
              />
              <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
                {o.label}
              </Label>
            </div>
          );
        })}
      </div>
    );
  }
  const r: { from?: string; to?: string } = v?.kind === "range" ? v : {};
  const type = field.type === "date" ? "date" : "number";
  const set = (from?: string, to?: string) =>
    ctl.setField(
      field.key,
      from || to ? { kind: "range", from: from || undefined, to: to || undefined } : undefined,
    );
  if (type === "date") {
    return (
      <IsoDateRangePicker
        from={r.from}
        to={r.to}
        size="sm"
        className="w-full justify-start"
        ariaLabel={field.label}
        placeholder="Qualquer data"
        onChange={(x) => set(x.from, x.to)}
        onClear={() => set(undefined, undefined)}
      />
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <Input
        type={type}
        aria-label={`${field.label}: mínimo`}
        placeholder="Mínimo"
        value={r.from ?? ""}
        onChange={(e) => set(e.target.value, r.to)}
        className="h-9"
      />
      <Input
        type={type}
        aria-label={`${field.label}: máximo`}
        placeholder="Máximo"
        value={r.to ?? ""}
        onChange={(e) => set(r.from, e.target.value)}
        className="h-9"
      />
    </div>
  );
}

/** Botão "Filtros" + painel lateral + etiquetas dos filtros aplicados. */
export function GridFilterPanel<T>({ ctl }: { ctl: GridFiltersController<T> }) {
  const [open, setOpen] = useState(false);
  const count = activeCount(ctl.state);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <Filter className="mr-1.5 h-4 w-4" aria-hidden />
        Filtros
        {count > 0 && (
          <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[11px] leading-4 text-primary-foreground">
            {count}
          </span>
        )}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
          <SheetHeader className="border-b p-5">
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription>Aplicados na lista ao lado.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {ctl.fields.map((f) => (
              <section key={f.key} aria-label={f.label} className="space-y-2">
                <h3 className="text-sm font-semibold">{f.label}</h3>
                <FieldEditor ctl={ctl} field={f} />
              </section>
            ))}
          </div>
          <SheetFooter className="flex-row items-center justify-between border-t p-4 sm:justify-between">
            <Button variant="ghost" size="sm" onClick={ctl.clear} disabled={count === 0}>
              Limpar tudo
            </Button>
            <Button size="sm" onClick={() => setOpen(false)}>
              Ver {ctl.filtered.length} {ctl.filtered.length === 1 ? "resultado" : "resultados"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function GridFilterChips<T>({ ctl }: { ctl: GridFiltersController<T> }) {
  const { byId } = useWorkspaceMembers();
  const active = ctl.fields.filter((f) => isActive(ctl.state[f.key]));
  if (active.length === 0) return null;
  return (
    <div className="flex w-full flex-wrap items-center gap-1.5" aria-label="Filtros aplicados">
      {active.map((f) => (
        <span
          key={f.key}
          className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground"
        >
          {chipText(f, ctl.state[f.key]!, ctl.rows, (id) => byId.get(id)?.full_name ?? "Usuário")}
          <button
            type="button"
            onClick={() => ctl.setField(f.key, undefined)}
            aria-label={`Remover filtro ${f.label}`}
            className="rounded-full p-0.5 hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      ))}
      <Button variant="link" size="sm" className="h-auto px-1 text-xs" onClick={ctl.clear}>
        Limpar filtros
      </Button>
    </div>
  );
}
