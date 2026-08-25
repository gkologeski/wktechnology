// Editor de "Mais campos" para ações create_* do workflow.
// Permite adicionar qualquer campo da entidade alvo além dos já
// cobertos no formulário principal da ação. Persiste em action.extra_fields.
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Check,
  ChevronsUpDown,
  Wand2,
  AlertCircle,
  GripVertical,
  Pencil,
  Settings2,
  RotateCcw,
  FolderPlus,
} from "lucide-react";
import {
  loadFieldLayout,
  saveFieldLayout,
  clearFieldLayout,
  newGroupId,
  insertFieldInGroup,
  removeFieldFromGroups,
  reorderGroups,
  type FieldLayout,
  type FieldGroup,
} from "./field-layout";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IntegerInput } from "@/components/ui/integer-input";
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
  CommandSeparator,
} from "@/components/ui/command";

import { cn } from "@/lib/utils";
import { getEntityFieldCatalog, type EntityFieldDef } from "@/lib/entity-fields.functions";
import { WordEditor } from "@/components/word-editor-lazy";
import { REF_COLUMNS, type RefKind } from "@/lib/entity-fields-refs";
import {
  searchCompanies,
  searchContacts,
  searchContracts,
  searchDeals,
  searchLegalEntities,
  searchPipelines,
  searchUsers,
} from "@/lib/workflow-refs.functions";
import { CompanyScopedPicker } from "./company-scoped-picker";
import { TokenInput, TokenTextarea, useWorkflowRefOptions } from "./token-input";
import { useReferenceLabels } from "./use-reference-labels";

import type { WorkflowEntity, WorkflowWritableTable } from "@/lib/workflows/types";
import { sortFieldsByCanonicalOrder } from "@/lib/workflows/entity-field-order";
import { confirmDialog } from "@/components/ui/confirm-dialog";

type EntityName = WorkflowWritableTable;

interface Props {
  entity: EntityName;
  extraFields: Record<string, unknown> | undefined;
  hiddenKeys?: string[];
  onChange: (next: Record<string, unknown> | undefined) => void;
  /** Entidade que dispara o workflow, usada para tokens contextualizados. */
  triggerEntity?: WorkflowEntity;
  /** Rótulo do bloco colapsável. Padrão: "Mais campos". */
  title?: string;
  /** Inicia aberto (útil quando é o editor primário da ação). */
  defaultOpen?: boolean;
}

// Campos longos usam Textarea em vez de Input.
const LONG_TEXT_FIELDS = new Set(["description", "notes", "body", "summary", "comments"]);

