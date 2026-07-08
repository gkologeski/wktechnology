// Editor de "Mais campos" para ações create_* do workflow.
// Permite adicionar qualquer campo da entidade alvo além dos já
// cobertos no formulário principal da ação. Persiste em action.extra_fields.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, ChevronDown, ChevronRight, Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { getEntityFieldCatalog, type EntityFieldDef } from "@/lib/entity-fields.functions";
import { TokenInput, TokenTextarea } from "./token-input";
import { useReferenceLabels } from "./use-reference-labels";

type EntityName =
  | "leads"
  | "contacts"
  | "companies"
  | "deals"
  | "tickets"
  | "activities";

interface Props {
  entity: EntityName;
  extraFields: Record<string, unknown> | undefined;
  hiddenKeys?: string[];
  onChange: (next: Record<string, unknown> | undefined) => void;
}

// Campos longos usam Textarea em vez de Input.
const LONG_TEXT_FIELDS = new Set([
  "description",
  "notes",
  "body",
  "summary",
  "comments",
]);

function coerceValue(field: EntityFieldDef, raw: unknown): unknown {
  if (raw === "" || raw === null || raw === undefined) return null;
  switch (field.type) {
    case "number": {
      if (typeof raw === "number") return raw;
      const n = Number(raw);
      return Number.isFinite(n) ? n : (raw as string);
    }
    case "boolean":
      return Boolean(raw);
    default:
      return raw;
  }
}

