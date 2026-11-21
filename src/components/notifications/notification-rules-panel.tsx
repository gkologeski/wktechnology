import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useSalesCapabilities } from "@/lib/access-control/use-sales-capabilities";
import { readViewAs } from "@/lib/view-as-client";
import {
  listNotificationWorkflowRules,
  previewNotificationWorkflow,
} from "@/lib/notification-delivery.functions";
import {
  saveWorkflow,
  publishWorkflow,
  discardDraft,
  deleteWorkflow,
} from "@/lib/workflows.functions";
import {
  type WorkflowEntity,
  type WorkflowTrigger,
  type WorkflowAction,
} from "@/lib/workflows/types";
import { NotificationRulesList } from "./notification-rules-list";
import type { WorkflowDraft } from "@/components/workflows/workflow-builder";
import {
  WORKFLOW_NOTIFICATION_EVENTS,
  getWorkflowNotificationEvent,
  workflowNotificationEventTrigger,
  type WorkflowNotificationEventKey,
} from "@/lib/workflows/notification-events";

const Builder = lazy(() =>
  import("@/components/workflows/workflow-builder").then((module) => ({
    default: module.WorkflowBuilder,
  })),
);
export type NotificationWorkflowRuleRow = {
  id: string;
  name: string;
  entity: WorkflowEntity;
  enabled: boolean;
  status: string;
  published_version: number;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
  draft_trigger: WorkflowTrigger | null;
  draft_actions: WorkflowAction[] | null;
  goal_filters?: WorkflowTrigger["goal_filters"];
  draft_goal_filters?: WorkflowTrigger["goal_filters"];
  has_draft_changes?: boolean;
};
const workflowDraft = (row: NotificationWorkflowRuleRow): WorkflowDraft => ({
  id: row.id,
  name: row.name,
  entity: row.entity,
  enabled: row.enabled,
  trigger: {
    ...(row.draft_trigger ?? row.trigger),
    goal_filters: row.draft_goal_filters ?? row.goal_filters ?? [],
  },
  actions: row.draft_actions ?? row.actions,
});
const newDraft = (eventKey: WorkflowNotificationEventKey | ""): WorkflowDraft => ({
  name: eventKey
    ? `Aviso: ${getWorkflowNotificationEvent(eventKey)!.label}`
    : "Nova regra de notificação",
  entity: eventKey ? getWorkflowNotificationEvent(eventKey)!.entity : "leads",
  enabled: false,
  trigger: eventKey
    ? workflowNotificationEventTrigger(eventKey)
    : { event: "created", filters: [], reenroll: { enabled: false, events: [] } },
  actions: [
    {
      type: "send_notification",
      title: "Atualização no TechERP",
      recipients: [
        {
          kind:
            eventKey === "people.approval.pending"
              ? "pending_approvers"
              : eventKey === "finance.invoice.received"
                ? "workflow_owner"
                : "source_responsible",
        },
      ],
    },
  ],
});

export function NotificationRulesPanel(props: { workspaceId: string; userId: string }) {
  return <NotificationRulesContext key={`${props.userId}:${props.workspaceId}`} {...props} />;
}

