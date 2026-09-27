// Form para ações genéricas create_record / update_record / delete_record.
// Usa o catálogo de campos da tabela alvo (mesmo mecanismo do "Mais campos"
// dos create_* específicos) para expor inputs tipados com rótulos amigáveis,
// selects para FKs e enums, datepickers, switches para booleanos e suporte a
// tokens {{campo}} onde faz sentido. Campos fora do catálogo (custom fields,
// colunas novas) ficam disponíveis como pares chave/valor livres.
import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExtraFieldsEditor } from "./extra-fields-editor";
import { TokenInput } from "./token-input";
import {
  WORKFLOW_WRITABLE_TABLES,
  ENTITY_LABELS,
  type WorkflowAction,
  type WorkflowEntity,
  type WorkflowWritableTable,
} from "@/lib/workflows/types";

type GenericAction = Extract<
  WorkflowAction,
  { type: "create_record" | "update_record" | "delete_record" }
>;

interface Props {
  action: GenericAction;
  onChange: (next: GenericAction) => void;
  /** Entidade que dispara o workflow. */
  triggerEntity?: WorkflowEntity;
}

function tableLabel(t: WorkflowWritableTable): string {
  return (ENTITY_LABELS as Record<string, string>)[t] ?? t;
}

export function GenericRecordForm({ action, onChange, triggerEntity }: Props) {
  const hasValues = action.type !== "delete_record";

  const values = useMemo<Record<string, unknown>>(() => {
    if (!hasValues) return {};
    return (action as { values?: Record<string, unknown> }).values ?? {};
  }, [action, hasValues]);

  const setTable = (v: string) => {
    // Ao trocar de tabela, limpa valores para não vazar campos incompatíveis.
    const next: GenericAction = hasValues
      ? ({ ...action, table: v as WorkflowWritableTable, values: {} } as GenericAction)
      : ({ ...action, table: v as WorkflowWritableTable } as GenericAction);
    onChange(next);
  };

  const setValues = (nextVals: Record<string, unknown> | undefined) => {
    if (!hasValues) return;
    onChange({ ...(action as GenericAction), values: nextVals ?? {} } as unknown as GenericAction);
  };

  // owner_id é preenchido automaticamente pela engine quando a tabela tem a coluna.
  const HIDDEN_IN_GENERIC = ["owner_id", "workspace_id"];

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Tabela alvo</Label>
        <Select value={action.table} onValueChange={setTable}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WORKFLOW_WRITABLE_TABLES.map((t) => (
              <SelectItem key={t} value={t}>
                {tableLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(action.type === "update_record" || action.type === "delete_record") && (
        <div>
          <Label className="text-xs">ID do registro (aceita tokens, ex.: {"{{id}}"})</Label>
          <TokenInput
            value={action.target_id ?? ""}
            onValueChange={(v) => onChange({ ...action, target_id: v })}
            placeholder="{{id}}"
          />
        </div>
      )}

      {hasValues && (
        <>
          {action.type === "create_record" && (
            <section aria-label="Resumo da ação" className="border-b pb-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">
                    CRIAR {tableLabel(action.table).toLocaleUpperCase("pt-BR")}
                  </p>
                  <p className="text-muted-foreground">
                    {
                      Object.values(values).filter(
                        (value) => value !== null && value !== undefined && value !== "",
                      ).length
                    }{" "}
                    campos configurados
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("wf-generic-fields-toggle")?.click()}
                >
                  Editar campos
                </Button>
              </div>
              <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                {Object.entries(values)
                  .filter(([, value]) => value !== null && value !== undefined && value !== "")
                  .slice(0, 6)
                  .map(([key, value]) => (
                    <div key={key} className="flex gap-2 min-w-0">
                      <dt className="text-muted-foreground truncate">{key}:</dt>
                      <dd className="truncate font-medium">
                        {typeof value === "object" ? "Configurado" : String(value)}
                      </dd>
                    </div>
                  ))}
              </dl>
            </section>
          )}
          <ExtraFieldsEditor
            key={action.table}
            entity={action.table}
            extraFields={values}
            hiddenKeys={HIDDEN_IN_GENERIC}
            onChange={setValues}
            triggerEntity={triggerEntity}
            title="Campos do registro"
            defaultOpen
          />
          {/* Fallback para colunas fora do catálogo (custom fields livres). */}
          <details className="rounded-md border border-border/60 bg-muted/20">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
              Campo avançado (chave/valor livre)
            </summary>
            <div className="border-t border-border/60 px-3 py-2.5">
              <FreeKeyValueEditor values={values} onChange={setValues} />
            </div>
          </details>
        </>
      )}

      {action.type === "create_record" && (
        <p className="text-[11px] text-muted-foreground">
          O campo <code>owner_id</code> é preenchido automaticamente com o dono do workflow quando a
          tabela alvo possuir essa coluna.
        </p>
      )}
    </div>
  );
}

// Editor livre — usado só como escape hatch para colunas não presentes no
// catálogo (custom fields, colunas adicionadas depois do build). O editor
// tipado acima já cobre a esmagadora maioria dos casos.
function FreeKeyValueEditor({
  values,
  onChange,
}: {
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const entries = Object.entries(values);
  const rename = (oldK: string, newK: string) => {
    if (!newK || newK === oldK) return;
    const next: Record<string, unknown> = {};
    for (const [k, v] of entries) next[k === oldK ? newK : k] = v;
    onChange(next);
  };
  const setVal = (k: string, v: string) => {
    onChange({ ...values, [k]: v });
  };
  const add = () => {
    let i = 1;
    while (`campo${i}` in values) i++;
    onChange({ ...values, [`campo${i}`]: "" });
  };
  return (
    <div className="space-y-2">
      {entries.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Nenhum par livre. Use apenas para colunas que não aparecem acima.
        </p>
      )}
      {entries.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[1fr_1.5fr] gap-2">
          <Input
            defaultValue={k}
            onBlur={(e) => rename(k, e.target.value.trim())}
            placeholder="nome_da_coluna"
          />
          <TokenInput
            value={typeof v === "string" ? v : String(v ?? "")}
            onValueChange={(nv) => setVal(k, nv)}
            placeholder="valor (aceita {{tokens}})"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        + adicionar par livre
      </button>
    </div>
  );
}
