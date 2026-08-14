import type { FieldOpt } from "./step-tree";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Braces, List, X } from "lucide-react";
import { FkPicker } from "../extra-fields-editor";
import { TokenInput } from "../token-input";
import { FILTER_OPS, type WorkflowFilter, type WorkflowCondition, type WorkflowFilterGroup, type FilterOp, isFilterGroup } from "@/lib/workflows/types";
import { conditionsSummary } from "@/lib/workflows/conditions";

/** Cria uma condição simples com o campo padrão. */
export function newLeafCondition(field: string): WorkflowFilter {
  return { field, op: "eq", value: "" };
}

/** Verifica (recursivamente) se algum campo informado é usado nas condições. */
export function conditionsIncludeField(
  nodes: WorkflowCondition[] | null | undefined,
  fieldNames: string[],
): boolean {
  return (nodes ?? []).some((n) =>
    isFilterGroup(n)
      ? conditionsIncludeField(n.conditions, fieldNames)
      : fieldNames.includes(n.field),
  );
}

export function normalizeTopGroup(list: WorkflowCondition[]): WorkflowFilterGroup {
  if (list.length === 1 && isFilterGroup(list[0])) return list[0];
  return { logic: "and", conditions: list };
}

export function denormalizeTopGroup(group: WorkflowFilterGroup): WorkflowCondition[] {
  return group.logic === "and" ? group.conditions : [group];
}

export const MAX_CONDITION_DEPTH_UI = 3;

/** Editor de uma lista de condições com suporte a E/OU e grupos aninhados. */
export function ConditionListEditor({
  value,
  onChange,
  fields,
  priorFields = [],
  defaultField,
}: {
  value: WorkflowCondition[] | undefined;
  onChange: (next: WorkflowCondition[]) => void;
  fields: FieldOpt[];
  priorFields?: FieldOpt[];
  defaultField: string;
}) {
  const group = normalizeTopGroup(value ?? []);
  return (
    <ConditionGroupEditor
      group={group}
      depth={1}
      fields={fields}
      priorFields={priorFields}
      defaultField={defaultField}
      onChange={(g) => onChange(denormalizeTopGroup(g))}
    />
  );
}

export function ConditionGroupEditor({
  group,
  onChange,
  onRemove,
  fields,
  priorFields = [],
  defaultField,
  depth,
}: {
  group: WorkflowFilterGroup;
  onChange: (g: WorkflowFilterGroup) => void;
  onRemove?: () => void;
  fields: FieldOpt[];
  priorFields?: FieldOpt[];
  defaultField: string;
  depth: number;
}) {
  const children = group.conditions ?? [];
  const setChildren = (fn: (list: WorkflowCondition[]) => WorkflowCondition[]) =>
    onChange({ ...group, conditions: fn(children) });
  const canNest = depth < MAX_CONDITION_DEPTH_UI;

  return (
    <div
      className={
        depth > 1
          ? "rounded-md border border-l-2 border-l-primary/60 bg-muted/30 p-2 space-y-2"
          : "space-y-2"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Select
            value={group.logic}
            onValueChange={(v) => onChange({ ...group, logic: v as "and" | "or" })}
          >
            <SelectTrigger
              className="h-7 w-[104px] text-xs"
              aria-label="Operador entre as condições do grupo"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="and">E (todas)</SelectItem>
              <SelectItem value="or">OU (qualquer)</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[11px] text-muted-foreground">{conditionsSummary(children)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!defaultField}
            onClick={() => setChildren((p) => [...p, newLeafCondition(defaultField)])}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Condição
          </Button>
          {canNest && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!defaultField}
              onClick={() =>
                setChildren((p) => [
                  ...p,
                  { logic: "or", conditions: [newLeafCondition(defaultField)] },
                ])
              }
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Grupo
            </Button>
          )}
          {onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onRemove}
              aria-label="Remover grupo de condições"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {children.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhuma condição neste grupo.</p>
      )}

      {children.map((node, i) =>
        isFilterGroup(node) ? (
          <ConditionGroupEditor
            key={i}
            group={node}
            depth={depth + 1}
            fields={fields}
            priorFields={priorFields}
            defaultField={defaultField}
            onChange={(g) => setChildren((p) => p.map((x, idx) => (idx === i ? g : x)))}
            onRemove={() => setChildren((p) => p.filter((_, idx) => idx !== i))}
          />
        ) : (
          <FilterRow
            key={i}
            filter={node}
            fields={fields}
            priorFields={priorFields}
            onChange={(nf) => setChildren((p) => p.map((x, idx) => (idx === i ? nf : x)))}
            onRemove={() => setChildren((p) => p.filter((_, idx) => idx !== i))}
          />
        ),
      )}
    </div>
  );
}

