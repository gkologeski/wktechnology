import { useId, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CONDITION_FIELDS,
  CONDITION_OPS,
  VARIABLES,
  getNodeType,
  validateConfig,
  type Category,
  type Conditions,
  type Config,
  type FieldDef,
  type OptionSource,
  type Pair,
} from "@/lib/agents/flow/catalog";

export type OptionResolver = Partial<Record<OptionSource, readonly string[]>>;

/** Editor contextual gerado pelo catálogo: cada tipo de bloco tem seus próprios campos. */
export function NodeConfigForm({
  type,
  config,
  onChange,
  options,
  httpAllowlist = [],
}: {
  type: string;
  config: Config;
  onChange: (c: Config) => void;
  options: OptionResolver;
  httpAllowlist?: readonly string[];
}) {
  const def = getNodeType(type);
  const lastFocused = useRef<{ key: string; el: HTMLInputElement | HTMLTextAreaElement } | null>(
    null,
  );
  if (!def) return <p className="text-xs text-destructive">Tipo de bloco desconhecido.</p>;
  const errors = validateConfig(type, config, httpAllowlist);
  const set = (key: string, v: unknown) => onChange({ ...config, [key]: v });
  const insertVar = (v: string) => {
    const f = lastFocused.current;
    if (!f) return;
    const cur = String(config[f.key] ?? "");
    const pos = f.el.selectionStart ?? cur.length;
    set(f.key, cur.slice(0, pos) + v + cur.slice(pos));
  };
  const hasText = def.fields.some((f) => f.kind === "text" || f.kind === "textarea");
  return (
    <div className="space-y-4" data-node-form={type}>
      <p className="text-xs leading-relaxed text-muted-foreground">{def.description}</p>
      {!def.fields.length && (
        <p className="rounded-md bg-product-panel-muted p-3 text-xs text-muted-foreground">
          Este bloco não tem parâmetros: usa os dados da conversa atual.
        </p>
      )}
      {def.fields
        .filter((f) => !f.showIf || f.showIf(config))
        .map((f) => (
          <FieldEditor
            key={f.key}
            field={f}
            value={config[f.key]}
            onChange={(v) => set(f.key, v)}
            options={f.options ?? (f.source ? options[f.source] : undefined) ?? []}
            onFocusText={(el) => (lastFocused.current = { key: f.key, el })}
          />
        ))}
      {hasText && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-muted-foreground">Inserir variável:</span>
          {VARIABLES.map((v) => (
            <Button
              key={v}
              type="button"
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px]"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertVar(v)}
            >
              {v}
            </Button>
          ))}
        </div>
      )}
      <div className="border-t border-border-subtle pt-3 text-xs">
        <p className="font-medium">Saídas</p>
        <p className="mt-1 text-muted-foreground">
          {def.visual
            ? "Bloco visual, não executa."
            : def.outputs(config).join(" · ") || "Encerra o fluxo"}
        </p>
        {errors.length > 0 && (
          <ul className="mt-3 space-y-1 text-destructive" aria-live="polite">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FieldEditor({
  field: f,
  value,
  onChange,
  options,
  onFocusText,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  options: readonly string[];
  onFocusText: (el: HTMLInputElement | HTMLTextAreaElement) => void;
}) {
  const id = useId();
  const label = (
    <Label htmlFor={id} className="text-xs">
      {f.label}
      {f.required && <span className="text-destructive"> *</span>}
    </Label>
  );
  const help = f.help && <p className="text-[10px] text-muted-foreground">{f.help}</p>;
  switch (f.kind) {
    case "text":
    case "number":
      return (
        <div className="space-y-1.5">
          {label}
          <Input
            id={id}
            type={f.kind === "number" ? "number" : "text"}
            min={f.min}
            max={f.max}
            value={String(value ?? "")}
            onFocus={(e) => onFocusText(e.currentTarget)}
            onChange={(e) =>
              onChange(
                f.kind === "number"
                  ? e.target.value === ""
                    ? ""
                    : Number(e.target.value)
                  : e.target.value,
              )
            }
          />
          {help}
        </div>
      );
    case "textarea":
      return (
        <div className="space-y-1.5">
          {label}
          <Textarea
            id={id}
            rows={3}
            value={String(value ?? "")}
            onFocus={(e) => onFocusText(e.currentTarget)}
            onChange={(e) => onChange(e.target.value)}
          />
          {help}
        </div>
      );
    case "switch":
      return (
        <div className="flex items-center justify-between gap-3">
          {label}
          <Switch id={id} checked={Boolean(value)} onCheckedChange={onChange} />
        </div>
      );
    case "select":
      return (
        <div className="space-y-1.5">
          {label}
          <Select value={String(value ?? "")} onValueChange={onChange} disabled={!options.length}>
            <SelectTrigger id={id}>
              <SelectValue
                placeholder={options.length ? "Selecione" : "Nenhuma opção disponível"}
              />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {help}
        </div>
      );
    case "multiselect": {
      const cur = Array.isArray(value) ? (value as string[]) : [];
      return (
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-medium">
            {f.label}
            {f.required && <span className="text-destructive"> *</span>}
          </legend>
          {!options.length && (
            <p className="text-[10px] text-muted-foreground">
              Nenhuma opção disponível neste workspace.
            </p>
          )}
          {options.map((o) => (
            <label key={o} className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={cur.includes(o)}
                onCheckedChange={(c) => onChange(c ? [...cur, o] : cur.filter((x) => x !== o))}
              />
              {o}
            </label>
          ))}
          {help}
        </fieldset>
      );
    }
    case "categories": {
      const cats = Array.isArray(value) ? (value as Category[]) : [];
      const upd = (i: number, k: keyof Category, v: string) =>
        onChange(cats.map((c, j) => (j === i ? { ...c, [k]: v } : c)));
      return (
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium">{f.label}</legend>
          {cats.map((c, i) => (
            <div key={i} className="space-y-1.5 rounded-md border border-border-subtle p-2">
              <div className="flex gap-1">
                <Input
                  aria-label={`Nome da categoria ${i + 1}`}
                  placeholder="Nome"
                  value={c.name}
                  onChange={(e) => upd(i, "name", e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover categoria ${c.name}`}
                  onClick={() => onChange(cats.filter((_, j) => j !== i))}
                >
                  <Trash2 />
                </Button>
              </div>
              <Input
                aria-label={`Critério da categoria ${i + 1}`}
                placeholder="Critério de enquadramento"
                value={c.criteria}
                onChange={(e) => upd(i, "criteria", e.target.value)}
              />
              <Input
                aria-label={`Exemplos da categoria ${i + 1}`}
                placeholder="Exemplos separados por vírgula"
                value={c.examples}
                onChange={(e) => upd(i, "examples", e.target.value)}
              />
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange([...cats, { name: "", criteria: "", examples: "" }])}
          >
            <Plus /> Categoria
          </Button>
        </fieldset>
      );
    }
    case "conditions": {
      const k = (value as Conditions | undefined) ?? { mode: "E", rules: [] };
      const upd = (i: number, key: string, v: string) =>
        onChange({ ...k, rules: k.rules.map((r, j) => (j === i ? { ...r, [key]: v } : r)) });
      return (
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium">{f.label}</legend>
          <div className="flex gap-1" role="radiogroup" aria-label="Combinação">
            {(["E", "OU"] as const).map((m) => (
              <Button
                key={m}
                type="button"
                size="sm"
                variant={k.mode === m ? "default" : "outline"}
                aria-pressed={k.mode === m}
                onClick={() => onChange({ ...k, mode: m })}
              >
                {m}
              </Button>
            ))}
          </div>
          {k.rules.map((r, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_1fr_auto] gap-1 rounded-md border border-border-subtle p-2"
            >
              <Select value={r.field} onValueChange={(v) => upd(i, "field", v)}>
                <SelectTrigger aria-label={`Campo da regra ${i + 1}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_FIELDS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={r.op} onValueChange={(v) => upd(i, "op", v)}>
                <SelectTrigger aria-label={`Operador da regra ${i + 1}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remover regra ${i + 1}`}
                onClick={() => onChange({ ...k, rules: k.rules.filter((_, j) => j !== i) })}
              >
                <Trash2 />
              </Button>
              {!["preenchido", "vazio"].includes(r.op) && (
                <Input
                  className="col-span-3"
                  aria-label={`Valor da regra ${i + 1}`}
                  placeholder="Valor"
                  value={r.value}
                  onChange={(e) => upd(i, "value", e.target.value)}
                />
              )}
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              onChange({
                ...k,
                rules: [...k.rules, { field: "Mensagem", op: "contém", value: "" }],
              })
            }
          >
            <Plus /> Regra
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Se sim → saída “sim”; se não → saída “não”.
          </p>
        </fieldset>
      );
    }
    case "pairs": {
      const pairs = Array.isArray(value) ? (value as Pair[]) : [];
      return (
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium">{f.label}</legend>
          {pairs.map((p, i) => (
            <div key={i} className="flex gap-1">
              <Input
                aria-label={`Nome do cabeçalho ${i + 1}`}
                placeholder="Nome"
                value={p.key}
                onChange={(e) =>
                  onChange(pairs.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))
                }
              />
              <Input
                aria-label={`Valor do cabeçalho ${i + 1}`}
                placeholder="Valor (sem segredos)"
                value={p.value}
                onChange={(e) =>
                  onChange(pairs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remover cabeçalho ${i + 1}`}
                onClick={() => onChange(pairs.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange([...pairs, { key: "", value: "" }])}
          >
            <Plus /> Cabeçalho
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Credenciais ficam na conexão (cofre do servidor), nunca no fluxo.
          </p>
        </fieldset>
      );
    }
  }
}
