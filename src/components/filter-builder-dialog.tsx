import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import type { FilterCondition, FilterGroup, FilterNode, FilterOp } from "@/lib/filters";

type FieldDef = {
  name: string;
  label: string;
  type?: string;
  options?: { value: string; label: string }[];
};

const OPS_BY_TYPE: Record<string, { value: FilterOp; label: string }[]> = {
  text: [
    { value: "ilike", label: "contém" },
    { value: "eq", label: "é igual a" },
    { value: "neq", label: "é diferente de" },
    { value: "is_null", label: "está vazio" },
    { value: "is_not_null", label: "não está vazio" },
  ],
  select: [
    { value: "eq", label: "é" },
    { value: "neq", label: "não é" },
    { value: "in", label: "está em" },
    { value: "is_null", label: "vazio" },
    { value: "is_not_null", label: "preenchido" },
  ],
  number: [
    { value: "eq", label: "=" },
    { value: "neq", label: "≠" },
    { value: "gt", label: ">" },
    { value: "gte", label: "≥" },
    { value: "lt", label: "<" },
    { value: "lte", label: "≤" },
  ],
  date: [
    { value: "gte", label: "depois de" },
    { value: "lte", label: "antes de" },
    { value: "is_null", label: "vazio" },
    { value: "is_not_null", label: "preenchido" },
  ],
};

function opsFor(type?: string) {
  if (!type) return OPS_BY_TYPE.text;
  return OPS_BY_TYPE[type] ?? OPS_BY_TYPE.text;
}

export function FilterBuilderDialog({
  open,
  setOpen,
  fields,
  value,
  onApply,
}: {
  open: boolean;
  setOpen: (b: boolean) => void;
  fields: FieldDef[];
  value: FilterGroup;
  onApply: (g: FilterGroup) => void;
}) {
  const [draft, setDraft] = useState<FilterGroup>(value);

  const updateGroup = (g: FilterGroup) => setDraft(g);
  const addCondition = () => {
    setDraft({
      ...draft,
      conditions: [
        ...draft.conditions,
        { type: "condition", field: fields[0]?.name ?? "id", op: "ilike", value: "" },
      ],
    });
  };
  const updateCond = (i: number, c: FilterCondition) => {
    const next = [...draft.conditions];
    next[i] = c;
    setDraft({ ...draft, conditions: next });
  };
  const removeCond = (i: number) => {
    const next = draft.conditions.filter((_, idx) => idx !== i);
    setDraft({ ...draft, conditions: next });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Filtros avançados</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Label>Combinar com</Label>
            <select
              className="h-8 rounded-md border bg-background px-2"
              value={draft.op}
              onChange={(e) => updateGroup({ ...draft, op: e.target.value as "and" | "or" })}
            >
              <option value="and">E (AND)</option>
              <option value="or">OU (OR)</option>
            </select>
          </div>
          {draft.conditions.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma condição. Adicione abaixo.</p>
          )}
          {draft.conditions.map((node, i) => {
            if (node.type !== "condition") return null;
            const field = fields.find((f) => f.name === node.field);
            const ops = opsFor(field?.type);
            const needsValue = !["is_null", "is_not_null"].includes(node.op);
            return (
              <div key={i} className="flex items-center gap-2">
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={node.field}
                  onChange={(e) => {
                    const newField = fields.find((f) => f.name === e.target.value);
                    updateCond(i, {
                      ...node,
                      field: e.target.value,
                      op: opsFor(newField?.type)[0].value,
                      value: "",
                    });
                  }}
                >
                  {fields.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={node.op}
                  onChange={(e) => updateCond(i, { ...node, op: e.target.value as FilterOp })}
                >
                  {ops.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {needsValue &&
                  (field?.type === "select" && field.options ? (
                    <select
                      className="h-9 rounded-md border bg-background px-2 text-sm flex-1"
                      value={String(node.value ?? "")}
                      onChange={(e) => updateCond(i, { ...node, value: e.target.value })}
                    >
                      <option value="">—</option>
                      {field.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      className="flex-1"
                      type={
                        field?.type === "date"
                          ? "date"
                          : field?.type === "number"
                            ? "number"
                            : "text"
                      }
                      value={String(node.value ?? "")}
                      onChange={(e) => updateCond(i, { ...node, value: e.target.value })}
                    />
                  ))}
                <Button variant="ghost" size="icon" onClick={() => removeCond(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          <Button variant="outline" size="sm" onClick={addCondition}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar condição
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setDraft({ type: "group", op: "and", conditions: [] });
            }}
          >
            Limpar
          </Button>
          <Button
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
          >
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { FilterNode, FilterGroup, FilterCondition };
