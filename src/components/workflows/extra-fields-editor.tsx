// Editor de "Mais campos" para ações create_* do workflow.
// Permite adicionar qualquer campo da entidade alvo além dos já
// cobertos no formulário principal da ação. Persiste em action.extra_fields.
import { useEffect, useMemo, useState } from "react";
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
import { searchCompanies, searchContacts, searchPipelines, searchUsers } from "@/lib/workflow-refs.functions";
import { TokenInput, TokenTextarea } from "./token-input";
import { useReferenceLabels } from "./use-reference-labels";

import type { WorkflowWritableTable } from "@/lib/workflows/types";

type EntityName = WorkflowWritableTable;

interface Props {
  entity: EntityName;
  extraFields: Record<string, unknown> | undefined;
  hiddenKeys?: string[];
  onChange: (next: Record<string, unknown> | undefined) => void;
  /** Rótulo do bloco colapsável. Padrão: "Mais campos". */
  title?: string;
  /** Inicia aberto (útil quando é o editor primário da ação). */
  defaultOpen?: boolean;
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
          <TokenInput
            value={v}
            placeholder="valor (aceita {{tokens}})"
            onValueChange={(nv) => {
              const next = { ...obj, [k]: nv };
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

  // FKs conhecidas → combobox com nomes resolvidos.
  const FK_KIND: Record<string, "user" | "company" | "pipeline" | "contact"> = {
    owner_id: "user",
    assigned_user_id: "user",
    assignee_id: "user",
    approver_user_id: "user",
    hiring_manager_id: "user",
    notify_user_id: "user",
    company_id: "company",
    parent_company_id: "company",
    primary_contact_id: "contact",
    contact_id: "contact",
    pipeline_id: "pipeline",
  };
  if (FK_KIND[field.name]) {
    return (
      <FkPicker
        kind={FK_KIND[field.name]}
        value={strVal}
        onChange={(v) => onChange(v)}
      />
    );
  }

  if (LONG_TEXT_FIELDS.has(field.name)) {
    return (
      <TokenTextarea
        rows={2}
        value={strVal}
        onValueChange={(v) => onChange(v)}
        placeholder="Aceita {{tokens}}"
      />
    );
  }

  return (
    <TokenInput
      value={strVal}
      onValueChange={(v) => onChange(v)}
      placeholder="Aceita {{tokens}}"
    />
  );
}

// Combobox de busca para FKs conhecidas (usuário / empresa / pipeline).
// Busca é server-side com debounce, respeitando as RLS policies do usuário.
// Aceita valor bruto (UUID) ou token {{...}} — o TokenInput continua no fallback.
export function FkPicker({
  kind,
  value,
  onChange,
}: {
  kind: "user" | "company" | "pipeline" | "contact";
  value: string;
  onChange: (v: string) => void;
}) {
  const isToken = /^\s*\{\{.+\}\}\s*$/.test(value);
  const [open, setOpen] = useState(false);
  const [rawQ, setRawQ] = useState("");
  const [q, setQ] = useState("");
  const [tokenMode, setTokenMode] = useState<boolean>(isToken);
  const labels = useReferenceLabels();
  const fetchCompanies = useServerFn(searchCompanies);
  const fetchContacts = useServerFn(searchContacts);
  const fetchPipelines = useServerFn(searchPipelines);
  const fetchUsers = useServerFn(searchUsers);

  // debounce 200ms sobre o input
  useEffect(() => {
    const t = setTimeout(() => setQ(rawQ.trim()), 200);
    return () => clearTimeout(t);
  }, [rawQ]);

  const searchQuery = useQuery({
    queryKey: ["wf-ref-search", kind, q],
    enabled: open,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      if (kind === "company") return await fetchCompanies({ data: { q: q || undefined } });
      if (kind === "contact") return await fetchContacts({ data: { q: q || undefined } });
      if (kind === "pipeline") return await fetchPipelines({ data: { q: q || undefined } });
      const rows = await fetchUsers({ data: { q: q || undefined } });
      return rows.map((r: { id: string; name: string }) => ({ id: r.id, name: r.name }));
    },
  });

  const currentLabel = !value
    ? ""
    : isToken
      ? value
      : kind === "user"
        ? labels.labelForUser(value)
        : kind === "company"
          ? labels.labelForCompany(value)
          : kind === "contact"
            ? labels.labelForContact(value)
            : labels.labelForPipeline(value);

  const items = (searchQuery.data ?? []) as Array<{ id: string; name: string }>;
  const isLoading = searchQuery.isFetching;

  if (tokenMode || isToken) {
    return (
      <div className="space-y-1.5">
        <TokenInput
          value={value}
          onValueChange={(v) => onChange(v)}
          placeholder="{{token}}"
        />
        <button
          type="button"
          className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          onClick={() => {
            setTokenMode(false);
            if (isToken) onChange("");
          }}
        >
          Selecionar da lista
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            className="h-9 w-full justify-between text-left font-normal"
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {currentLabel || "Selecionar..."}
            </span>
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[min(360px,90vw)] min-w-[--radix-popover-trigger-width] p-0"
          align="start"
          sideOffset={6}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar por nome..."
              value={rawQ}
              onValueChange={setRawQ}
            />
            <CommandList>
              {isLoading && items.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Buscando…
                </div>
              )}
              {!isLoading && searchQuery.isError && (
                <div className="px-3 py-6 text-center text-xs text-destructive">
                  Erro ao buscar.
                </div>
              )}
              {!isLoading && !searchQuery.isError && items.length === 0 && (
                <CommandEmpty>Nenhum resultado.</CommandEmpty>
              )}
              <CommandGroup>
                {items.map((it) => (
                  <CommandItem
                    key={it.id}
                    value={`${it.name} ${it.id}`}
                    onSelect={() => {
                      onChange(it.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3.5 w-3.5",
                        value === it.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{it.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <button
        type="button"
        className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        onClick={() => setTokenMode(true)}
      >
        Usar token…
      </button>
    </div>
  );
}

export function ExtraFieldsEditor({ entity, extraFields, hiddenKeys, onChange, title, defaultOpen }: Props) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const [showEmpty, setShowEmpty] = useState(false);

  const fetchCatalog = useServerFn(getEntityFieldCatalog);
  const { data, isLoading, error } = useQuery({
    queryKey: ["wf-entity-fields-full", entity],
    queryFn: () => fetchCatalog({ data: { entity } }),
    staleTime: 5 * 60_000,
  });

  const hidden = useMemo(() => new Set(hiddenKeys ?? []), [hiddenKeys]);
  const catalog = data?.fields ?? [];

  const visibleFields = useMemo(
    () => catalog.filter((f) => !hidden.has(f.name)),
    [catalog, hidden],
  );

  const values = (extraFields ?? {}) as Record<string, unknown>;
  const hasValue = (k: string) => {
    if (!(k in values)) return false;
    const v = values[k];
    if (v === null || v === undefined || v === "") return false;
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0)
      return false;
    return true;
  };

  const filled = visibleFields.filter((f) => hasValue(f.name));
  const empty = visibleFields.filter((f) => !hasValue(f.name));
  const orphanKeys = Object.keys(values).filter(
    (k) => !hidden.has(k) && !visibleFields.some((f) => f.name === k),
  );

  const filledCount = filled.length + orphanKeys.length;

  function setKey(key: string, value: unknown) {
    const next: Record<string, unknown> = { ...values };
    if (value === null || value === undefined || value === "") {
      delete next[key];
    } else {
      next[key] = value;
    }
    onChange(Object.keys(next).length ? next : undefined);
  }

  function removeKey(key: string) {
    const next: Record<string, unknown> = { ...values };
    delete next[key];
    onChange(Object.keys(next).length ? next : undefined);
  }

  function renderRow(field: EntityFieldDef | undefined, key: string, value: unknown) {
    return (
      <div
        key={key}
        className="space-y-1.5 rounded border border-border/40 bg-background p-2"
      >
        <div className="flex items-start justify-between gap-2">
          <Label className="text-xs font-medium">{field?.label ?? key}</Label>
          {hasValue(key) && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mt-1 -mr-1"
              aria-label={`Limpar ${field?.label ?? key}`}
              onClick={() => removeKey(key)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
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
      </div>
    );
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
          {title ?? "Mais campos"}
          {filledCount > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {filledCount}
            </span>
          )}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {isLoading ? "carregando..." : `${visibleFields.length} campos`}
        </span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-border/60 px-3 py-2.5">
          {error && (
            <p className="text-xs text-destructive">
              Não foi possível carregar os campos desta entidade.
            </p>
          )}

          {isLoading && !error && (
            <p className="text-xs text-muted-foreground">Carregando campos...</p>
          )}

          {!isLoading && !error && visibleFields.length === 0 && orphanKeys.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhum campo disponível para esta entidade.
            </p>
          )}

          {(filled.length > 0 || orphanKeys.length > 0) && (
            <div className="space-y-2">
              {filled.map((f) => renderRow(f, f.name, values[f.name]))}
              {orphanKeys.map((k) => renderRow(undefined, k, values[k]))}
            </div>
          )}

          {empty.length > 0 && (
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => setShowEmpty((v) => !v)}
                className="flex w-full items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                aria-expanded={showEmpty}
              >
                {showEmpty ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                {filled.length > 0 || orphanKeys.length > 0 ? "Outros campos" : "Todos os campos"}
                <span className="text-[10px] text-muted-foreground">({empty.length})</span>
              </button>

              {showEmpty && (
                <div className="space-y-2">
                  {empty.map((f) => renderRow(f, f.name, values[f.name]))}
                </div>
              )}
            </div>
          )}

          <p className="pt-1 text-[10px] text-muted-foreground">
            Use tokens <code className="text-[10px]">{`{{campo}}`}</code> nos campos texto para reutilizar valores do registro que disparou o workflow.
          </p>
        </div>
      )}
    </div>
  );
}