function NotificationRulesContext({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId: string;
}) {
  const permissions = usePermissions();
  const contextReady =
    !permissions.isLoading && !permissions.isError && permissions.workspaceId === workspaceId;
  const canView =
    contextReady &&
    permissions.canAny(
      ["own", "team", "workspace"].map((scope) => `system.workflows.view.${scope}`),
    );
  const readOnly = Boolean(readViewAs());
  const listFn = useServerFn(listNotificationWorkflowRules);
  const saveFn = useServerFn(saveWorkflow),
    publishFn = useServerFn(publishWorkflow);
  const discardFn = useServerFn(discardDraft),
    removeFn = useServerFn(deleteWorkflow);
  const previewFn = useServerFn(previewNotificationWorkflow);
  const q = useQuery({
    queryKey: ["notification-rules", userId, workspaceId],
    queryFn: () => listFn({ data: { workspaceId } }),
    enabled: canView,
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
  const rows = (canView && !q.isError && q.isFetchedAfterMount
    ? (q.data?.items ?? [])
    : []) as unknown as NotificationWorkflowRuleRow[];
  const capabilities = useSalesCapabilities(
    "workflows",
    rows.map((row) => row.id),
  );
  const [draft, setDraft] = useState<WorkflowDraft | null>(null);
  const [eventKey, setEventKey] = useState<WorkflowNotificationEventKey | "">("");
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{
    notificationSteps: number;
    channels: string[];
    issues: string[];
    realMessages: 0;
  } | null>(null);
  const manager =
    !readOnly &&
    permissions.canAny([
      "system.workflows.manage.workspace",
      "system.workflows.update.workspace",
      "system.workflows.create.workspace",
    ]);
  const canCreate =
    manager &&
    permissions.canAny(
      ["own", "team", "workspace"].map((scope) => `system.workflows.create.${scope}`),
    );
  const finish = async (text: string) => {
    setMessage(text);
    await q.refetch();
  };
  const execute = async (task: () => Promise<void>) => {
    if (!canView || pending || q.isFetching || q.isError || !q.isFetchedAfterMount) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      await task();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível alterar a regra.");
    } finally {
      setPending(false);
    }
  };
  const save = async (value: WorkflowDraft, publish = false) => {
    const allowed = value.id ? manager && capabilities.for(value.id).can_update : canCreate;
    const publishAllowed = value.id
      ? capabilities.for(value.id).can_manage
      : permissions.can("system.workflows.manage.workspace");
    if (
      !contextReady ||
      !canView ||
      !allowed ||
      pending ||
      q.isFetching ||
      q.isError ||
      !q.isFetchedAfterMount ||
      (publish && !publishAllowed)
    )
      throw new Error(
        "Confirme suas permissões e aguarde a atualização das regras antes de salvar.",
      );
    setError("");
    setMessage("");
    try {
      const saved = await saveFn({ data: value });
      if (publish) await publishFn({ data: { id: saved.id } });
      setDraft(null);
      await finish(
        publish
          ? "Versão do Workflow publicada. A ativação e as condições dos canais continuam sendo conferidas."
          : "Rascunho salvo. Salvar não publica a versão nem ativa canais externos.",
      );
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "Não foi possível salvar o Workflow.";
      setError(text);
      throw new Error(text);
    }
  };
  if (!canView)
    return (
      <p className="text-sm text-muted-foreground">
        Você não possui permissão para consultar regras de Workflow.
      </p>
    );
  const editing = draft?.id ? rows.find((row) => row.id === draft.id) : null;
  const canPublishDraft =
    manager &&
    (draft?.id
      ? capabilities.for(draft.id).can_manage
      : permissions.can("system.workflows.manage.workspace"));
  return (
    <section className="min-w-0 space-y-4" aria-label="Regras de notificação">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Regras de notificação</h2>
          <p className="text-sm text-muted-foreground">
            São Workflows com um passo de notificação. Gatilhos, versões e permissões usam o motor
            existente.
          </p>
        </div>
        {canCreate && (
          <div className="flex min-w-0 flex-wrap items-end gap-3">
            <label className="min-w-0 space-y-1 text-sm">
              <span className="block">Evento da nova regra</span>
              <select
                aria-label="Evento da nova regra"
                className="block h-10 w-full max-w-full rounded-md border border-input bg-background px-3"
                value={eventKey}
                disabled={pending || q.isFetching || q.isError || !q.isFetchedAfterMount}
                onChange={(event) => {
                  if (
                    !pending &&
                    !q.isFetching &&
                    (!event.target.value || getWorkflowNotificationEvent(event.target.value))
                  )
                    setEventKey(event.target.value as WorkflowNotificationEventKey | "");
                }}
              >
                <option value="">Regra genérica de Workflow</option>
                {[
                  { prefix: "crm.", label: "TechSales" },
                  { prefix: "contracts.", label: "TechContracts" },
                  { prefix: "projects.", label: "TechProjects" },
                  { prefix: "ats.", label: "TechHire" },
                  { prefix: "people.", label: "TechPeople" },
                  { prefix: "finance.", label: "TechFinance" },
                ].map((group) => (
                  <optgroup key={group.prefix} label={group.label}>
                    {WORKFLOW_NOTIFICATION_EVENTS.filter((event) =>
                      event.key.startsWith(group.prefix),
                    ).map((event) => (
                      <option key={event.key} value={event.key}>
                        {event.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <Button
              onClick={() => {
                setDraft(newDraft(eventKey));
                setError("");
                setPreview(null);
              }}
              disabled={pending || q.isFetching || q.isError || !q.isFetchedAfterMount}
            >
              Criar regra
            </Button>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Uma regra nova começa desativada e sem envio externo. Escolher um evento abre o rascunho no
        construtor existente; salvar, publicar e ativar continuam ações distintas. Os demais eventos
        planejados do catálogo não criam gatilhos.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
      {q.isError ? (
        <div role="alert">
          <p>Não foi possível carregar as regras. {q.error.message}</p>
          <Button variant="outline" onClick={() => void q.refetch()}>
            Tentar carregar regras novamente
          </Button>
        </div>
      ) : q.isLoading || !q.isFetchedAfterMount ? (
        <p role="status">Carregando regras…</p>
      ) : !rows.length ? (
        <p className="py-6 text-sm text-muted-foreground">
          Nenhuma regra de notificação visível neste workspace.
        </p>
      ) : (
        <NotificationRulesList
          canRead={canView}
          rows={rows}
          capabilityFor={capabilities.for}
          manager={manager}
          readOnly={readOnly}
          pending={pending || q.isFetching}
          onAction={(kind, row, enabled) => {
            if (kind === "edit") {
              setDraft(workflowDraft(row));
              return;
            }
            void execute(async () => {
              if (kind === "preview") {
                setPreview(await previewFn({ data: { workspaceId, workflowId: row.id } }));
                return;
              }
              if (kind === "publish") {
                if (
                  !(await confirmDialog(
                    "Publicar a versão atual do rascunho desta regra de Workflow?",
                  ))
                )
                  return;
                await publishFn({ data: { id: row.id } });
                await finish("Versão do Workflow publicada.");
                return;
              }
              if (kind === "toggle") {
                await saveFn({ data: { ...workflowDraft(row), enabled: enabled === true } });
                await finish(
                  enabled
                    ? "Regra ativada. Uma versão publicada e condições válidas ainda são necessárias para enviar."
                    : "Regra desativada.",
                );
                return;
              }
              if (kind === "discard") {
                if (!(await confirmDialog("Descartar o rascunho e manter a versão publicada?")))
                  return;
                await discardFn({ data: { id: row.id } });
                await finish("Rascunho descartado.");
                return;
              }
              if (!(await confirmDialog("Excluir esta regra de Workflow?"))) return;
              await removeFn({ data: { id: row.id } });
              await finish("Regra excluída.");
            });
          }}
        />
      )}
      {q.data?.truncated && (
        <p className="text-xs text-muted-foreground">
          Mostrando até 100 regras visíveis. Consulte os demais Workflows no construtor de
          automações.
        </p>
      )}
      {preview && !q.isError && q.isFetchedAfterMount && (
        <aside
          className="space-y-2 rounded-lg bg-muted/30 p-4"
          aria-label="Conferência da configuração"
        >
          <h3 className="font-medium">Conferência sem transporte</h3>
          <p className="text-sm">
            {preview.notificationSteps} passo(s) de notificação · canais configurados:{" "}
            {preview.channels.join(", ") || "Central legada"}.
          </p>
          <p className="text-sm">
            {preview.realMessages} mensagens reais. Esta conferência é estrutural; destinatários,
            acesso e condições dos canais são avaliados na execução.
          </p>
          {preview.issues.length ? (
            <ul className="list-inside list-disc text-sm">
              {preview.issues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma inconsistência estrutural encontrada.
            </p>
          )}
          <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>
            Fechar conferência
          </Button>
        </aside>
      )}
      {draft && !q.isError && q.isFetchedAfterMount && (
        <Suspense fallback={<p role="status">Carregando construtor de Workflow…</p>}>
          <Builder
            open
            draft={draft}
            onClose={() => setDraft(null)}
            onSave={(value) => save(value)}
            onSaveAndPublish={canPublishDraft ? (value) => save(value, true) : undefined}
            publishedVersion={editing?.published_version ?? 0}
            hasDraftChanges={editing?.has_draft_changes ?? false}
          />
        </Suspense>
      )}
    </section>
  );
}
