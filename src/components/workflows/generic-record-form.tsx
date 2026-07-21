// Form para ações genéricas create_record / update_record / delete_record.
// Permite escolher qualquer tabela da whitelist e editar os campos como
// pares chave/valor (com suporte a tokens {{campo}} nos valores).
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  WORKFLOW_WRITABLE_TABLES,
  ENTITY_LABELS,
  type WorkflowAction,
  type WorkflowWritableTable,
} from "@/lib/workflows/types";

type GenericAction = Extract<
  WorkflowAction,
  { type: "create_record" | "update_record" | "delete_record" }
>;

interface Props {
  action: GenericAction;
  onChange: (next: GenericAction) => void;
}

function tableLabel(t: WorkflowWritableTable): string {
  // ENTITY_LABELS cobre a maioria; activities é caso especial.
  return (ENTITY_LABELS as Record<string, string>)[t] ?? t;
}

export function GenericRecordForm({ action, onChange }: Props) {
  const hasValues = action.type !== "delete_record";
  const values = hasValues ? (action as { values: Record<string, unknown> }).values : {};
  const entries = Object.entries(values);

  const setTable = (v: string) => {
    onChange({ ...action, table: v as WorkflowWritableTable } as GenericAction);
  };

  const setValue = (key: string, val: string) => {
    if (!hasValues) return;
    const next = { ...(values as Record<string, unknown>), [key]: val };
    onChange({ ...(action as GenericAction), values: next } as unknown as GenericAction);
  };

  const renameKey = (oldK: string, newK: string) => {
    if (!hasValues || !newK || newK === oldK) return;
    const next: Record<string, unknown> = {};
    for (const [k, v] of entries) next[k === oldK ? newK : k] = v;
    onChange({ ...(action as GenericAction), values: next } as unknown as GenericAction);
  };

  const removeKey = (k: string) => {
    if (!hasValues) return;
    const next = { ...(values as Record<string, unknown>) };
    delete next[k];
    onChange({ ...(action as GenericAction), values: next } as unknown as GenericAction);
  };

  const addField = () => {
    if (!hasValues) return;
    let base = "campo";
    let i = 1;
    while (`${base}${i}` in values) i++;
    const next = { ...(values as Record<string, unknown>), [`${base}${i}`]: "" };
    onChange({ ...(action as GenericAction), values: next } as unknown as GenericAction);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Tabela alvo</Label>
        <Select value={action.table} onValueChange={setTable}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {WORKFLOW_WRITABLE_TABLES.map((t) => (
              <SelectItem key={t} value={t}>{tableLabel(t)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(action.type === "update_record" || action.type === "delete_record") && (
        <div>
          <Label className="text-xs">ID do registro (aceita tokens, ex.: {"{{id}}"})</Label>
          <Input
            value={action.target_id}
            onChange={(e) => onChange({ ...action, target_id: e.target.value })}
            placeholder="{{id}}"
          />
        </div>
      )}

      {hasValues && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Valores</Label>
            <Button type="button" size="sm" variant="ghost" onClick={addField}>
              <Plus className="h-3 w-3 mr-1" /> adicionar campo
            </Button>
          </div>
          {entries.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhum campo definido. Clique em "adicionar campo" para começar.
            </p>
          )}
          {entries.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[1fr_1.5fr_auto] gap-2 items-center">
              <Input
                defaultValue={k}
                onBlur={(e) => renameKey(k, e.target.value.trim())}
                placeholder="nome_do_campo"
              />
              <Input
                value={typeof v === "string" ? v : String(v ?? "")}
                onChange={(e) => setValue(k, e.target.value)}
                placeholder="valor (suporta {{tokens}})"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => removeKey(k)}
                aria-label="remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {action.type === "create_record" && (
        <p className="text-[11px] text-muted-foreground">
          O campo <code>owner_id</code> é preenchido automaticamente com o dono do workflow
          quando a tabela alvo possuir essa coluna.
        </p>
      )}
    </div>
  );
}
