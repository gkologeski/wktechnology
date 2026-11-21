import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  getNotificationReadiness,
  listNotificationReadinessWorkflows,
} from "@/lib/notification-delivery.functions";
import type { NotificationReadinessCheck } from "@/lib/notifications/readiness-types";
import { getNotificationEvent } from "@/lib/notification-catalog";
import { formatDateTime } from "@/lib/crm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUS: Record<NotificationReadinessCheck["status"], string> = {
  observed: "Configuração consultada",
  dependency_blocked: "Dependência bloqueada",
  manual_pending: "Verificação manual pendente",
  unavailable: "Indisponível",
};
const LABEL: Record<NotificationReadinessCheck["code"], string> = {
  workflow_publication: "Publicação e situação da regra",
  published_configuration: "Configuração publicada",
  notification_steps: "Passos de notificação",
  delivery_policy: "Política de notificações",
  email_policy: "Política de e-mail",
  whatsapp_policy: "Configuração de WhatsApp",
  slack_policy: "Política coletiva do Slack",
  digest_policy: "Política de resumo",
  followup_policy: "Política de acompanhamento",
  origin_executor_access: "Origem e acesso do executor",
  recipient_eligibility: "Destinatários atuais",
  personal_consent: "Preferências e consentimentos por canal",
  current_limits: "Silêncio e limites atuais",
  live_provider: "Provedor ao vivo",
  cron_deployment: "Publicação e processamento no ambiente",
  other_rules_and_queues: "Outras regras e trabalho pendente",
  production_pilot: "Piloto, sessão e recebimento reais",
};
const REASON: Record<NotificationReadinessCheck["reason"], string> = {
  published_enabled:
    "Há versão publicada e a regra está ativa nos dados salvos. Isso não comprova que ocorrerá um envio.",
  workflow_not_published: "Não há configuração publicada para conferir. O rascunho não foi usado.",
  workflow_disabled: "A regra está desativada. Esta conferência não a ativa.",
  published_version_missing: "A versão publicada está ausente ou inválida.",
  published_configuration_valid:
    "A configuração publicada é estruturalmente compatível. Não foi executada.",
  published_configuration_invalid:
    "A configuração publicada precisa de revisão no editor. Nenhum rascunho foi usado como substituto.",
  notification_steps_present: "A versão publicada contém passos de notificação.",
  notification_steps_missing: "Não há passo de notificação compatível na versão publicada.",
  policy_observed:
    "A política foi consultada no workspace atual, inclusive seus valores padrão. Isso não comprova gravação explícita nem elegibilidade de envio.",
  policy_unavailable: "A política não está disponível nesta conferência.",
  email_disabled: "E-mail está desabilitado na política consultada.",
  email_quota_missing: "E-mail não possui cota positiva configurada.",
  email_policy_observed:
    "A política de e-mail está configurada. Destinatário confirmado e suas preferências dependem da ocorrência.",
  whatsapp_disabled: "WhatsApp está desabilitado na política consultada.",
  whatsapp_sender_template_missing:
    "Faltam remetente, nome ou idioma do modelo na configuração salva.",
  whatsapp_quota_budget_missing:
    "Cota ou orçamento estimado de WhatsApp não atendem à configuração exigida.",
  whatsapp_policy_observed:
    "Remetente, modelo e limites estão salvos. Aprovação e disponibilidade ao vivo não foram consultadas por esta conferência.",
  channel_access_unavailable:
    "O acesso à leitura do canal não foi confirmado; a configuração privada não foi exposta.",
  slack_policy_unavailable: "A política coletiva do Slack não está disponível nesta conferência.",
  slack_disabled: "Slack está desabilitado na política coletiva consultada.",
  slack_binding_unavailable: "A conexão ou a cota coletiva do Slack precisa de revisão.",
  slack_channel_override:
    "O canal antigo preenchido no passo precisa ser revisado; o webhook usa seu destino fixo.",
  slack_policy_observed:
    "A política coletiva está configurada. Público autorizado e resultado real precisam de conferência própria.",
  digest_disabled: "Resumos estão desabilitados na política consultada.",
  digest_policy_observed:
    "A política de resumo está configurada. Adesão pessoal por canal e composição atual não foram comprovadas.",
  digest_event_excluded:
    "Este evento não participa do resumo. A configuração não transforma um aviso obrigatório ou evento sem prova canônica em resumo.",
  followups_disabled: "Acompanhamentos estão desabilitados na política consultada.",
  followup_quota_missing: "Não há cota diária positiva de acompanhamento configurada.",
  followup_policy_observed:
    "A política de acompanhamento está configurada. Aviso não lido e pendência atual dependem da ocorrência real.",
  current_origin_executor_manual:
    "A origem real e as permissões atuais do executor dependem da ocorrência. Não foram avaliadas aqui.",
  current_recipients_manual:
    "Membros ativos, vínculos e leitura da origem por cada destinatário exigem uma ocorrência real.",
  recipient_consent_manual:
    "Confira as preferências aplicáveis; para WhatsApp pessoal, consentimento e telefone atuais. Slack exige revisão do público coletivo.",
  quiet_quotas_budget_manual:
    "Silêncio, cotas, orçamento e trabalho concorrente são reavaliados na execução.",
  provider_live_manual:
    "Conexão, modelo, qualidade e disponibilidade ao vivo não foram consultados. A consulta de modelos é uma ação separada e explícita.",
  cron_deployment_manual:
    "Publicação do código, migrações, processamento e sessão real do ambiente precisam de verificação operacional.",
  other_rules_queues_manual:
    "Inventarie outras regras e entregas pendentes antes de habilitar uma política compartilhada. Esta conferência não isola um piloto.",
  real_login_delivery_receipts_manual:
    "Piloto real, login do destinatário, aviso na central e recibos continuam pendentes. Nenhuma mensagem foi enviada por esta conferência.",
};
const freshRead = {
  retry: false,
  staleTime: 0,
  refetchOnMount: "always" as const,
  refetchOnWindowFocus: "always" as const,
};