// Editor especial para o campo custom_fields (Record<string, unknown>).
function CustomFieldsEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (v: Record<string, string> | null) => void;
}) {
  const obj: Record<string, string> =
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>).map(([k, v]) => [
            k,
            typeof v === "string" ? v : v == null ? "" : JSON.stringify(v),
          ]),
        )
      : {};
  const entries = Object.entries(obj);
  return (
    <div className="space-y-1.5">
      {entries.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum par definido.</p>
      )}
      {entries.map(([k, v], idx) => (
        <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
          <Input
            value={k}
            placeholder="chave"
            onChange={(e) => {
              const next = { ...obj };
              delete next[k];
              next[e.target.value] = v;
              onChange(Object.keys(next).length ? next : null);
            }}
          />
          <Input
            value={v}
            placeholder="valor (aceita {{tokens}})"
            onChange={(e) => {
              const next = { ...obj, [k]: e.target.value };
              onChange(next);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remover par"
            onClick={() => {
              const next = { ...obj };
              delete next[k];
              onChange(Object.keys(next).length ? next : null);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={() => {
          const next = { ...obj, "": "" };
          onChange(next);
        }}
      >
        <Plus className="mr-1 h-3 w-3" /> Adicionar par
      </Button>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: EntityFieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const strVal = value == null ? "" : String(value);

  if (field.name === "custom_fields") {
    return (
      <CustomFieldsEditor
        value={value}
        onChange={(v) => onChange(v)}
      />
    );
  }

  if (field.type === "boolean") {
    return (
      <div className="flex h-9 items-center">
        <Switch
          checked={Boolean(value)}
          onCheckedChange={(c) => onChange(c)}
        />
      </div>
    );
  }

  if (field.type === "select" && field.options?.length) {
    return (
      <Select
        value={strVal || undefined}
        onValueChange={(v) => onChange(v)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecionar..." />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "number") {
    return (
      <Input
        type="number"
        value={strVal}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : coerceValue(field, e.target.value))
        }
        placeholder="0"
      />
    );
  }

  if (field.type === "date") {
    return (
      <Input
        type="datetime-local"
        value={
          typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)
            ? value.slice(0, 16)
            : ""
        }
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
      />
    );
  }

  if (LONG_TEXT_FIELDS.has(field.name)) {
    return (
      <Textarea
        rows={2}
        value={strVal}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Aceita {{tokens}}"
      />
    );
  }

  return (
    <Input
      value={strVal}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Aceita {{tokens}}"
    />
  );
}

export function ExtraFieldsEditor({ entity, extraFields, hiddenKeys, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const fetchCatalog = useServerFn(getEntityFieldCatalog);
  const { data, isLoading, error } = useQuery({
    queryKey: ["wf-entity-fields-full", entity],
    queryFn: () => fetchCatalog({ data: { entity } }),
    staleTime: 5 * 60_000,
  });

  const hidden = useMemo(() => new Set(hiddenKeys ?? []), [hiddenKeys]);
  const catalog = data?.fields ?? [];
  const byName = useMemo(() => {
    const m = new Map<string, EntityFieldDef>();
    for (const f of catalog) m.set(f.name, f);
    return m;
  }, [catalog]);

  const usedKeys = Object.keys(extraFields ?? {});
  const availableFields = catalog.filter(
    (f) => !hidden.has(f.name) && !usedKeys.includes(f.name),
  );

  const usedEntries: Array<[string, EntityFieldDef | undefined, unknown]> = usedKeys.map(
    (k) => [k, byName.get(k), (extraFields as Record<string, unknown>)[k]],
  );

  function setKey(key: string, value: unknown) {
    const next: Record<string, unknown> = { ...(extraFields ?? {}) };
    if (value === null || value === undefined) {
      // Preservar chave com null para permitir limpar campo explicitamente
      next[key] = null;
    } else {
      next[key] = value;
    }
    onChange(next);
  }

  function removeKey(key: string) {
    const next: Record<string, unknown> = { ...(extraFields ?? {}) };
    delete next[key];
    onChange(Object.keys(next).length ? next : undefined);
  }

  function addField(name: string) {
    const field = byName.get(name);
    const initial =
      field?.type === "boolean" ? false : field?.name === "custom_fields" ? {} : "";
    setKey(name, initial);
    setPickerOpen(false);
  }

  return (
    <div className="mt-3 rounded-md border border-border/60 bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Mais campos
          {usedKeys.length > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {usedKeys.length}
            </span>
          )}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {isLoading ? "carregando..." : `${catalog.length} disponíveis`}
        </span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-border/60 px-3 py-2.5">
          {error && (
            <p className="text-xs text-destructive">
              Não foi possível carregar os campos desta entidade.
            </p>
          )}
          {usedEntries.length === 0 && !error && (
            <p className="text-xs text-muted-foreground">
              Nenhum campo extra configurado. Use tokens <code className="text-[11px]">{`{{campo}}`}</code>{" "}
              para reutilizar valores do registro que disparou o workflow.
            </p>
          )}
          {usedEntries.map(([key, field, value]) => (
            <div
              key={key}
              className="grid grid-cols-[1fr_1.5fr_auto] items-start gap-2 rounded border border-border/40 bg-background p-2"
            >
              <div className="min-w-0">
                <Label className="text-xs font-medium">{field?.label ?? key}</Label>
                <p className="truncate text-[10px] text-muted-foreground">
                  {key}
                  {field?.type ? ` · ${field.type}` : ""}
                </p>
              </div>
              <div>
                {field ? (
                  <FieldInput field={field} value={value} onChange={(v) => setKey(key, v)} />
                ) : (
                  <Input
                    value={typeof value === "string" ? value : value == null ? "" : String(value)}
                    onChange={(e) => setKey(key, e.target.value)}
                    placeholder="valor"
                  />
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remover ${field?.label ?? key}`}
                onClick={() => removeKey(key)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={availableFields.length === 0 && !isLoading}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Adicionar campo
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar campo..." />
                <CommandList>
                  <CommandEmpty>Nenhum campo disponível.</CommandEmpty>
                  <CommandGroup>
                    {availableFields.map((f) => (
                      <CommandItem
                        key={f.name}
                        value={`${f.label} ${f.name}`}
                        onSelect={() => addField(f.name)}
                      >
                        <span className="flex-1 truncate">{f.label}</span>
                        <span className={cn("ml-2 text-[10px] text-muted-foreground")}>
                          {f.type}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