function coerceValue(field: EntityFieldDef, raw: unknown): unknown {
  if (raw === "" || raw === null || raw === undefined) return null;
  switch (field.type) {
    case "currency":
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
  siblingValues,
}: {
  field: EntityFieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  /** Outros valores do mesmo passo — usados em regras entre campos. */
  siblingValues?: Record<string, unknown>;
}) {
  const strVal = value == null ? "" : String(value);

  if (field.name === "custom_fields") {
    return <CustomFieldsEditor value={value} onChange={(v) => onChange(v)} />;
  }

  if (field.type === "boolean") {
    return (
      <div className="flex h-9 items-center">
        <Switch checked={Boolean(value)} onCheckedChange={(c) => onChange(c)} />
      </div>
    );
  }

  if (field.type === "select" && field.options?.length) {
    return (
      <Select value={strVal || undefined} onValueChange={(v) => onChange(v)}>
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

  if (field.type === "number" || field.type === "currency") {
    const isInteger =
      /(_days|_months|_count|_number|_seconds|_min|_ms|quantity|sort_order|view_count|installment_total|payment_day|version)$/.test(
        field.name,
      );
    const handleChange = (raw: string) => onChange(raw === "" ? null : coerceValue(field, raw));

    if (isInteger) {
      return (
        <IntegerInput
          value={strVal}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="0"
        />
      );
    }

    return (
      <Input
        type="text"
        inputMode="decimal"
        value={strVal}
        onChange={(e) => handleChange(e.target.value)}
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
  // Fonte única: o catálogo de campos (REF_COLUMNS) + `owner_id`, que é oculto
  // no catálogo mas editável aqui.
  const fkKind = field.ref ?? (field.name === "owner_id" ? "user" : REF_COLUMNS[field.name]);
  if (fkKind) {
    // Regra do contrato: em "Prestação (somos o prestador)" a empresa
    // contratante é a contraparte, então não faz sentido listar as nossas
    // pessoas jurídicas (CNPJs) do workspace para escolha.
    const hideOwnLegalEntities =
      field.name === "contracting_legal_entity_id" && siblingValues?.["role"] === "provider";
    return (
      <FkPicker
        kind={fkKind}
        value={strVal}
        onChange={(v) => onChange(v)}
        hideRecords={hideOwnLegalEntities}
        hideRecordsHint={
          hideOwnLegalEntities
            ? "No papel de Prestação, a empresa contratante é a contraparte — use uma variável do gatilho ou de um passo anterior."
            : undefined
        }
      />
    );
  }

  // Texto rico (ex.: corpo do contrato) → editor WYSIWYG, sem HTML cru.
  if (field.richText) {
    return (
      <WordEditor
        value={strVal}
        onChange={(html) => onChange(html)}
        minHeight={220}
        placeholder="Escreva o conteúdo. Aceita {{tokens}} do workflow."
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
    <TokenInput value={strVal} onValueChange={(v) => onChange(v)} placeholder="Aceita {{tokens}}" />
  );
}

// Combobox de busca para FKs conhecidas (usuário / empresa / contato /
// pipeline / empresa contratante / contrato).
// Busca é server-side com debounce, respeitando as RLS policies do usuário.
// Aceita valor bruto (UUID) ou token {{...}} — o TokenInput continua no fallback.
export function FkPicker({
  kind,
  value,
  onChange,
  hideRecords,
  hideRecordsHint,
}: {
  kind: RefKind;
  value: string;
  onChange: (v: string) => void;
  /** Oculta a busca/lista de registros, deixando só as opções pré-carregadas. */
  hideRecords?: boolean;
  /** Aviso curto explicando por que a lista de registros está oculta. */
  hideRecordsHint?: string;
}) {
  const isToken = /^\s*\{\{.+\}\}\s*$/.test(value);
  // Opções pré-carregadas (gatilho + passos anteriores) compatíveis com o campo.
  const refOptions = useWorkflowRefOptions(kind);
  const refOptionLabel = refOptions.find((o) => o.token === value.trim())?.label ?? null;
  const [open, setOpen] = useState(false);
  const [rawQ, setRawQ] = useState("");
  const [q, setQ] = useState("");
  const [tokenMode, setTokenMode] = useState<boolean>(isToken);
  const labels = useReferenceLabels();
  const fetchCompanies = useServerFn(searchCompanies);
  const fetchContacts = useServerFn(searchContacts);
  const fetchPipelines = useServerFn(searchPipelines);
  const fetchUsers = useServerFn(searchUsers);
  const fetchLegalEntities = useServerFn(searchLegalEntities);
  const fetchContracts = useServerFn(searchContracts);
  const fetchDeals = useServerFn(searchDeals);

  // debounce 200ms sobre o input
  useEffect(() => {
    const t = setTimeout(() => setQ(rawQ.trim()), 200);
    return () => clearTimeout(t);
  }, [rawQ]);

  const searchQuery = useQuery({
    queryKey: ["wf-ref-search", kind, q],
    enabled: open && !hideRecords,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      if (kind === "company") return await fetchCompanies({ data: { q: q || undefined } });
      if (kind === "contact") return await fetchContacts({ data: { q: q || undefined } });
      if (kind === "pipeline") return await fetchPipelines({ data: { q: q || undefined } });
      if (kind === "legal_entity") return await fetchLegalEntities({ data: { q: q || undefined } });
      if (kind === "contract") return await fetchContracts({ data: { q: q || undefined } });
      if (kind === "deal") return await fetchDeals({ data: { q: q || undefined } });
      const rows = await fetchUsers({ data: { q: q || undefined } });
      return rows.map((r: { id: string; name: string }) => ({ id: r.id, name: r.name }));
    },
  });

  // Tipos sem cache global de rótulos: hidrata o nome pelo ID selecionado
  // para nunca exibir hash na interface.
  const needsHydrate =
    !!value && !isToken && (kind === "legal_entity" || kind === "contract" || kind === "deal");
  const hydrated = useQuery({
    queryKey: ["wf-ref-label", kind, value],
    enabled: needsHydrate,
    staleTime: 300_000,
    queryFn: async () => {
      const rows =
        kind === "legal_entity"
          ? await fetchLegalEntities({ data: { ids: [value] } })
          : kind === "deal"
            ? await fetchDeals({ data: { ids: [value] } })
            : await fetchContracts({ data: { ids: [value] } });
      return rows[0]?.name ?? "";
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
            : kind === "pipeline"
              ? labels.labelForPipeline(value)
              : hydrated.data || "Carregando…";

  const items = (searchQuery.data ?? []) as Array<{ id: string; name: string }>;
  const isLoading = searchQuery.isFetching;

  // Token conhecido (ex.: "Empresa do gatilho"): mostra rótulo amigável em vez
  // do token cru, mantendo o combo para trocar a escolha.
  if (isToken && refOptionLabel && !tokenMode) {
    return (
      <div className="space-y-1.5">
        <div className="flex h-9 items-center justify-between gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm">
          <span className="truncate">{refOptionLabel}</span>
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => onChange("")}
          >
            Limpar
          </button>
        </div>
        <button
          type="button"
          className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          onClick={() => setTokenMode(true)}
        >
          Editar token…
        </button>
      </div>
    );
  }

  if (tokenMode || isToken) {
    return (
      <div className="space-y-1.5">
        <TokenInput
          value={value}
          onValueChange={(v) => onChange(v)}
          tokenKind="id"
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
          className={cn(
            "p-0",
            kind === "contract" || kind === "deal"
              ? "w-[min(640px,92vw)]"
              : "w-[min(360px,90vw)] min-w-[--radix-popover-trigger-width]",
          )}
          align="start"
          sideOffset={6}
        >
          {kind === "contract" || kind === "deal" ? (
            <>
              {refOptions.length > 0 && (
                <div className="border-b border-border p-1">
                  <p className="px-2 py-1 text-[11px] font-medium text-muted-foreground">
                    Do gatilho e passos anteriores
                  </p>
                  {refOptions.map((opt) => (
                    <button
                      key={opt.token}
                      type="button"
                      className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        onChange(opt.token);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3.5 w-3.5",
                          value.trim() === opt.token ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
              {hideRecords ? (
                <p className="p-3 text-[11px] text-muted-foreground">{hideRecordsHint}</p>
              ) : (
                <CompanyScopedPicker
                  kind={kind}
                  value={value}
                  onSelect={(id: string) => {
                    onChange(id);
                    setOpen(false);
                  }}
                />
              )}
            </>
          ) : (
            <Command shouldFilter={false}>
              {!hideRecords && (
                <CommandInput
                  placeholder="Buscar por nome..."
                  value={rawQ}
                  onValueChange={setRawQ}
                />
              )}
              <CommandList>
                {refOptions.length > 0 && (
                  <CommandGroup heading="Do gatilho e passos anteriores">
                    {refOptions.map((opt) => (
                      <CommandItem
                        key={opt.token}
                        value={opt.token}
                        onSelect={() => {
                          onChange(opt.token);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-3.5 w-3.5",
                            value.trim() === opt.token ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="truncate">{opt.label}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {hideRecords ? (
                  <p className="p-3 text-[11px] text-muted-foreground">{hideRecordsHint}</p>
                ) : (
                  <>
                    {refOptions.length > 0 && <CommandSeparator />}
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
                    <CommandGroup heading="Registros">
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
                  </>
                )}
              </CommandList>
            </Command>
          )}
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

export function ExtraFieldsEditor({
  entity,
  extraFields,
  hiddenKeys,
  onChange,
  triggerEntity,
  title,
  defaultOpen,
}: Props) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const [showEmpty, setShowEmpty] = useState(false);
  const [showSystem, setShowSystem] = useState(false);
  const [customizeMode, setCustomizeMode] = useState(false);
  const [layout, setLayout] = useState<FieldLayout>(() => loadFieldLayout(entity));

  // Recarrega layout ao trocar de entidade
  useEffect(() => {
    setLayout(loadFieldLayout(entity));
  }, [entity]);

  function persistLayout(next: FieldLayout) {
    setLayout(next);
    saveFieldLayout(entity, next);
  }

  const fetchCatalog = useServerFn(getEntityFieldCatalog);
  const { data, isLoading, error } = useQuery({
    queryKey: ["wf-entity-fields-full", entity],
    queryFn: () => fetchCatalog({ data: { entity } }),
    staleTime: 5 * 60_000,
  });

  const hidden = useMemo(() => new Set(hiddenKeys ?? []), [hiddenKeys]);
  const catalog = data?.fields ?? [];

  const visibleFields = useMemo(
    () =>
      sortFieldsByCanonicalOrder(
        entity,
        catalog.filter((f) => !hidden.has(f.name)),
      ),
    [catalog, hidden, entity],
  );

  const fieldByName = useMemo(() => {
    const m = new Map<string, EntityFieldDef>();
    for (const f of visibleFields) m.set(f.name, f);
    return m;
  }, [visibleFields]);

  const [pinned, setPinned] = useState<Set<string>>(() => new Set());

  const values = (extraFields ?? {}) as Record<string, unknown>;

  const hasValue = (k: string) => {
    if (!(k in values)) return false;
    const v = values[k];
    if (v === null || v === undefined || v === "") return false;
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0)
      return false;
    return true;
  };

  const isToken = (v: unknown) => typeof v === "string" && /\{\{\s*[\w.]+\s*\}\}/.test(v);

  function validateField(f: EntityFieldDef): string | null {
    const v = values[f.name];
    const filled = hasValue(f.name);
    if (f.required && !filled) return "Campo obrigatório.";
    if (!filled) return null;
    if (isToken(v)) return null;
    if (f.type === "number" || f.type === "currency") {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) return "Valor deve ser numérico.";
    }
    if (f.type === "date" && typeof v === "string") {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return "Data inválida.";
    }
    if (f.type === "select" && f.options?.length && typeof v === "string") {
      if (!f.options.some((o) => o.value === v)) return "Valor fora das opções.";
    }
    return null;
  }

  const fieldErrors = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of visibleFields) {
      const err = validateField(f);
      if (err) m.set(f.name, err);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleFields, values]);

  const errorCount = fieldErrors.size;
  const hasMissingRequired = visibleFields.some((f) => f.required && !hasValue(f.name));

  useEffect(() => {
    if (hasMissingRequired) {
      setOpen(true);
      setShowEmpty(true);
    }
  }, [hasMissingRequired]);

  // Nomes já alocados em algum grupo
  const groupedNames = useMemo(() => {
    const s = new Set<string>();
    for (const g of layout.groups) for (const n of g.fieldNames) s.add(n);
    return s;
  }, [layout]);

  // Ungrouped = todos os visíveis fora de qualquer grupo
  const ungrouped = useMemo(
    () => visibleFields.filter((f) => !groupedNames.has(f.name)),
    [visibleFields, groupedNames],
  );

  // Campos preenchidos pelo sistema/integração ficam num bloco colapsado
  // próprio (continuam editáveis, apenas fora do fluxo principal).
  const systemFields = ungrouped.filter((f) => f.system);
  const mainFields = ungrouped.filter((f) => !f.system);

  // A posição de cada campo (bloco "preenchidos" x bloco "outros campos") é
  // congelada enquanto o painel está aberto. Se recalculássemos a cada tecla,
  // o campo mudaria de container pai ao receber o primeiro caractere, o React
  // remontaria o input e a digitação perderia o foco.
  const bucketRef = useRef<{ sig: string; map: Map<string, "filled" | "empty"> }>({
    sig: "",
    map: new Map(),
  });
  const bucketSig = `${entity}|${open ? "1" : "0"}|${mainFields.map((f) => f.name).join(",")}`;
  if (bucketRef.current.sig !== bucketSig) {
    const map = new Map<string, "filled" | "empty">();
    for (const f of mainFields) {
      map.set(f.name, hasValue(f.name) || pinned.has(f.name) ? "filled" : "empty");
    }
    bucketRef.current = { sig: bucketSig, map };
  }
  const bucketOf = (name: string) => bucketRef.current.map.get(name) ?? "empty";

  const filled = mainFields.filter((f) => bucketOf(f.name) === "filled");
  const empty = mainFields.filter((f) => bucketOf(f.name) === "empty");
  const orphanKeys = Object.keys(values).filter(
    (k) => !hidden.has(k) && !visibleFields.some((f) => f.name === k),
  );

  const filledCount =
    filled.length +
    orphanKeys.length +
    layout.groups.reduce((acc, g) => acc + g.fieldNames.filter((n) => hasValue(n)).length, 0);

  function setKey(key: string, value: unknown) {
    const next: Record<string, unknown> = { ...values };
    if (value === null || value === undefined || value === "") {
      delete next[key];
      setPinned((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    } else {
      next[key] = value;
    }
    onChange(Object.keys(next).length ? next : undefined);
  }

  function removeKey(key: string) {
    const next: Record<string, unknown> = { ...values };
    delete next[key];
    setPinned((prev) => {
      if (!prev.has(key)) return prev;
      const s = new Set(prev);
      s.delete(key);
      return s;
    });
    onChange(Object.keys(next).length ? next : undefined);
  }

  const TOKEN_ALIAS: Record<string, string> = {
    counterparty_company_id: "{{company_id}}",
    primary_contact_id: "{{contact_id}}",
    assigned_user_id: "{{owner_id}}",
    assignee_id: "{{owner_id}}",
    hiring_manager_id: "{{owner_id}}",
    approver_user_id: "{{owner_id}}",
    // Vínculo contextual: quando o workflow dispara de um negócio, o contrato
    // criado deve apontar para o próprio registro origem ({{id}}).
    ...(triggerEntity === "deals" ? { deal_id: "{{id}}" } : {}),
    // Vínculo contextual: quando o workflow dispara de um contrato, o novo
    // contrato (aditivo/renovação) deve apontar para o contrato origem.
    ...(triggerEntity === "contracts" ? { parent_contract_id: "{{id}}" } : {}),
  };

  function tokenForField(field: EntityFieldDef): string | null {
    if (field.name === "custom_fields") return null;
    if (field.type === "boolean" || field.type === "date" || field.type === "select") {
      return null;
    }
    return TOKEN_ALIAS[field.name] ?? `{{${field.name}}}`;
  }

  function autofillFromWorkflow() {
    const next: Record<string, unknown> = { ...values };
    let changed = 0;
    for (const f of visibleFields) {
      if (hasValue(f.name)) continue;
      const tk = tokenForField(f);
      if (!tk) continue;
      next[f.name] = tk;
      changed++;
    }
    if (changed > 0) onChange(next);
  }

  const autofillableCount = visibleFields.filter(
    (f) => !hasValue(f.name) && tokenForField(f) !== null,
  ).length;

  // ---- Layout ops ----
  function addGroup() {
    const label = window.prompt("Nome do grupo (ex.: Contratante, Valores, Datas)")?.trim();
    if (!label) return;
    persistLayout({
      ...layout,
      groups: [...layout.groups, { id: newGroupId(), label, fieldNames: [], collapsed: false }],
    });
  }

  function renameGroup(gid: string) {
    const current = layout.groups.find((g) => g.id === gid);
    if (!current) return;
    const label = window.prompt("Renomear grupo", current.label)?.trim();
    if (!label) return;
    persistLayout({
      ...layout,
      groups: layout.groups.map((g) => (g.id === gid ? { ...g, label } : g)),
    });
  }

  async function deleteGroup(gid: string) {
    if (!(await confirmDialog("Remover este grupo? Os campos voltam para 'Sem grupo'."))) return;
    persistLayout({
      ...layout,
      groups: layout.groups.filter((g) => g.id !== gid),
    });
  }

  function toggleGroupCollapsed(gid: string) {
    persistLayout({
      ...layout,
      groups: layout.groups.map((g) => (g.id === gid ? { ...g, collapsed: !g.collapsed } : g)),
    });
  }

  async function resetLayout() {
    if (!(await confirmDialog("Restaurar layout padrão? Todos os grupos serão removidos."))) return;
    clearFieldLayout(entity);
    setLayout({ version: 1, groups: [] });
  }

  // Drag state — usamos dataTransfer para segurança e leveza.
  function onFieldDragStart(e: React.DragEvent, fieldName: string) {
    e.dataTransfer.setData("application/x-wf-field", fieldName);
    e.dataTransfer.effectAllowed = "move";
  }

  function onFieldDropInGroup(e: React.DragEvent, groupId: string, index?: number) {
    const fieldName = e.dataTransfer.getData("application/x-wf-field");
    if (!fieldName) return;
    e.preventDefault();
    e.stopPropagation();
    persistLayout(insertFieldInGroup(layout, fieldName, groupId, index));
  }

  function onFieldDropUngrouped(e: React.DragEvent) {
    const fieldName = e.dataTransfer.getData("application/x-wf-field");
    if (!fieldName) return;
    e.preventDefault();
    e.stopPropagation();
    persistLayout(removeFieldFromGroups(layout, fieldName));
  }

  function onGroupDragStart(e: React.DragEvent, index: number) {
    e.dataTransfer.setData("application/x-wf-group", String(index));
    e.dataTransfer.effectAllowed = "move";
  }

  function onGroupDrop(e: React.DragEvent, toIndex: number) {
    const raw = e.dataTransfer.getData("application/x-wf-group");
    if (!raw) return;
    const from = Number(raw);
    if (!Number.isFinite(from)) return;
    e.preventDefault();
    e.stopPropagation();
    persistLayout(reorderGroups(layout, from, toIndex));
  }

  function allowDrop(e: React.DragEvent) {
    if (
      e.dataTransfer.types.includes("application/x-wf-field") ||
      e.dataTransfer.types.includes("application/x-wf-group")
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  }

  function renderRow(
    field: EntityFieldDef | undefined,
    key: string,
    value: unknown,
    opts?: { draggable?: boolean; groupId?: string; index?: number },
  ) {
    const err = field ? fieldErrors.get(field.name) : undefined;
    const required = Boolean(field?.required);
    const draggable = Boolean(customizeMode && opts?.draggable && field);
    return (
      <div
        key={key}
        draggable={draggable}
        onDragStart={draggable ? (e) => onFieldDragStart(e, key) : undefined}
        onDragOver={customizeMode && opts?.groupId ? allowDrop : undefined}
        onDrop={
          customizeMode && opts?.groupId
            ? (e) => onFieldDropInGroup(e, opts.groupId!, opts.index)
            : undefined
        }
        className={cn(
          "space-y-1.5 rounded border bg-background p-2 transition-colors",
          err ? "border-destructive/60 ring-1 ring-destructive/30" : "border-border/40",
          draggable && "cursor-grab active:cursor-grabbing",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <Label className="text-xs font-medium flex items-center gap-1">
            {customizeMode && field && (
              <GripVertical className="h-3 w-3 text-muted-foreground" aria-hidden />
            )}
            <span>{field?.label ?? key}</span>
            {required && (
              <span className="text-destructive" aria-label="obrigatório" title="Campo obrigatório">
                *
              </span>
            )}
          </Label>
          {hasValue(key) && !customizeMode && (
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
        {!customizeMode && (
          <div>
            {field ? (
              <FieldInput
                field={field}
                value={value}
                onChange={(v) => setKey(key, v)}
                siblingValues={values}
              />
            ) : (
              <Input
                value={typeof value === "string" ? value : value == null ? "" : String(value)}
                onChange={(e) => setKey(key, e.target.value)}
                placeholder="valor"
              />
            )}
          </div>
        )}
        {err && !customizeMode && (
          <p className="flex items-center gap-1 text-[11px] font-medium text-destructive">
            <AlertCircle className="h-3 w-3" />
            {err}
          </p>
        )}
      </div>
    );
  }

  function renderGroup(g: FieldGroup, index: number) {
    const fields = g.fieldNames
      .map((n) => fieldByName.get(n))
      .filter((f): f is EntityFieldDef => Boolean(f));
    const filledInGroup = fields.filter((f) => hasValue(f.name)).length;
    const errsInGroup = fields.filter((f) => fieldErrors.has(f.name)).length;

    return (
      <div
        key={g.id}
        className="rounded-md border border-border/60 bg-background"
        draggable={customizeMode}
        onDragStart={customizeMode ? (e) => onGroupDragStart(e, index) : undefined}
        onDragOver={customizeMode ? allowDrop : undefined}
        onDrop={
          customizeMode
            ? (e) => {
                // Se estiver arrastando um campo, cai como último item
                const fieldName = e.dataTransfer.getData("application/x-wf-field");
                if (fieldName) {
                  onFieldDropInGroup(e, g.id);
                  return;
                }
                onGroupDrop(e, index);
              }
            : undefined
        }
      >
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-border/60 bg-muted/30">
          <button
            type="button"
            onClick={() => toggleGroupCollapsed(g.id)}
            className="flex items-center gap-1.5 text-xs font-medium text-foreground/90 hover:text-foreground"
          >
            {customizeMode && (
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            )}
            {g.collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            <span>{g.label}</span>
            {filledInGroup > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                {filledInGroup}/{fields.length}
              </span>
            )}
            {errsInGroup > 0 && (
              <span
                className="flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive"
                title="Pendências neste grupo"
              >
                <AlertCircle className="h-2.5 w-2.5" />
                {errsInGroup}
              </span>
            )}
          </button>
          {customizeMode && (
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Renomear"
                onClick={() => renameGroup(g.id)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                title="Remover grupo"
                onClick={() => deleteGroup(g.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        {!g.collapsed && (
          <div className="space-y-2 p-2">
            {fields.length === 0 && (
              <div
                onDragOver={customizeMode ? allowDrop : undefined}
                onDrop={customizeMode ? (e) => onFieldDropInGroup(e, g.id) : undefined}
                className={cn(
                  "rounded border border-dashed border-border/60 px-2 py-4 text-center text-[11px] text-muted-foreground",
                  customizeMode && "hover:border-primary/60 hover:text-primary",
                )}
              >
                {customizeMode
                  ? "Arraste campos até aqui para agrupar."
                  : "Nenhum campo neste grupo."}
              </div>
            )}
            {fields.map((f, i) =>
              renderRow(f, f.name, values[f.name], {
                draggable: true,
                groupId: g.id,
                index: i,
              }),
            )}
          </div>
        )}
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
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          {title ?? "Mais campos"}
          {filledCount > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {filledCount}
            </span>
          )}
          {errorCount > 0 && (
            <span
              className="flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive"
              title="Existem campos com pendências"
            >
              <AlertCircle className="h-2.5 w-2.5" />
              {errorCount} pendência{errorCount > 1 ? "s" : ""}
            </span>
          )}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {isLoading ? "carregando..." : `${visibleFields.length} campos`}
        </span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-border/60 px-3 py-2.5">
          {/* Toolbar de personalização */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant={customizeMode ? "default" : "outline"}
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => setCustomizeMode((v) => !v)}
                title="Ativa arrastar campos e editar grupos"
              >
                <Settings2 className="mr-1 h-3 w-3" />
                {customizeMode ? "Concluir" : "Personalizar layout"}
              </Button>
              {customizeMode && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={addGroup}
                  >
                    <FolderPlus className="mr-1 h-3 w-3" />
                    Novo grupo
                  </Button>
                  {layout.groups.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] text-muted-foreground"
                      onClick={resetLayout}
                      title="Remover todos os grupos e voltar ao padrão"
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Restaurar
                    </Button>
                  )}
                </>
              )}
            </div>
            {customizeMode && (
              <span className="text-[10px] text-muted-foreground">
                Arraste campos entre grupos. Arraste o cabeçalho para reordenar.
              </span>
            )}
          </div>

          {errorCount > 0 && !customizeMode && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-2 text-[11px] text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="space-y-0.5">
                <p className="font-medium">
                  {errorCount} campo{errorCount > 1 ? "s" : ""} com pendência antes de salvar.
                </p>
                <p className="text-destructive/80">
                  Revise obrigatórios (*) e valores inconsistentes destacados abaixo.
                </p>
              </div>
            </div>
          )}

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

          {/* Grupos personalizados */}
          {layout.groups.length > 0 && (
            <div className="space-y-2">{layout.groups.map((g, i) => renderGroup(g, i))}</div>
          )}

          {/* Sem grupo — bucket clássico com filled/empty */}
          <div
            onDragOver={customizeMode ? allowDrop : undefined}
            onDrop={customizeMode ? onFieldDropUngrouped : undefined}
            className={cn(
              "space-y-2",
              customizeMode &&
                layout.groups.length > 0 &&
                "rounded-md border border-dashed border-border/60 p-2",
            )}
          >
            {customizeMode && layout.groups.length > 0 && (
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Sem grupo — arraste para cá para desagrupar
              </p>
            )}

            {(filled.length > 0 || orphanKeys.length > 0) && (
              <div className="space-y-2">
                {filled.map((f) => renderRow(f, f.name, values[f.name], { draggable: true }))}
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
                  {filled.length > 0 || orphanKeys.length > 0 || layout.groups.length > 0
                    ? "Outros campos"
                    : "Todos os campos"}
                  <span className="text-[10px] text-muted-foreground">({empty.length})</span>
                </button>

                {showEmpty && (
                  <div className="space-y-2">
                    {empty.map((f) => renderRow(f, f.name, values[f.name], { draggable: true }))}
                  </div>
                )}
              </div>
            )}

            {systemFields.length > 0 && (
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowSystem((v) => !v)}
                  className="flex w-full items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  aria-expanded={showSystem}
                >
                  {showSystem ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  Campos do sistema e integrações
                  <span className="text-[10px] text-muted-foreground">({systemFields.length})</span>
                </button>
                {showSystem && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground">
                      Normalmente preenchidos automaticamente. Informe apenas se precisar
                      sobrescrever.
                    </p>
                    {systemFields.map((f) =>
                      renderRow(f, f.name, values[f.name], { draggable: true }),
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {autofillableCount > 0 && !customizeMode && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={autofillFromWorkflow}
                title="Preenche os campos vazios com variáveis do workflow, ex.: {{title}}"
              >
                <Wand2 className="mr-1 h-3 w-3" />
                Preencher com variáveis do workflow ({autofillableCount})
              </Button>
            </div>
          )}

          <p className="pt-1 text-[10px] text-muted-foreground">
            Use tokens <code className="text-[10px]">{`{{campo}}`}</code> nos campos texto para
            reutilizar valores do registro que disparou o workflow.
          </p>
        </div>
      )}
    </div>
  );
}
