import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useAuth } from "@/lib/auth";
import { getPreparationOrigins } from "@/lib/hiring/requests/origin.functions";
import { preparationOriginProblems, originLabels } from "@/lib/hiring/requests/origin-presentation";
import type { PreparationData, RequestKind } from "@/lib/hiring/requests/types";
export function PreparationOriginNotice({
  kind,
  form,
  enabled,
  editable,
  onBlocked,
  onUseEntity,
}: {
  kind: RequestKind;
  form: PreparationData;
  enabled: boolean;
  editable: boolean;
  onBlocked: (blocked: boolean) => void;
  onUseEntity: (id: string) => void;
}) {
  const p = usePermissions(),
    { user } = useAuth(),
    fn = useServerFn(getPreparationOrigins);
  const linked = !!(form.project_id || form.deal_id || form.commercial_contract_id);
  const permissionKey = [...p.permissions]
    .filter((k) =>
      /^(techpeople\.hiring_requests|techcontracts\.(supplier_requests|contracts)|techprojects\.projects|techsales\.deals)\./.test(
        k,
      ),
    )
    .sort()
    .join("|");
  const query = useQuery({
    queryKey: [
      "preparation-origin",
      user?.id,
      p.workspaceId,
      permissionKey,
      kind,
      form.project_id,
      form.deal_id,
      form.additional_deal_ids.join(","),
      form.commercial_contract_id,
    ],
    enabled: enabled && linked && !p.isLoading && !p.isError && !!p.workspaceId && !!user?.id,
    queryFn: () =>
      fn({
        data: {
          kind,
          projectId: form.project_id,
          dealId: form.deal_id,
          additionalDealIds: form.additional_deal_ids,
          contractId: form.commercial_contract_id,
        },
      }),
    retry: false,
    staleTime: 0,
  });
  const origins = query.data ?? [],
    issues = preparationOriginProblems(form, origins);
  const blocked =
    enabled &&
    linked &&
    (p.isLoading ||
      p.isError ||
      query.isPending ||
      query.isFetching ||
      query.isError ||
      issues.length > 0);
  useEffect(() => {
    onBlocked(blocked);
  }, [blocked, onBlocked]);
  useEffect(() => () => onBlocked(false), [onBlocked]);
  if (!enabled) return null;
  if (!linked)
    return form.purpose === "client" ? (
      <p className="text-sm text-muted-foreground">
        Na etapa Vínculos, escolha um negócio ou contrato comercial de origem. Não é necessário
        preencher os dois. Projeto é um vínculo complementar.
      </p>
    ) : null;
  return (
    <section className="space-y-2 border-t pt-3" aria-label="Conferência da origem">
      <h3 className="font-medium">Conferência da origem</h3>
      {query.isFetching && (
        <p role="status" className="text-xs text-muted-foreground">
          Conferindo vínculos e CNPJ…
        </p>
      )}
      {query.isError && (
        <div role="alert" className="text-sm text-destructive">
          Não foi possível conferir a origem com seu acesso atual.{" "}
          <Button type="button" size="sm" variant="link" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {query.isSuccess &&
        !p.isError &&
        origins.map((origin) => (
          <div key={`${origin.source}:${origin.id}`} className="text-xs space-y-1">
            <a
              className="underline"
              target="_blank"
              rel="noopener noreferrer"
              href={`/${origin.source === "deal" ? "deals" : origin.source === "project" ? "projects" : "contracts"}/${origin.id}`}
            >
              {originLabels[origin.source]}: {origin.title}
            </a>
            <p>
              {origin.legal_entity_name ?? "Entidade legal não informada"} ·{" "}
              {origin.cnpj ? `CNPJ ${origin.cnpj}` : "CNPJ não informado"}
              {origin.active === false ? " · Inativa" : ""}
            </p>
            {editable &&
              form.purpose === "client" &&
              origin.active &&
              origin.legal_entity_id &&
              origin.legal_entity_id !== form.legal_entity_id && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto whitespace-normal text-left"
                  onClick={() => onUseEntity(origin.legal_entity_id!)}
                >
                  Usar entidade desta origem
                </Button>
              )}
          </div>
        ))}
      {query.isSuccess && !p.isError && issues.length > 0 && (
        <ul role="alert" className="list-disc pl-4 space-y-2 text-sm text-destructive">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        size="sm"
        variant="link"
        onClick={() => void query.refetch()}
        disabled={query.isFetching}
      >
        Atualizar conferência
      </Button>
    </section>
  );
}
