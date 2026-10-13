// Campos e preview de um modelo aprovado (cabeçalho, corpo, rodapé e botões).
// Componente de apresentação: recebe o modelo e os valores; não consulta dados.
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { applyTemplate } from "@/lib/whatsapp.functions";
import type { WhatsAppTemplateOption } from "@/lib/whatsapp.functions";
import { checkTemplateVariables } from "@/lib/whatsapp/template-shape";

export type TemplateValues = { body: string[]; header: string[] };

export function templateValuesComplete(
  t: WhatsAppTemplateOption | undefined,
  v: TemplateValues,
): boolean {
  if (!t) return false;
  // Cabeçalho de mídia não tem campo de link nos compositores: bloqueia com aviso.
  return checkTemplateVariables(t, {
    variables: v.body,
    headerVariables: v.header,
    headerMediaUrl: null,
  }).ok;
}

export function WhatsAppTemplateFields({
  template,
  values,
  onChange,
  quickValues = [],
  idPrefix = "wa-tpl",
}: {
  template: WhatsAppTemplateOption;
  values: TemplateValues;
  onChange: (v: TemplateValues) => void;
  quickValues?: { label: string; value: string }[];
  idPrefix?: string;
}) {
  const setAt = (kind: "body" | "header", i: number, val: string) => {
    const next = [...values[kind]];
    next[i] = val;
    onChange({ ...values, [kind]: next });
  };
  return (
    <div className="space-y-2">
      {template.headerMediaRequired && (
        <p role="alert" className="text-xs text-destructive">
          Este modelo tem cabeçalho de {template.headerType.toLowerCase()} e precisa de um arquivo
          de mídia; o envio por este campo ainda não é suportado. Escolha outro modelo.
        </p>
      )}
      {Array.from({ length: template.headerVariableCount }, (_, i) => (
        <div key={`h${i}`}>
          <Label htmlFor={`${idPrefix}-h${i}`}>Cabeçalho {`{{${i + 1}}}`}</Label>
          <Input
            id={`${idPrefix}-h${i}`}
            value={values.header[i] ?? ""}
            onChange={(e) => setAt("header", i, e.target.value)}
          />
        </div>
      ))}
      {Array.from({ length: template.variableCount }, (_, i) => (
        <div key={`b${i}`}>
          <Label htmlFor={`${idPrefix}-b${i}`}>Variável {`{{${i + 1}}}`}</Label>
          <Input
            id={`${idPrefix}-b${i}`}
            value={values.body[i] ?? ""}
            onChange={(e) => setAt("body", i, e.target.value)}
            placeholder={`Valor de {{${i + 1}}}`}
          />
          {quickValues.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-medium text-muted-foreground">
                Preencher com:
              </span>
              {quickValues.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  title={q.value}
                  onClick={() => setAt("body", i, q.value)}
                  className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      <div>
        <Label>Prévia do modelo ({template.name} · {template.language})</Label>
        <div className="space-y-2 rounded-md border border-border bg-background p-3 text-sm">
          {template.headerType === "TEXT" && template.headerText && (
            <p className="font-semibold">{applyTemplate(template.headerText, values.header)}</p>
          )}
          {template.headerMediaRequired && (
            <p className="text-xs text-muted-foreground">[{template.headerType.toLowerCase()}]</p>
          )}
          <p className="whitespace-pre-wrap">{applyTemplate(template.body, values.body) || "—"}</p>
          {template.footer && <p className="text-xs text-muted-foreground">{template.footer}</p>}
          {template.buttons.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-border pt-2">
              {template.buttons.map((b, i) => (
                <span
                  key={i}
                  className="rounded-md border border-border px-2 py-0.5 text-xs text-primary"
                >
                  {b.text || b.type}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
