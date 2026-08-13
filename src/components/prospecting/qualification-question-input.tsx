/**
 * Renderizador de pergunta de questionário de prospecção (BANT/SPIN/MEDDIC…).
 *
 * Tipos suportados: `text`, `number`, `boolean`, `single`, `multi`.
 * As opções guardam pontuação (`{ label, points }`), exibida ao lado do rótulo.
 * Compartilhado entre o painel de qualificação do lead e o modal de
 * atividade de pesquisa (tipo Vendas).
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type QualificationQuestion = {
  id: string;
  label: string;
  type: string;
  options: unknown;
  required?: boolean | null;
  help_text?: string | null;
};

export function QualificationQuestionInput({
  question,
  value,
  onChange,
  invalid,
}: {
  question: QualificationQuestion;
  value: unknown;
  onChange: (v: unknown) => void;
  invalid?: boolean;
}) {
  const opts = Array.isArray(question.options)
    ? (question.options as { label: string; points?: number | null }[])
    : [];

  return (
    <div className="space-y-1.5">
      <Label className={cn("text-sm", invalid && "text-destructive")}>
        {question.label}
        {question.required ? <span className="text-destructive ml-1">*</span> : null}
      </Label>
      {question.help_text ? (
        <p className="text-xs text-muted-foreground">{question.help_text}</p>
      ) : null}
      {question.type === "text" ? (
        <Textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
        />
      ) : question.type === "number" ? (
        <Input
          type="number"
          value={(value as number) ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      ) : question.type === "boolean" ? (
        <div className="flex items-center gap-2">
          <Checkbox checked={value === true} onCheckedChange={(v) => onChange(v === true)} />
          <span className="text-sm">Sim</span>
        </div>
      ) : question.type === "single" ? (
        <Select value={(value as string) ?? ""} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {opts.map((o) => (
              <SelectItem key={o.label} value={o.label}>
                {o.label}
                {o.points != null ? (
                  <span className="text-xs text-muted-foreground ml-1">({o.points} pts)</span>
                ) : null}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : question.type === "multi" ? (
        <div className="space-y-1">
          {opts.map((o) => {
            const arr = Array.isArray(value) ? (value as string[]) : [];
            const checked = arr.includes(o.label);
            return (
              <label key={o.label} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => {
                    if (v) onChange([...arr, o.label]);
                    else onChange(arr.filter((x) => x !== o.label));
                  }}
                />
                <span>
                  {o.label}
                  {o.points != null ? (
                    <span className="text-xs text-muted-foreground ml-1">({o.points} pts)</span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
      ) : null}
      {invalid ? (
        <p className="text-[11px] text-destructive" role="alert">
          Resposta obrigatória.
        </p>
      ) : null}
    </div>
  );
}