// ============================================================================
// Editor de valor de campo — reutilizado por filtros e formulários de passo.
// Regra única: referência → busca por nome; valores conhecidos → combo;
// senão → texto com pills de {{tokens}}.
// ============================================================================
export function FieldValueEditor({
  field,
  value,
  onChange,
  placeholder = "valor",
  compact = false,
}: {
  field?: FieldOpt;
  value: unknown;
  onChange: (v: string | number) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const str =
    value === null || value === undefined || typeof value === "object" ? "" : String(value);
  const isToken = /\{\{.+\}\}/.test(str);
  const [tokenMode, setTokenMode] = useState(isToken);
  const options = field?.options ?? [];

  if (field?.ref) {
    return <FkPicker kind={field.ref} value={str} onChange={(v) => onChange(v)} />;
  }

  if (options.length > 0 && !tokenMode) {
    // Mantém valores salvos que não estão mais na lista canônica.
    const extra = str && !options.some((o) => o.value === str) ? [{ value: str, label: str }] : [];
    return (
      <div className="flex items-center gap-1">
        <Select value={str || undefined} onValueChange={(v) => onChange(v)}>
          <SelectTrigger className={compact ? "h-8 text-xs" : undefined}>
            <SelectValue placeholder="Selecionar valor" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {[...options, ...extra].map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="Usar variável no lugar de um valor da lista"
          title="Usar variável ({{token}})"
          onClick={() => setTokenMode(true)}
        >
          <Braces className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  if (options.length > 0 && tokenMode) {
    return (
      <div className="flex items-center gap-1">
        <TokenInput value={str} onValueChange={(v) => onChange(v)} placeholder="{{campo}}" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="Voltar para a lista de valores"
          title="Escolher da lista"
          onClick={() => setTokenMode(false)}
        >
          <List className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  if (field?.type === "number" || field?.type === "date") {
    return (
      <Input
        className={compact ? "h-8 text-xs" : undefined}
        type={field.type === "number" ? "number" : "date"}
        value={str}
        onChange={(e) => {
          const raw = e.target.value;
          const coerced: string | number =
            field.type === "number" && raw !== "" && !Number.isNaN(Number(raw)) ? Number(raw) : raw;
          onChange(coerced);
        }}
        placeholder={placeholder}
      />
    );
  }

  return <TokenInput value={str} onValueChange={(v) => onChange(v)} placeholder={placeholder} />;
}

export function FilterRow({
  filter,
  fields,
  priorFields = [],
  onChange,
  onRemove,
}: {
  filter: WorkflowFilter;
  fields: FieldOpt[];
  /** Saídas de passos anteriores (`steps.N.campo`), quando disponíveis. */
  priorFields?: FieldOpt[];
  onChange: (f: WorkflowFilter) => void;
  onRemove: () => void;
}) {
  const needsValue = filter.op !== "is_empty" && filter.op !== "is_not_empty";
  const isPriorStep = filter.field?.startsWith("steps.") ?? false;
  const selected = isPriorStep ? undefined : fields.find((f) => f.name === filter.field);
  const missingSelectedField =
    !isPriorStep && filter.field && !fields.some((field) => field.name === filter.field);
  const options = selected?.options;
  const type = selected?.type;
  return (
    <div className="space-y-2 rounded-md border p-2 bg-card">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Select value={filter.field} onValueChange={(v) => onChange({ ...filter, field: v })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Selecionar propriedade" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectGroup>
              <SelectLabel className="text-[11px]">Propriedades do registro</SelectLabel>
              {fields.map((f) => (
                <SelectItem key={f.name} value={f.name}>
                  {f.label}
                </SelectItem>
              ))}
              {missingSelectedField && (
                <SelectItem value={filter.field}>{filter.field.replace(/_/g, " ")}</SelectItem>
              )}
            </SelectGroup>
            {priorFields.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-[11px]">Passos anteriores</SelectLabel>
                {priorFields.map((f) => (
                  <SelectItem key={f.name} value={f.name}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {isPriorStep && !priorFields.some((f) => f.name === filter.field) && (
              <SelectItem value={filter.field}>{filter.field}</SelectItem>
            )}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remover condição">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Select value={filter.op} onValueChange={(v) => onChange({ ...filter, op: v as FilterOp })}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FILTER_OPS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {needsValue && (
        <FieldValueEditor
          field={selected ?? (type ? { name: filter.field, label: filter.field, type } : undefined)}
          value={filter.value}
          onChange={(v) => onChange({ ...filter, value: v })}
          compact
        />
      )}
    </div>
  );
}

// ============================================================================
// Right-panel: Step config (formulários por tipo)
// ============================================================================
