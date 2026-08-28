// Edição em massa no padrão HubSpot: um combo de escolha da propriedade
// (com busca e agrupamento) e, abaixo, apenas o editor daquela propriedade.
// Campos dependentes (pipeline → etapa → substatus) aparecem em cascata.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Info, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { getEntityFieldCatalog, type EntityFieldDef } from "@/lib/entity-fields.functions";
import { bulkUpdateEntity } from "@/lib/grid/bulk-edit.functions";
import { isBulkEditDeniedColumn, type BulkEditEntity } from "@/lib/grid/bulk-edit-fields";
import { dedupeAliasFields, findAliasConflict } from "@/lib/grid/field-alias-guard";
import {
  PIPELINE_FIELD,
  dependencyHint,
  dependencyKindFor,
  groupFields,
  pipelineEntityFor,
  STAGE_FIELDS,
  type DependencyKind,
} from "@/lib/grid/bulk-edit-dependencies";
import { usePipelines } from "@/lib/pipelines";
import { substatusesForStage, usePipelineSubstatuses } from "@/lib/pipelines/substatuses";
import { BulkRefPicker } from "./bulk-ref-picker";

const LONG_TEXT_FIELDS = new Set([
  "description",
  "notes",
  "body",
  "summary",
  "comments",
  "requirements",
  "address",
]);

type Props = {
  open: boolean;
  setOpen: (b: boolean) => void;
  /** Entidade/tabela do catálogo de campos. */
  entity: BulkEditEntity;
  ids: string[];
  entityLabel: string;
  /** Campos sugeridos no topo do combo (os já declarados pela tela). */
  priorityFields?: string[];
  onDone: () => void;
};

/** Uma propriedade escolhida para edição, com seu valor e campos-pai. */
type PropertyRow = {
  key: string;
  name: string | null;
  value: unknown;
  /** Valores dos campos-pai (ex.: `pipeline_id`, `stage`). */
  deps: Record<string, string>;
};

const newRow = (): PropertyRow => ({
  key: Math.random().toString(36).slice(2),
  name: null,
  value: "",
  deps: {},
});

function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: EntityFieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const strVal = value == null ? "" : String(value);

  if (field.ref) {
    return <BulkRefPicker kind={field.ref} value={strVal} onChange={onChange} />;
  }

  if (field.type === "boolean") {
    return (
      <div className="flex h-9 items-center gap-2">
        <Switch
          id={`bulk-${field.name}`}
          checked={value === true}
          onCheckedChange={(c) => onChange(c)}
        />
        <span className="text-sm text-muted-foreground">{value === true ? "Sim" : "Não"}</span>
      </div>
    );
  }

  if (field.type === "select" && field.options?.length) {
    return (
      <Select value={strVal || undefined} onValueChange={(v) => onChange(v)}>
        <SelectTrigger id={`bulk-${field.name}`}>
          <SelectValue placeholder="Selecionar…" />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "currency") {
    return (
      <CurrencyInput
        id={`bulk-${field.name}`}
        value={value == null || value === "" ? null : Number(value)}
        onValueChange={(n) => onChange(n)}
      />
    );
  }

  if (field.type === "number") {
    return (
      <Input
        id={`bulk-${field.name}`}
        inputMode="decimal"
        value={strVal}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
      />
    );
  }

  if (field.type === "date") {
    return (
      <Input
        id={`bulk-${field.name}`}
        type="datetime-local"
        value={/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(strVal) ? strVal.slice(0, 16) : ""}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : "")}
      />
    );
  }

  if (LONG_TEXT_FIELDS.has(field.name) || field.richText) {
    return (
      <Textarea
        id={`bulk-${field.name}`}
        rows={3}
        value={strVal}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <Input
      id={`bulk-${field.name}`}
      value={strVal}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Novo valor"
    />
  );
}

