import { usePermissions } from "@/lib/access-control/use-permissions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAudienceFilterFields } from "@/hooks/use-audience-filter-fields";
import { SequenceVariableField } from "./sequence-variable-field";
import { getProspectingSequenceTemplates } from "@/lib/prospecting/sequences/drafts.functions";
import type { SequenceStep } from "@/lib/prospecting/sequences/draft";
export function SequenceTemplatePicker({
  workspaceId,
  step,
  disabled,
  onChange,
}: {
  workspaceId: string;
  step: Extract<SequenceStep, { type: "whatsapp" }>;
  disabled: boolean;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const permissions = usePermissions();
  const allowed =
    !permissions.isLoading &&
    !permissions.isError &&
    permissions.workspaceId === workspaceId &&
    permissions.canAny(
      ["own", "team", "workspace"].map((s) => `system.automation.sequences.view.${s}`),
    ) &&
    permissions.can("system.channels.view.workspace") &&
    permissions.canAny(
      ["own", "team", "workspace"].map((s) => `techsales.inbox.whatsapp.view.${s}`),
    );
  const fieldCatalog = useAudienceFilterFields();
  const load = useServerFn(getProspectingSequenceTemplates);
  const query = useQuery({
    queryKey: ["sequence-approved-templates", workspaceId, step.accountId],
    enabled: !!step.accountId && allowed,
    queryFn: () => load({ data: { workspaceId, accountId: step.accountId! } }),
    retry: false,
    staleTime: 60_000,
  });
  const selected = query.data?.find(
    (t) => t.name === step.templateName && t.language === step.language,
  );
  const shape = selected ?? null;
  const value = JSON.stringify([step.templateName, step.language]);
  if (!allowed)
    return (
      <p className="text-xs text-muted-foreground">
        A consulta exige acesso aos canais e à Inbox WhatsApp.
      </p>
    );
  return (
    <div className="space-y-3">
      <label className="block space-y-1 text-xs">
        Modelo aprovado no número selecionado
        <select
          aria-label="Modelo aprovado no número selecionado"
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          disabled={disabled || !step.accountId || query.isPending || query.isError}
          value={selected ? value : ""}
          onChange={(e) => {
            const [templateName, language] = JSON.parse(e.target.value);
            onChange({ templateName, language, variables: {} });
          }}
        >
          <option value="" disabled>
            {!step.accountId
              ? "Escolha a conta primeiro"
              : query.isPending
                ? "Consultando provedor…"
                : "Selecione um modelo"}
          </option>
          {query.data?.map((t) => (
            <option key={`${t.name}:${t.language}`} value={JSON.stringify([t.name, t.language])}>
              {t.name} · {t.language}
            </option>
          ))}
        </select>
      </label>
      {query.isError && (
        <div className="space-y-2">
          <p role="alert" className="text-xs text-destructive">
            Não foi possível consultar os modelos desta conta. Confira suas permissões e a conexão.
          </p>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            Consultar novamente
          </Button>
        </div>
      )}
      {!query.isPending && !query.isError && step.accountId && query.data?.length === 0 && (
        <p className="text-xs text-muted-foreground">
          O provedor não retornou modelos aprovados para esta conta.
        </p>
      )}
      {step.templateName && !selected && !query.isPending && (
        <p className="text-xs text-destructive">
          Modelo salvo: {step.templateName} ({step.language}). Ele ainda não foi confirmado no
          catálogo desta conta.
        </p>
      )}
      {shape && (
        <>
          <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{shape.body}</p>
          {Array.from({ length: Math.min(shape.variableCount, 20) }, (_, i) => (
            <SequenceVariableField
              key={i}
              index={i + 1}
              fields={fieldCatalog.fields}
              disabled={disabled || fieldCatalog.isLoading}
              value={step.variables[String(i + 1)] || ""}
              onChange={(v) => onChange({ variables: { ...step.variables, [String(i + 1)]: v } })}
            />
          ))}
          {(shape.headerMediaRequired ||
            shape.headerVariableCount > 0 ||
            shape.headerType === "LOCATION") && (
            <p className="text-xs text-destructive">
              Este modelo exige parâmetros de cabeçalho ainda não disponíveis nesta etapa.
            </p>
          )}
        </>
      )}
    </div>
  );
}
