// Inspetor do passo "Enviar WhatsApp": modelo aprovado do canal conectado + variáveis.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
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
import { getWhatsAppTemplateCatalog } from "@/lib/whatsapp.functions";
import { describeTemplate } from "@/lib/whatsapp/template-shape";
import { validateWhatsAppStep, type WhatsAppStep } from "@/lib/workflows/whatsapp-step";

export function WhatsAppStepForm<T extends WhatsAppStep & { type: "send_whatsapp" }>({
  action,
  onChange,
}: {
  action: T;
  onChange: (next: T) => void;
}) {
  const fetchCatalog = useServerFn(getWhatsAppTemplateCatalog);
  const q = useQuery({
    queryKey: ["workflow-wa-templates"],
    queryFn: () => fetchCatalog({ data: {} }),
    staleTime: 60_000,
  });
  const items = q.data?.items ?? [];
  const value = action.template_name
    ? `${action.template_name}::${action.template_language ?? ""}`
    : "";
  const selected = items.find(
    (t) =>
      t.name === action.template_name &&
      (!action.template_language || t.language === action.template_language),
  );
  const shape = selected ? describeTemplate(selected.components) : null;
  const issue = q.data ? validateWhatsAppStep(action, items) : null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Envia pelo WhatsApp conectado da empresa. Como o fluxo roda fora da janela de 24 horas, só
        modelos aprovados pela Meta podem ser usados.
      </p>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs" htmlFor="wf-wa-template">
            Modelo aprovado *
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => q.refetch()}
            disabled={q.isFetching}
            aria-label="Atualizar modelos"
          >
            <RefreshCw className={q.isFetching ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
          </Button>
        </div>
        {q.isLoading ? (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Carregando modelos…
          </p>
        ) : q.isError ? (
          <p className="text-xs text-destructive" role="alert">
            Não foi possível carregar os modelos. Tente atualizar.
          </p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum modelo aprovado nesta conta.</p>
        ) : (
          <Select
            value={value}
            onValueChange={(v) => {
              const [name, language] = v.split("::");
              onChange({
                ...action,
                template_name: name,
                template_language: language || undefined,
                template_variables: [],
                body: undefined,
              });
            }}
          >
            <SelectTrigger id="wf-wa-template">
              <SelectValue placeholder="Escolha o modelo" />
            </SelectTrigger>
            <SelectContent>
              {items.map((t) => (
                <SelectItem key={`${t.name}::${t.language}`} value={`${t.name}::${t.language}`}>
                  {t.name} · {t.language}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {shape && (
        <>
          <div className="rounded-md border bg-muted/40 p-2 text-xs whitespace-pre-wrap">
            {shape.body || "—"}
          </div>
          {Array.from({ length: shape.variableCount }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Label className="text-xs" htmlFor={`wf-wa-var-${i}`}>
                Variável {`{{${i + 1}}}`} *
              </Label>
              <Input
                id={`wf-wa-var-${i}`}
                value={action.template_variables?.[i] ?? ""}
                placeholder="Ex.: {{first_name}}"
                onChange={(e) => {
                  const vars = [...(action.template_variables ?? [])];
                  vars[i] = e.target.value;
                  onChange({ ...action, template_variables: vars });
                }}
              />
            </div>
          ))}
        </>
      )}
      <div className="space-y-1">
        <Label className="text-xs" htmlFor="wf-wa-to">
          Campo com telefone do destinatário
        </Label>
        <Input
          id="wf-wa-to"
          value={action.to_field ?? ""}
          onChange={(e) => onChange({ ...action, to_field: e.target.value })}
          placeholder="phone"
        />
      </div>
      {issue && (
        <p className="text-xs text-destructive" role="alert">
          {issue.message} A publicação ficará bloqueada até corrigir.
        </p>
      )}
    </div>
  );
}