/** Combo de escolha da propriedade, com busca e agrupamento por categoria. */
function PropertyCombobox({
  groups,
  value,
  usedNames,
  onSelect,
}: {
  groups: Array<{ group: string; fields: EntityFieldDef[] }>;
  value: EntityFieldDef | null;
  usedNames: Set<string>;
  onSelect: (field: EntityFieldDef) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? value.label : "Selecione uma propriedade para editar"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Pesquisar" />
          <CommandList className="max-h-72">
            <CommandEmpty>Nenhuma propriedade encontrada.</CommandEmpty>
            {groups.map((g) => (
              <CommandGroup key={g.group} heading={g.group}>
                {g.fields.map((f) => {
                  const disabled = usedNames.has(f.name) && f.name !== value?.name;
                  return (
                    <CommandItem
                      key={f.name}
                      value={`${f.label} ${f.name}`}
                      disabled={disabled}
                      onSelect={() => {
                        onSelect(f);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value?.name === f.name ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{f.label}</span>
                      {f.required && <span className="ml-1 text-destructive">*</span>}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Cascata pipeline → etapa (→ substatus) para os campos dependentes. */
function DependentEditor({
  kind,
  field,
  entity,
  row,
  onChange,
}: {
  kind: DependencyKind;
  field: EntityFieldDef;
  entity: BulkEditEntity;
  row: PropertyRow;
  onChange: (patch: Partial<PropertyRow>) => void;
}) {
  const pipelineEntity = pipelineEntityFor(entity) ?? "deal";
  const { pipelines, isLoading } = usePipelines(pipelineEntity);

  const pipelineId = row.deps[PIPELINE_FIELD] ?? "";
  const stageValue = kind === "stage" ? String(row.value ?? "") : (row.deps["stage"] ?? "");
  const pipeline = pipelines.find((p) => p.id === pipelineId);
  const stages = pipeline?.stages ?? [];
  const stage = stages.find((s) => s.value === stageValue);

  const subs = usePipelineSubstatuses(kind === "substatus" ? pipelineId || null : null);
  const substatusOptions = useMemo(
    () => substatusesForStage(subs.data, stageValue),
    [subs.data, stageValue],
  );

  if (kind === "lost_reason") {
    return (
      <div className="space-y-2">
        <p className="flex gap-2 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          {dependencyHint(kind)}
        </p>
        <Label htmlFor={`bulk-${field.name}`}>{field.label}</Label>
        <FieldEditor field={field} value={row.value} onChange={(v) => onChange({ value: v })} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="flex gap-2 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        {dependencyHint(kind)}
      </p>

      <div className="space-y-2">
        <Label htmlFor={`bulk-dep-pipeline-${row.key}`}>Pipeline</Label>
        <Select
          value={pipelineId || undefined}
          onValueChange={(v) =>
            onChange({
              deps: { [PIPELINE_FIELD]: v },
              value: kind === "stage" ? "" : row.value,
            })
          }
        >
          <SelectTrigger id={`bulk-dep-pipeline-${row.key}`}>
            <SelectValue placeholder={isLoading ? "Carregando…" : "Selecione um pipeline"} />
          </SelectTrigger>
          <SelectContent>
            {pipelines.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`bulk-dep-stage-${row.key}`}>
          {kind === "stage" ? field.label : "Etapa"}
        </Label>
        <Select
          value={stageValue || undefined}
          disabled={!pipelineId}
          onValueChange={(v) =>
            kind === "stage"
              ? onChange({ value: v })
              : onChange({ deps: { ...row.deps, stage: v }, value: "" })
          }
        >
          <SelectTrigger id={`bulk-dep-stage-${row.key}`}>
            <SelectValue placeholder={pipelineId ? "Selecione uma etapa" : "Escolha o pipeline"} />
          </SelectTrigger>
          <SelectContent>
            {stages.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {kind === "substatus" && (
        <div className="space-y-2">
          <Label htmlFor={`bulk-dep-substatus-${row.key}`}>{field.label}</Label>
          <Select
            value={String(row.value ?? "") || undefined}
            disabled={!stageValue || substatusOptions.length === 0}
            onValueChange={(v) => onChange({ value: v })}
          >
            <SelectTrigger id={`bulk-dep-substatus-${row.key}`}>
              <SelectValue
                placeholder={
                  !stageValue
                    ? "Escolha a etapa"
                    : subs.isLoading
                      ? "Carregando…"
                      : substatusOptions.length === 0
                        ? "Nenhum substatus nesta etapa"
                        : "Selecione um substatus"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {substatusOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {stageValue && !subs.isLoading && substatusOptions.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Cadastre substatus desta etapa em Configurações → Pipelines.
            </p>
          )}
        </div>
      )}

      {kind === "stage" && stage?.type === "lost" && (
        <p className="text-xs text-muted-foreground">
          Etapa de perda: considere também definir o motivo de perda.
        </p>
      )}
    </div>
  );
}

export function BulkEditFieldsDialog({
  open,
  setOpen,
  entity,
  ids,
  entityLabel,
  priorityFields,
  onDone,
}: Props) {
  const loadCatalog = useServerFn(getEntityFieldCatalog);
  const applyBulk = useServerFn(bulkUpdateEntity);

  const [rows, setRows] = useState<PropertyRow[]>([newRow()]);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) {
      setRows([newRow()]);
      setConfirming(false);
      setBusy(false);
    }
  }, [open]);

  const catalog = useQuery({
    queryKey: ["bulk-edit-catalog", entity],
    enabled: open,
    staleTime: 5 * 60_000,
    queryFn: () => loadCatalog({ data: { entity } }),
  });

  const allFields = useMemo(
    () =>
      dedupeAliasFields((catalog.data?.fields ?? []).filter((f) => !isBulkEditDeniedColumn(f.name))),
    [catalog.data],
  );

  const groups = useMemo(() => {
    const grouped = groupFields(allFields);
    const priority = new Set(priorityFields ?? []);
    const sugeridas = allFields
      .filter((f) => priority.has(f.name))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    return sugeridas.length > 0
      ? [{ group: "Sugeridas para esta tela", fields: sugeridas }, ...grouped]
      : grouped;
  }, [allFields, priorityFields]);

  const fieldByName = useMemo(
    () => new Map(allFields.map((f) => [f.name, f])),
    [allFields],
  );

  const usedNames = useMemo(
    () => new Set(rows.map((r) => r.name).filter((n): n is string => !!n)),
    [rows],
  );

  const patchRow = (key: string, patch: Partial<PropertyRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const filledRows = rows.filter((r) => r.name);

  /** Payload final: valor da propriedade + campos-pai que existem na tabela. */
  const buildPayload = (): Record<string, unknown> | null => {
    const payload: Record<string, unknown> = {};
    for (const row of filledRows) {
      const field = fieldByName.get(row.name as string);
      if (!field) continue;
      const kind = dependencyKindFor(entity, field.name);
      const raw = row.value;
      const isEmpty = raw === "" || raw === undefined || raw === null;

      if (isEmpty && field.required) {
        toast.error(`${field.label}: campo obrigatório não pode ficar vazio.`);
        return null;
      }
      if (isEmpty && (kind === "stage" || kind === "substatus")) {
        toast.error(`${field.label}: selecione um valor para concluir a cascata.`);
        return null;
      }

      payload[field.name] = isEmpty ? null : raw;

      // Campos-pai só entram quando são colunas reais da entidade.
      for (const [depName, depValue] of Object.entries(row.deps)) {
        if (!depValue) continue;
        if (!fieldByName.has(depName)) continue;
        if (payload[depName] !== undefined && payload[depName] !== depValue) {
          toast.error("Valores conflitantes para o mesmo campo. Revise as propriedades.");
          return null;
        }
        payload[depName] = depValue;
      }

      // Etapa exige pipeline quando a tabela tem a coluna.
      if (
        (kind === "stage" || kind === "substatus") &&
        fieldByName.has(PIPELINE_FIELD) &&
        !payload[PIPELINE_FIELD]
      ) {
        toast.error("Selecione o pipeline da etapa.");
        return null;
      }
      if (kind === "substatus" && !row.deps["stage"]) {
        toast.error("Selecione a etapa do substatus.");
        return null;
      }
      // Substatus grava também a etapa quando a coluna existe.
      if (kind === "substatus") {
        for (const stageCol of STAGE_FIELDS) {
          if (fieldByName.has(stageCol) && payload[stageCol] === undefined) {
            payload[stageCol] = row.deps["stage"];
          }
        }
      }
    }
    return payload;
  };

  const apply = async () => {
    if (filledRows.length === 0) {
      toast.error("Escolha ao menos uma propriedade para editar");
      return;
    }
    const names = filledRows.map((r) => r.name as string);
    if (new Set(names).size !== names.length) {
      toast.error("A mesma propriedade foi escolhida duas vezes.");
      return;
    }
    const conflict = findAliasConflict(names, allFields);
    if (conflict) {
      toast.error(
        `${conflict.canonicalLabel} e ${conflict.aliasLabel} apontam para o mesmo dado. Escolha apenas um deles.`,
      );
      return;
    }
    const payload = buildPayload();
    if (!payload) return;

    setBusy(true);
    try {
      const res = await applyBulk({ data: { entity, ids, values: payload } });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      if (res.updated === 0) {
        toast.error("Nenhum registro foi alterado. Verifique suas permissões.");
        return;
      }
      if (res.updated < res.requested) {
        toast.warning(
          `${res.updated} de ${res.requested} atualizado(s). Verifique suas permissões.`,
        );
      } else {
        toast.success(`${res.updated.toLocaleString("pt-BR")} registro(s) atualizado(s)`);
      }
      setOpen(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao aplicar a edição em massa");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[85vh] max-w-xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            Edição em massa de {ids.length.toLocaleString("pt-BR")} {entityLabel}
          </DialogTitle>
          <DialogDescription>
            Escolha a propriedade e informe o novo valor. Valores em branco limpam o campo nos
            registros selecionados.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {catalog.isLoading && (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          )}

          {catalog.isError && (
            <div className="rounded-md border border-destructive/40 p-4 text-sm" role="alert">
              <p className="font-medium">Não foi possível carregar as propriedades.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => catalog.refetch()}
              >
                Tentar novamente
              </Button>
            </div>
          )}

          {!catalog.isLoading && !catalog.isError && allFields.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma propriedade disponível para edição em massa nesta entidade.
            </p>
          )}

          {!catalog.isLoading &&
            !catalog.isError &&
            allFields.length > 0 &&
            rows.map((row, index) => {
              const field = row.name ? (fieldByName.get(row.name) ?? null) : null;
              const kind = field ? dependencyKindFor(entity, field.name) : null;
              return (
                <div key={row.key} className="space-y-3 rounded-md border p-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Propriedade a atualizar</Label>
                      {rows.length > 1 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Remover propriedade ${index + 1}`}
                          onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                          disabled={busy}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <PropertyCombobox
                      groups={groups}
                      value={field}
                      usedNames={usedNames}
                      onSelect={(f) =>
                        patchRow(row.key, { name: f.name, value: "", deps: {} })
                      }
                    />
                  </div>

                  {field && kind && (
                    <DependentEditor
                      kind={kind}
                      field={field}
                      entity={entity}
                      row={row}
                      onChange={(patch) => patchRow(row.key, patch)}
                    />
                  )}

                  {field && !kind && (
                    <div className="space-y-2">
                      <Label htmlFor={`bulk-${field.name}`}>
                        {field.label}
                        {field.required && <span className="ml-1 text-destructive">*</span>}
                      </Label>
                      <FieldEditor
                        field={field}
                        value={row.value}
                        onChange={(v) => patchRow(row.key, { value: v })}
                      />
                    </div>
                  )}
                </div>
              );
            })}

          {!catalog.isLoading && !catalog.isError && allFields.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRows((prev) => [...prev, newRow()])}
              disabled={busy || rows.some((r) => !r.name)}
            >
              <Plus className="mr-1 h-4 w-4" /> Adicionar outra propriedade
            </Button>
          )}
        </div>

        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {filledRows.length === 0
              ? "Nenhuma propriedade escolhida."
              : `${filledRows.length} propriedade(s) em ${ids.length.toLocaleString("pt-BR")} registro(s).`}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            {confirming ? (
              <Button onClick={apply} disabled={busy}>
                {busy ? "Aplicando…" : "Confirmar alteração"}
              </Button>
            ) : (
              <Button
                onClick={() => setConfirming(true)}
                disabled={busy || filledRows.length === 0}
              >
                Atualizar
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
