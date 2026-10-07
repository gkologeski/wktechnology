import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CHOICE_TYPES,
  FIELD_LABEL,
  isInput,
  isScorable,
  type ConditionOp,
  type FormField,
  type FormSchema,
  type Option,
} from "@/lib/surveys/form-schema";

const OPS: { value: ConditionOp; label: string }[] = [
  { value: "equals", label: "é igual a" },
  { value: "not_equals", label: "não é" },
  { value: "contains", label: "contém" },
  { value: "not_contains", label: "não contém" },
  { value: "filled", label: "está preenchido" },
  { value: "empty", label: "está vazio" },
  { value: "gt", label: "maior que" },
  { value: "lt", label: "menor que" },
];
const uid = () => crypto.randomUUID();

function Row({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
      {children}
    </div>
  );
}
function Toggle({
  id,
  label,
  checked,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <Label htmlFor={id} className="text-xs">
          {label}
        </Label>
        {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
const num = (v: string) => (v === "" ? undefined : Number(v));

function OptionsEditor({
  title,
  items,
  onChange,
  withPoints,
}: {
  title: string;
  items: Option[];
  onChange: (o: Option[]) => void;
  withPoints: boolean;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-medium">{title}</legend>
      {items.map((o, i) => (
        <div key={o.id} className="flex items-center gap-1">
          <GripVertical className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            aria-label={`${title} ${i + 1}`}
            value={o.label}
            className="h-8"
            onChange={(e) =>
              onChange(items.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)))
            }
          />
          {withPoints && (
            <Input
              aria-label={`Pontos de ${o.label}`}
              type="number"
              className="h-8 w-16"
              placeholder="pts"
              value={o.points ?? ""}
              onChange={(e) =>
                onChange(
                  items.map((x) =>
                    x.id === o.id
                      ? { ...x, points: e.target.value === "" ? null : Number(e.target.value) }
                      : x,
                  ),
                )
              }
            />
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Remover ${o.label}`}
            disabled={items.length <= 1}
            onClick={() => onChange(items.filter((x) => x.id !== o.id))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, { id: uid(), label: `Opção ${items.length + 1}` }])}
      >
        <Plus /> Adicionar
      </Button>
    </fieldset>
  );
}

export function FieldProperties({
  schema,
  field: f,
  onChange,
}: {
  schema: FormSchema;
  field: FormField;
  onChange: (f: FormField) => void;
}) {
  const set = (p: Partial<FormField>) => onChange({ ...f, ...p });
  const index = schema.fields.findIndex((x) => x.id === f.id);
  const earlier = schema.fields.slice(0, index).filter((x) => isInput(x.type));
  const cond = f.showIf ?? { mode: "all" as const, rules: [] };
  const canScore = schema.scoringEnabled && isScorable(f.type);
  const k = `prop-${f.id}`;
  return (
    <div className="space-y-4" data-properties={f.type}>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {FIELD_LABEL[f.type]}
        </p>
        {f.source && (
          <p
            className={`mt-1 text-[11px] ${f.source.confidence === "baixa" ? "text-warning" : "text-muted-foreground"}`}
          >
            Importado{f.source.page ? ` · página ${f.source.page}` : ""}
            {f.source.confidence === "baixa" ? " · baixa confiança, revise" : ""}
          </p>
        )}
      </div>
      <Row label={f.type === "paragraph" ? "Texto" : "Enunciado"} htmlFor={`${k}-l`}>
        <Textarea
          id={`${k}-l`}
          rows={2}
          value={f.label}
          onChange={(e) => set({ label: e.target.value })}
        />
      </Row>
      {f.type !== "paragraph" && f.type !== "page_break" && (
        <Row label="Descrição / ajuda" htmlFor={`${k}-d`}>
          <Input
            id={`${k}-d`}
            value={f.description ?? ""}
            onChange={(e) => set({ description: e.target.value || undefined })}
          />
        </Row>
      )}
      {[
        "short_text",
        "long_text",
        "email",
        "phone",
        "url",
        "number",
        "currency",
        "dropdown",
      ].includes(f.type) && (
        <Row label="Texto de exemplo (placeholder)" htmlFor={`${k}-p`}>
          <Input
            id={`${k}-p`}
            value={f.placeholder ?? ""}
            onChange={(e) => set({ placeholder: e.target.value || undefined })}
          />
        </Row>
      )}
      {isInput(f.type) && (
        <>
          <Toggle
            id={`${k}-r`}
            label="Obrigatória"
            checked={!!f.required}
            onChange={(required) => set({ required })}
            hint="Se ficar oculta por condição, não bloqueia o envio."
          />
          <Row label="Largura" htmlFor={`${k}-w`}>
            <Select
              value={f.width ?? "full"}
              onValueChange={(v) => set({ width: v as "full" | "half" })}
            >
              <SelectTrigger id={`${k}-w`} className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Linha inteira</SelectItem>
                <SelectItem value="half">Meia linha</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </>
      )}
      {["short_text", "long_text"].includes(f.type) && (
        <Row label="Limite de caracteres" htmlFor={`${k}-ml`}>
          <Input
            id={`${k}-ml`}
            type="number"
            min={1}
            value={f.maxLength ?? ""}
            onChange={(e) => set({ maxLength: num(e.target.value) })}
          />
        </Row>
      )}
      {["number", "currency", "linear_scale"].includes(f.type) && (
        <div className="grid grid-cols-2 gap-2">
          <Row label="Mínimo" htmlFor={`${k}-min`}>
            <Input
              id={`${k}-min`}
              type="number"
              value={f.min ?? ""}
              onChange={(e) => set({ min: num(e.target.value) })}
            />
          </Row>
          <Row label="Máximo" htmlFor={`${k}-max`}>
            <Input
              id={`${k}-max`}
              type="number"
              value={f.max ?? ""}
              onChange={(e) => set({ max: num(e.target.value) })}
            />
          </Row>
        </div>
      )}
      {["linear_scale", "nps"].includes(f.type) && (
        <div className="grid grid-cols-2 gap-2">
          <Row label="Rótulo inicial" htmlFor={`${k}-a`}>
            <Input
              id={`${k}-a`}
              value={f.minLabel ?? ""}
              onChange={(e) => set({ minLabel: e.target.value || undefined })}
            />
          </Row>
          <Row label="Rótulo final" htmlFor={`${k}-b`}>
            <Input
              id={`${k}-b`}
              value={f.maxLabel ?? ""}
              onChange={(e) => set({ maxLabel: e.target.value || undefined })}
            />
          </Row>
        </div>
      )}
      {f.type === "rating" && (
        <Row label="Quantidade de estrelas" htmlFor={`${k}-s`}>
          <Input
            id={`${k}-s`}
            type="number"
            min={3}
            max={10}
            value={f.stars ?? 5}
            onChange={(e) => set({ stars: Math.min(10, Math.max(3, Number(e.target.value) || 5)) })}
          />
        </Row>
      )}
      {f.type === "matrix" && (
        <OptionsEditor
          title="Linhas"
          items={f.rows ?? []}
          onChange={(rows) => set({ rows })}
          withPoints={false}
        />
      )}
      {(CHOICE_TYPES.includes(f.type) || f.type === "matrix") && (
        <OptionsEditor
          title={f.type === "matrix" ? "Colunas" : "Opções"}
          items={f.options ?? []}
          onChange={(options) => set({ options })}
          withPoints={canScore && !!f.scored}
        />
      )}
      {canScore && (
        <div className="space-y-2 rounded-md border border-border-subtle p-3">
          <Toggle
            id={`${k}-sc`}
            label="Pontuar esta pergunta"
            checked={!!f.scored}
            onChange={(scored) => set({ scored })}
            hint="Independente de ser obrigatória."
          />
          {f.scored && (
            <Row label="Peso" htmlFor={`${k}-wt`}>
              <Input
                id={`${k}-wt`}
                type="number"
                min={0}
                step="0.5"
                value={f.weight ?? 1}
                onChange={(e) => set({ weight: Number(e.target.value) || 0 })}
              />
            </Row>
          )}
        </div>
      )}
      {!schema.scoringEnabled && isScorable(f.type) && (
        <p className="text-[11px] text-muted-foreground">
          Pontuação desligada nesta pesquisa (aba Configurações).
        </p>
      )}
      <fieldset className="space-y-2 border-t border-border-subtle pt-3">
        <legend className="text-xs font-medium">
          {f.type === "page_break" ? "Exibir esta página quando" : "Mostrar somente quando"}
        </legend>
        {!earlier.length && (
          <p className="text-[11px] text-muted-foreground">
            Condições usam perguntas anteriores; não há nenhuma acima.
          </p>
        )}
        {cond.rules.length > 1 && (
          <div className="flex gap-1" role="radiogroup" aria-label="Combinação das regras">
            {(["all", "any"] as const).map((m) => (
              <Button
                key={m}
                type="button"
                size="sm"
                variant={cond.mode === m ? "default" : "outline"}
                aria-pressed={cond.mode === m}
                onClick={() => set({ showIf: { ...cond, mode: m } })}
              >
                {m === "all" ? "Todas (E)" : "Qualquer (OU)"}
              </Button>
            ))}
          </div>
        )}
        {cond.rules.map((r, i) => {
          const upd = (p: Partial<typeof r>) =>
            set({
              showIf: { ...cond, rules: cond.rules.map((x, j) => (j === i ? { ...x, ...p } : x)) },
            });
          const target = schema.fields.find((x) => x.id === r.fieldId);
          return (
            <div key={i} className="space-y-1 rounded-md border border-border-subtle p-2">
              <div className="flex gap-1">
                <Select value={r.fieldId} onValueChange={(fieldId) => upd({ fieldId })}>
                  <SelectTrigger aria-label={`Campo da regra ${i + 1}`} className="h-8 min-w-0">
                    <SelectValue placeholder={target ? undefined : "Campo excluído"} />
                  </SelectTrigger>
                  <SelectContent>
                    {earlier.map((x) => (
                      <SelectItem key={x.id} value={x.id}>
                        {x.label || FIELD_LABEL[x.type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Remover regra ${i + 1}`}
                  onClick={() => {
                    const rules = cond.rules.filter((_, j) => j !== i);
                    set({ showIf: rules.length ? { ...cond, rules } : null });
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
              <Select value={r.op} onValueChange={(op) => upd({ op: op as ConditionOp })}>
                <SelectTrigger aria-label={`Operador da regra ${i + 1}`} className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!["filled", "empty"].includes(r.op) &&
                (target && (CHOICE_TYPES.includes(target.type) || target.type === "boolean") ? (
                  <Select value={r.value ?? ""} onValueChange={(value) => upd({ value })}>
                    <SelectTrigger aria-label={`Valor da regra ${i + 1}`} className="h-8">
                      <SelectValue placeholder="Valor" />
                    </SelectTrigger>
                    <SelectContent>
                      {(target.type === "boolean"
                        ? [
                            { id: "t", label: "true" },
                            { id: "f", label: "false" },
                          ]
                        : (target.options ?? [])
                      ).map((o) => (
                        <SelectItem key={o.id} value={o.label}>
                          {o.label === "true" ? "Sim" : o.label === "false" ? "Não" : o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    aria-label={`Valor da regra ${i + 1}`}
                    className="h-8"
                    placeholder="Valor"
                    value={r.value ?? ""}
                    onChange={(e) => upd({ value: e.target.value })}
                  />
                ))}
            </div>
          );
        })}
        {earlier.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              set({
                showIf: {
                  ...cond,
                  rules: [
                    ...cond.rules,
                    { fieldId: earlier[earlier.length - 1]!.id, op: "equals", value: "" },
                  ],
                },
              })
            }
          >
            <Plus /> Condição
          </Button>
        )}
      </fieldset>
    </div>
  );
}