export function NotificationReadinessPanel(props: { userId: string; workspaceId: string }) {
  return <ReadinessContext key={`${props.userId}:${props.workspaceId}`} {...props} />;
}
function ReadinessContext({ userId, workspaceId }: { userId: string; workspaceId: string }) {
  const { user } = useAuth();
  const permissions = usePermissions();
  const contextReady =
    user?.id === userId &&
    !permissions.isLoading &&
    !permissions.isError &&
    permissions.workspaceId === workspaceId;
  const canRead =
    contextReady &&
    permissions.can("system.notification_settings.view.workspace") &&
    permissions.canAny(
      ["own", "team", "workspace"].map((scope) => `system.workflows.view.${scope}`),
    );
  const listFn = useServerFn(listNotificationReadinessWorkflows);
  const inspectFn = useServerFn(getNotificationReadiness);
  const [selectedId, setSelectedId] = useState("");
  const [requestedId, setRequestedId] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["notification-readiness-workflows", userId, workspaceId],
    queryFn: () => listFn({ data: { workspaceId } }),
    enabled: canRead,
    ...freshRead,
  });
  const listReady = canRead && list.isFetchedAfterMount && !list.isFetching && !list.isError;
  const rows = listReady ? (list.data?.items ?? []) : [];
  const selected = rows.find((row) => row.id === selectedId);
  const report = useQuery({
    queryKey: ["notification-readiness", userId, workspaceId, requestedId],
    queryFn: () => inspectFn({ data: { workspaceId, workflowId: requestedId! } }),
    enabled: Boolean(listReady && selected && requestedId === selectedId),
    ...freshRead,
  });
  const result =
    listReady &&
    selected &&
    requestedId === selectedId &&
    report.isFetchedAfterMount &&
    !report.isFetching &&
    !report.isError &&
    report.data?.workspaceId === workspaceId &&
    report.data.workflow.id === selectedId
      ? report.data
      : null;
  const mismatched =
    listReady &&
    selected &&
    requestedId === selectedId &&
    report.isFetchedAfterMount &&
    !report.isFetching &&
    !report.isError &&
    report.data &&
    (report.data.workspaceId !== workspaceId || report.data.workflow.id !== selectedId);
  const request = () => {
    if (!canRead || !listReady || !selected || report.isFetching) return;
    if (requestedId === selectedId) void report.refetch();
    else setRequestedId(selectedId);
  };
  if (!contextReady)
    return (
      <p role="status">
        Aguardando confirmação da identidade e do workspace para conferir preparo…
      </p>
    );
  if (!canRead)
    return (
      <p>
        Conferir preparo exige leitura da configuração de notificações e do Workflow neste
        workspace.
      </p>
    );
  return (
    <section className="min-w-0 space-y-4" aria-label="Preparo da configuração publicada">
      <div>
        <h2 className="text-lg font-semibold">Conferir preparo publicado</h2>
        <p className="text-sm text-muted-foreground">
          Retrato da configuração consultada, sem executar Workflow, consultar o provedor ou enviar
          mensagens. Não representa autorização global de envio ou aceite de produção.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        Rascunhos fora da conferência; compare no editor.
      </p>
      {list.isError ? (
        <div role="alert" className="space-y-2">
          <p>Não foi possível carregar as regras para conferência.</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (canRead) void list.refetch();
            }}
          >
            Tentar carregar regras novamente
          </Button>
        </div>
      ) : !listReady ? (
        <p role="status">Conferindo as regras disponíveis…</p>
      ) : (
        <>
          <div className="flex min-w-0 flex-wrap items-end gap-3">
            <label className="w-full min-w-0 space-y-1 text-sm sm:w-auto sm:flex-1">
              Regra para conferir
              <select
                aria-label="Regra para conferir preparo"
                className="block h-10 w-full min-w-0 rounded-md border border-input bg-background px-3"
                value={selectedId}
                onChange={(event) => {
                  if (!listReady) return;
                  setSelectedId(event.target.value);
                  setRequestedId(null);
                }}
              >
                <option value="">Escolha uma regra visível</option>
                {selectedId && !selected && (
                  <option value={selectedId} disabled>
                    Regra selecionada indisponível
                  </option>
                )}
                {rows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={!selected || report.isFetching}
              onClick={request}
            >
              {report.isFetching ? "Conferindo…" : "Conferir configuração publicada"}
            </Button>
          </div>
          {!rows.length && (
            <p className="text-sm text-muted-foreground">
              Nenhuma regra disponível neste recorte autorizado. Isso não é um inventário global do
              workspace.
            </p>
          )}
          <p className="text-sm">
            <a
              className="text-primary underline underline-offset-2"
              href="/notifications?area=rules"
            >
              Ver regras
            </a>{" "}
            ·{" "}
            <a className="text-primary underline underline-offset-2" href="/settings/workflows">
              Inventariar Workflows
            </a>
          </p>
          {list.data?.truncated && (
            <p className="text-sm text-muted-foreground">
              A lista está limitada às primeiras 100 regras visíveis; confira o inventário completo
              em Workflows antes de planejar um piloto.
            </p>
          )}
        </>
      )}
      {listReady && requestedId && report.isFetching && (
        <p role="status">Conferindo a configuração publicada da regra selecionada…</p>
      )}
      {listReady && requestedId && report.isError && (
        <div role="alert" className="space-y-2">
          <p>
            Não foi possível conferir o preparo publicado. Nenhum resultado anterior permanece
            confirmado.
          </p>
          <Button type="button" variant="outline" onClick={request}>
            Tentar conferir novamente
          </Button>
        </div>
      )}
      {mismatched && (
        <p role="alert">
          Não foi possível vincular a conferência à seleção atual. Solicite novamente.
        </p>
      )}
      {result && (
        <div className="min-w-0 space-y-4" aria-label="Resultado do preparo publicado">
          <div className="space-y-1">
            <h3 className="break-words font-medium">{selected?.name}</h3>
            <p className="text-sm text-muted-foreground">
              Conferência em {formatDateTime(result.checkedAt)} ·{" "}
              {result.workflow.publishedVersion > 0
                ? `versão publicada ${result.workflow.publishedVersion}`
                : "sem versão publicada"}{" "}
              · {result.workflow.enabled ? "Ativa nos dados salvos" : "Desativada nos dados salvos"}
              .
            </p>
            {result.workflow.eventKey &&
              getNotificationEvent(result.workflow.eventKey)?.availability === "active" && (
                <p className="text-sm text-muted-foreground">
                  Evento: {getNotificationEvent(result.workflow.eventKey)!.label}.
                </p>
              )}
          </div>
          <ul className="min-w-0 space-y-3">
            {result.checks.map((check) => (
              <li key={check.code} className="min-w-0 space-y-2 rounded-lg bg-muted/25 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h4 className="text-sm font-medium">{LABEL[check.code]}</h4>
                  <Badge variant="outline">{STATUS[check.status]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{REASON[check.reason]}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <details
        className="min-w-0 rounded-lg bg-muted/20 p-4"
        aria-label="Roteiro manual de piloto e pausa"
      >
        <summary className="cursor-pointer text-sm font-medium">Planejar piloto e pausa</summary>
        <ol className="mt-3 list-inside list-decimal space-y-3 text-sm text-muted-foreground">
          <li>
            Solicite autorização posterior para publicação e piloto. A conferência local não realiza
            essas etapas.
          </li>
          <li>
            Inventarie outras regras publicadas e entregas pendentes antes de habilitar uma política
            compartilhada. Ela pode liberar trabalho de outras regras e do backlog; não há
            isolamento ou allowlist de piloto nesta tela.
          </li>
          <li>
            Defina regra e versão, evento, destinatário autorizado, canal e limites conservadores.
            Revise também os outros passos do Workflow e seus efeitos.
          </li>
          <li>
            Confira a sessão real do destinatário, a central e os recibos. Aceitação do provedor não
            comprova entrega, leitura ou decisão.
          </li>
          <li>
            Planeje quais regras e políticas desativar. Desligar WhatsApp ainda pode permitir
            fallback de e-mail explícito. Políticas da central não pausam todas as outras ações;
            trabalho em processamento ou aceito não é recolhido, e resultado incerto não deve ser
            reenviado como reversão.
          </li>
        </ol>
        <p className="mt-3 text-sm">
          <a
            className="text-primary underline underline-offset-2"
            href="/ajuda/core/conferir-preparo-de-notificacoes"
          >
            Abrir roteiro completo na Ajuda
          </a>
        </p>
      </details>
    </section>
  );
}
