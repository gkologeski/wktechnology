import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  npsBand,
  questionOptions,
  questionSettings,
  scaleRange,
  starCount,
  type SurveyQuestion,
} from "@/lib/surveys/survey-fields";

export type SurveyAnswers = Record<string, unknown>;

/** Renderiza um campo de pesquisa conforme o tipo configurado. */
export function SurveyField({
  question,
  value,
  onChange,
  invalid,
}: {
  question: SurveyQuestion;
  value: unknown;
  onChange: (v: unknown) => void;
  invalid?: boolean;
}) {
  const settings = questionSettings(question);
  const options = questionOptions(question);
  const fieldId = `survey-q-${question.id}`;

  const control = (() => {
    switch (question.type) {
      case "long_text":
        return (
          <Textarea
            id={fieldId}
            rows={3}
            value={typeof value === "string" ? value : ""}
            placeholder={settings.placeholder ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "single_choice":
        return (
          <RadioGroup
            value={typeof value === "string" ? value : ""}
            onValueChange={(v) => onChange(v)}
            className="gap-1.5"
          >
            {options.map((o) => (
              <div key={o.label} className="flex items-center gap-2">
                <RadioGroupItem value={o.label} id={`${fieldId}-${o.label}`} />
                <Label htmlFor={`${fieldId}-${o.label}`} className="text-sm font-normal">
                  {o.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );
      case "multi_choice": {
        const arr = Array.isArray(value) ? (value as string[]) : [];
        return (
          <div className="space-y-1.5">
            {options.map((o) => (
              <div key={o.label} className="flex items-center gap-2">
                <Checkbox
                  id={`${fieldId}-${o.label}`}
                  checked={arr.includes(o.label)}
                  onCheckedChange={(c) =>
                    onChange(c ? [...arr, o.label] : arr.filter((x) => x !== o.label))
                  }
                />
                <Label htmlFor={`${fieldId}-${o.label}`} className="text-sm font-normal">
                  {o.label}
                </Label>
              </div>
            ))}
          </div>
        );
      }
      case "dropdown":
        return (
          <Select value={typeof value === "string" ? value : ""} onValueChange={(v) => onChange(v)}>
            <SelectTrigger id={fieldId}>
              <SelectValue placeholder="Selecione…" />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.label} value={o.label}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "linear_scale":
      case "nps": {
        const { min, max } = scaleRange(question);
        const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i);
        const current = typeof value === "number" ? value : null;
        return (
          <div className="space-y-1">
            <div className="flex flex-wrap gap-1" role="group" aria-labelledby={fieldId}>
              {nums.map((n) => {
                const active = current === n;
                return (
                  <Button
                    key={n}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    aria-pressed={active}
                    className="h-8 w-9 px-0 text-xs"
                    onClick={() => onChange(active ? null : n)}
                  >
                    {n}
                  </Button>
                );
              })}
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>
                {settings.min_label ?? (question.type === "nps" ? "Não recomendaria" : "")}
              </span>
              <span>
                {settings.max_label ?? (question.type === "nps" ? "Recomendaria muito" : "")}
              </span>
            </div>
            {question.type === "nps" && current != null && (
              <p className="text-[11px] text-muted-foreground capitalize">{npsBand(current)}</p>
            )}
          </div>
        );
      }
      case "rating": {
        const total = starCount(question);
        const current = typeof value === "number" ? value : 0;
        return (
          <div className="flex items-center gap-1">
            {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} de ${total}`}
                onClick={() => onChange(current === n ? null : n)}
                className="text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                <Star
                  className={cn("h-5 w-5", n <= current && "fill-primary text-primary")}
                  aria-hidden
                />
              </button>
            ))}
          </div>
        );
      }
      case "boolean":
        return (
          <div className="flex gap-2">
            {[
              { label: "Sim", v: true },
              { label: "Não", v: false },
            ].map((o) => (
              <Button
                key={o.label}
                type="button"
                size="sm"
                variant={value === o.v ? "default" : "outline"}
                aria-pressed={value === o.v}
                onClick={() => onChange(value === o.v ? null : o.v)}
              >
                {o.label}
              </Button>
            ))}
          </div>
        );
      case "number":
        return (
          <Input
            id={fieldId}
            type="number"
            value={typeof value === "number" ? String(value) : ""}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          />
        );
      case "currency":
        return (
          <CurrencyInput
            id={fieldId}
            value={typeof value === "number" ? value : null}
            onValueChange={(v) => onChange(v)}
          />
        );
      case "date":
        return (
          <Input
            id={fieldId}
            type="date"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value || null)}
          />
        );
      case "email":
        return (
          <Input
            id={fieldId}
            type="email"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "phone":
        return (
          <PhoneInput
            id={fieldId}
            value={typeof value === "string" ? value : ""}
            onChange={(v) => onChange(v)}
            showError={false}
          />
        );
      default:
        return (
          <Input
            id={fieldId}
            value={typeof value === "string" ? value : ""}
            placeholder={settings.placeholder ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        );
    }
  })();

  return (
    <div className="space-y-1.5">
      <Label
        id={fieldId}
        htmlFor={fieldId}
        className={cn("text-xs font-medium", invalid && "text-destructive")}
      >
        {question.label}
        {question.required ? <span aria-hidden> *</span> : null}
      </Label>
      {control}
      {question.help_text && (
        <p className="text-[11px] text-muted-foreground">{question.help_text}</p>
      )}
      {invalid && (
        <p className="text-[11px] text-destructive" role="alert">
          Resposta obrigatória.
        </p>
      )}
    </div>
  );
}
