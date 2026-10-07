/**
 * Renderer único de formulários de pesquisa: preview do construtor, timeline
 * e página pública usam este componente com o mesmo esquema e validação.
 */
import { useId, useMemo, useState } from "react";
import { Star, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  pages,
  scoreAnswers,
  validateAnswers,
  visibleFieldIds,
  type Answers,
  type FormField,
  type FormSchema,
} from "@/lib/surveys/form-schema";

export function FormRenderer({
  schema,
  answers,
  onChange,
  showErrors,
  paginate = true,
  onFileSelect,
}: {
  schema: FormSchema;
  answers: Answers;
  onChange: (a: Answers) => void;
  showErrors?: boolean;
  paginate?: boolean;
  /** Sem handler, o campo de upload aparece desabilitado com a explicação. */
  onFileSelect?: (fieldId: string, file: File) => Promise<string>;
}) {
  const [page, setPage] = useState(0);
  const [touchedNext, setTouchedNext] = useState(false);
  const visible = useMemo(() => visibleFieldIds(schema, answers), [schema, answers]);
  const errors = useMemo(() => validateAnswers(schema, answers), [schema, answers]);
  const score = useMemo(() => scoreAnswers(schema, answers), [schema, answers]);
  const allPages = pages(schema).filter((p) =>
    p.some((f) => visible.has(f.id) || f.type !== "page_break"),
  );
  const visiblePages = allPages.filter(
    (p) => !(p[0]?.type === "page_break" && !visible.has(p[0].id)),
  );
  const current = paginate
    ? (visiblePages[Math.min(page, visiblePages.length - 1)] ?? [])
    : schema.fields;
  const set = (id: string, v: unknown) => onChange({ ...answers, [id]: v });
  const pageErrors = current.filter((f) => errors[f.id] && visible.has(f.id));

  return (
    <div className="space-y-5" data-form-renderer>
      {schema.scoringEnabled && score.score !== null && (
        <div
          className="flex items-center justify-between rounded-md border border-border-subtle bg-muted/40 px-3 py-2 text-xs"
          aria-live="polite"
        >
          <span className="font-medium">Pontuação</span>
          <span className="tabular-nums">
            {score.score} de {score.max ?? "—"} {score.percent !== null && `· ${score.percent}%`}
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        {current
          .filter((f) => visible.has(f.id) && f.type !== "page_break")
          .map((f) => (
            <div
              key={f.id}
              className={cn(f.width === "half" ? "col-span-2 sm:col-span-1" : "col-span-2")}
            >
              <FieldControl
                field={f}
                value={answers[f.id]}
                onChange={(v) => set(f.id, v)}
                error={showErrors || touchedNext ? errors[f.id] : undefined}
                onFileSelect={onFileSelect}
              />
            </div>
          ))}
      </div>
      {paginate && visiblePages.length > 1 && (
        <div className="flex items-center justify-between border-t border-border-subtle pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Voltar
          </Button>
          <span className="text-xs text-muted-foreground">
            Página {Math.min(page, visiblePages.length - 1) + 1} de {visiblePages.length}
          </span>
          <Button
            type="button"
            size="sm"
            disabled={page >= visiblePages.length - 1}
            onClick={() => {
              setTouchedNext(true);
              if (pageErrors.length) return;
              setTouchedNext(false);
              setPage((p) => p + 1);
            }}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}

export function FieldControl({
  field: f,
  value,
  onChange,
  error,
  onFileSelect,
}: {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
  onFileSelect?: (fieldId: string, file: File) => Promise<string>;
}) {
  const id = useId();
  if (f.type === "heading")
    return (
      <div className="border-b border-border-subtle pb-1 pt-2">
        <h3 className="text-base font-semibold">{f.label}</h3>
        {f.description && <p className="mt-1 text-xs text-muted-foreground">{f.description}</p>}
      </div>
    );
  if (f.type === "paragraph")
    return <p className="whitespace-pre-line text-sm text-muted-foreground">{f.label}</p>;
  const opts = f.options ?? [];
  const s = typeof value === "string" ? value : "";
  const control = (() => {
    switch (f.type) {
      case "long_text":
        return (
          <Textarea
            id={id}
            rows={3}
            maxLength={f.maxLength}
            placeholder={f.placeholder}
            value={s}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "number":
      case "currency":
        return (
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            step={f.type === "currency" ? "0.01" : "any"}
            min={f.min}
            max={f.max}
            placeholder={f.placeholder ?? (f.type === "currency" ? "R$ 0,00" : "")}
            value={typeof value === "number" ? value : ""}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          />
        );
      case "email":
      case "phone":
      case "url":
      case "short_text":
        return (
          <Input
            id={id}
            type={
              f.type === "email"
                ? "email"
                : f.type === "url"
                  ? "url"
                  : f.type === "phone"
                    ? "tel"
                    : "text"
            }
            maxLength={f.maxLength}
            placeholder={
              f.placeholder ??
              (f.type === "phone" ? "(00) 00000-0000" : f.type === "url" ? "https://" : "")
            }
            value={s}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "date":
        return <Input id={id} type="date" value={s} onChange={(e) => onChange(e.target.value)} />;
      case "datetime":
        return (
          <Input
            id={id}
            type="datetime-local"
            value={s}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "single_choice":
        return (
          <RadioGroup value={s} onValueChange={onChange} aria-labelledby={`${id}-l`}>
            {opts.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm">
                <RadioGroupItem value={o.label} /> {o.label}
              </label>
            ))}
          </RadioGroup>
        );
      case "multi_choice": {
        const arr = Array.isArray(value) ? (value as string[]) : [];
        return (
          <div className="space-y-1.5" role="group" aria-labelledby={`${id}-l`}>
            {opts.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={arr.includes(o.label)}
                  onCheckedChange={(c) =>
                    onChange(c ? [...arr, o.label] : arr.filter((x) => x !== o.label))
                  }
                />
                {o.label}
              </label>
            ))}
          </div>
        );
      }
      case "dropdown":
        return (
          <Select value={s} onValueChange={onChange}>
            <SelectTrigger id={id}>
              <SelectValue placeholder={f.placeholder ?? "Selecione"} />
            </SelectTrigger>
            <SelectContent>
              {opts.map((o) => (
                <SelectItem key={o.id} value={o.label}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "boolean":
        return (
          <div className="flex gap-2" role="radiogroup" aria-labelledby={`${id}-l`}>
            {[true, false].map((b) => (
              <Button
                key={String(b)}
                type="button"
                size="sm"
                variant={value === b ? "default" : "outline"}
                aria-pressed={value === b}
                onClick={() => onChange(b)}
              >
                {b ? "Sim" : "Não"}
              </Button>
            ))}
          </div>
        );
      case "linear_scale":
      case "nps": {
        const min = f.type === "nps" ? 0 : (f.min ?? 1);
        const max = f.type === "nps" ? 10 : (f.max ?? 5);
        return (
          <div>
            <div className="flex flex-wrap gap-1" role="radiogroup" aria-labelledby={`${id}-l`}>
              {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="sm"
                  variant={value === n ? "default" : "outline"}
                  className="min-w-9 tabular-nums"
                  aria-pressed={value === n}
                  onClick={() => onChange(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
            {(f.minLabel || f.maxLabel || f.type === "nps") && (
              <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                <span>{f.minLabel ?? (f.type === "nps" ? "Nada provável" : "")}</span>
                <span>{f.maxLabel ?? (f.type === "nps" ? "Muito provável" : "")}</span>
              </div>
            )}
          </div>
        );
      }
      case "rating": {
        const n = typeof value === "number" ? value : 0;
        return (
          <div className="flex gap-0.5" role="radiogroup" aria-labelledby={`${id}-l`}>
            {Array.from({ length: f.stars ?? 5 }, (_, i) => i + 1).map((k) => (
              <button
                key={k}
                type="button"
                aria-label={`${k} estrelas`}
                aria-pressed={n === k}
                className="rounded p-0.5 focus-visible:outline-2 focus-visible:outline-ring"
                onClick={() => onChange(k)}
              >
                <Star
                  className={cn(
                    "size-6",
                    k <= n ? "fill-primary text-primary" : "text-muted-foreground",
                  )}
                />
              </button>
            ))}
          </div>
        );
      }
      case "matrix": {
        const m = (value && typeof value === "object" ? value : {}) as Record<string, string>;
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="p-1 text-left font-normal text-muted-foreground">
                    <span className="sr-only">Item</span>
                  </th>
                  {opts.map((o) => (
                    <th key={o.id} className="p-1 font-medium">
                      {o.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(f.rows ?? []).map((r) => (
                  <tr key={r.id} className="border-t border-border-subtle">
                    <td className="p-1.5">{r.label}</td>
                    {opts.map((o) => (
                      <td key={o.id} className="p-1 text-center">
                        <input
                          type="radio"
                          name={`${id}-${r.id}`}
                          aria-label={`${r.label}: ${o.label}`}
                          checked={m[r.id] === o.label}
                          onChange={() => onChange({ ...m, [r.id]: o.label })}
                          className="accent-primary"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      case "file":
        return onFileSelect ? (
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground hover:bg-muted/40">
            <Upload className="size-4" />
            {s ? "Arquivo anexado" : "Selecionar arquivo (até 10 MB)"}
            <input
              id={id}
              type="file"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) onChange(await onFileSelect(f.id, file));
              }}
            />
          </label>
        ) : (
          <p className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
            Upload disponível ao responder a pesquisa publicada.
          </p>
        );
      default:
        return null;
    }
  })();
  return (
    <div className="space-y-1.5" data-field-type={f.type}>
      <Label id={`${id}-l`} htmlFor={id} className={cn("text-sm", error && "text-destructive")}>
        {f.label}
        {f.required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
      {control}
      {error && (
        <p role="alert" className="text-[11px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
