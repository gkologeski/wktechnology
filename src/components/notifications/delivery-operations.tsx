import { useEffect, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { readViewAs } from "@/lib/view-as-client";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  getNotificationDeliverySettings,
  saveNotificationDeliverySettings,
  listNotificationWhatsAppSenders,
  listNotificationWhatsAppTemplates,
  listNotificationDeliveryHistory,
  getNotificationDeliveryConsent,
  getNotificationDigestSettings,
  saveNotificationDigestSettings,
  saveNotificationDeliveryConsent,
  updateNotificationProfilePhone,
  getNotificationSlackSettings,
  saveNotificationSlackSettings,
} from "@/lib/notification-delivery.functions";
import type {
  NotificationDeliveryCapabilities,
  NotificationDeliveryPolicy,
  NotificationSlackPolicy,
} from "@/lib/notifications/delivery-types";
import type { NotificationCursor } from "@/lib/notification-cursor";
import { DeliverySettingsPanel } from "./delivery-settings-panel";
import { DeliveryModelsPanel } from "./delivery-models-panel";
import { DeliveryHistoryPanel, type DeliveryFilters } from "./delivery-history-panel";
import { NotificationDigestPanel } from "./notification-digest-panel";
import type { NotificationDigestSettings } from "@/lib/notifications/scheduling-types";
import { NotificationConsentPanel } from "./notification-consent-panel";
import { NotificationSlackPolicyPanel } from "./slack-policy-panel";

type DeliveryContext = { workspaceId: string; userId: string };
const freshDeliveryQuery = {
  retry: false,
  staleTime: 0,
  refetchOnMount: "always" as const,
  refetchOnWindowFocus: "always" as const,
};

export function NotificationDeliveryConfiguration(
  props: DeliveryContext & {
    capabilities: NotificationDeliveryCapabilities;
  },
) {
  return <DeliveryConfigurationContext key={`${props.userId}:${props.workspaceId}`} {...props} />;
}

function DeliveryConfigurationContext({
  workspaceId,
  userId,
  capabilities,
}: {
  workspaceId: string;
  userId: string;
  capabilities: NotificationDeliveryCapabilities;
}) {
  const permissions = usePermissions();
  const qc = useQueryClient();
  const getFn = useServerFn(getNotificationDeliverySettings),
    saveFn = useServerFn(saveNotificationDeliverySettings);
  const getSlackFn = useServerFn(getNotificationSlackSettings),
    saveSlackFn = useServerFn(saveNotificationSlackSettings);
  const sendersFn = useServerFn(listNotificationWhatsAppSenders),
    templatesFn = useServerFn(listNotificationWhatsAppTemplates);
  const [senderDraft, setSenderDraft] = useState<{ id: string | null } | null>(null);
  const contextReady =
    !permissions.isLoading && !permissions.isError && permissions.workspaceId === workspaceId;
  const canReadWhatsApp =
    permissions.can("system.channels.view.workspace") &&
    permissions.canAny(
      ["own", "team", "workspace"].map((scope) => `system.whatsapp.view.${scope}`),
    );
  const policyKey = ["notification-delivery-settings", userId, workspaceId];
  const slackKey = ["notification-slack-settings", userId, workspaceId];
  const slack = useQuery({
    queryKey: slackKey,
    queryFn: () => getSlackFn({ data: { workspaceId } }),
    enabled: contextReady && capabilities.settingsView && capabilities.slackView === true,
    ...freshDeliveryQuery,
  });
  const saveSlack = useMutation({
    mutationFn: (input: {
      policy: NotificationSlackPolicy;
      revision: number;
      workspaceId: string;
      userId: string;
    }) => {
      if (
        !contextReady ||
        input.workspaceId !== workspaceId ||
        input.userId !== userId ||
        slack.isFetching ||
        !capabilities.settingsManage ||
        capabilities.slackConfigure !== true ||
        !slack.data?.canManage
      )
        throw new Error("Sem permissão para configurar o Slack deste workspace.");
      return saveSlackFn({
        data: { workspaceId: input.workspaceId, policy: input.policy, revision: input.revision },
      });
    },
    onSuccess: (data, input) => {
      qc.setQueryData(["notification-slack-settings", input.userId, input.workspaceId], data);
    },
  });
  const policy = useQuery({
    queryKey: policyKey,
    queryFn: () => getFn({ data: { workspaceId } }),
    enabled: contextReady && capabilities.settingsView,
    ...freshDeliveryQuery,
  });
  const senderId = senderDraft ? senderDraft.id : (policy.data?.policy.wa_sender_id ?? null);
  useEffect(() => {
    if (!contextReady) setSenderDraft(null);
  }, [contextReady]);
  const senders = useQuery({
    queryKey: ["notification-delivery-senders", userId, workspaceId],
    queryFn: () => sendersFn({ data: { workspaceId } }),
    enabled: contextReady && capabilities.settingsView && canReadWhatsApp,
    ...freshDeliveryQuery,
  });
  const templates = useQuery({
    queryKey: ["notification-delivery-templates", userId, workspaceId, senderId],
    queryFn: () => templatesFn({ data: { workspaceId, senderPhoneNumberId: senderId! } }),
    enabled: contextReady && capabilities.settingsView && canReadWhatsApp && Boolean(senderId),
    ...freshDeliveryQuery,
  });
  const save = useMutation({
    mutationFn: (
      input: DeliveryContext & { policy: NotificationDeliveryPolicy; revision: number },
    ) => {
      if (
        !contextReady ||
        input.userId !== userId ||
        input.workspaceId !== workspaceId ||
        policy.isFetching ||
        !policy.isFetchedAfterMount ||
        policy.isError ||
        !capabilities.settingsManage
      )
        throw new Error("Sem permissão para salvar esta política.");
      return saveFn({
        data: { workspaceId: input.workspaceId, policy: input.policy, revision: input.revision },
      });
    },
    onSuccess: (data, input) => {
      qc.setQueryData(["notification-delivery-settings", input.userId, input.workspaceId], data);
      setSenderDraft(null);
    },
  });
  if (!contextReady) return <p role="status">Aguardando confirmação do workspace…</p>;
  if (!capabilities.settingsView)
    return (
      <p className="text-sm text-muted-foreground">
        Sem permissão para consultar modelos e política de notificações.
      </p>
    );
  return (
    <div className="min-w-0 space-y-8">
      <DeliveryModelsPanel
        key={`${userId}:${workspaceId}:${senderId ?? "none"}`}
        canRead={contextReady && capabilities.settingsView}
        canRetryWhatsApp={
          contextReady && capabilities.settingsView && canReadWhatsApp && Boolean(senderId)
        }
        templates={
          canReadWhatsApp &&
          !templates.isError &&
          !templates.isFetching &&
          templates.isFetchedAfterMount
            ? (templates.data?.items ?? [])
            : []
        }
        loading={templates.isFetching}
        error={
          !canReadWhatsApp
            ? "A consulta de modelos do WhatsApp exige permissão sobre o canal."
            : templates.isError
              ? templates.error.message
              : null
        }
        onRetry={() => {
          if (canReadWhatsApp && senderId) void templates.refetch();
        }}
      />
      {policy.isError ? (
        <div role="alert">
          <p>Não foi possível carregar a política. {policy.error.message}</p>
          <Button variant="outline" onClick={() => void policy.refetch()}>
            Tentar carregar política novamente
          </Button>
        </div>
      ) : policy.data && policy.isFetchedAfterMount ? (
        <>
          {senders.isError && (
            <p role="alert" className="text-sm text-destructive">
              Não foi possível carregar os remetentes. {senders.error.message}
            </p>
          )}
          <DeliverySettingsPanel
            key={`${userId}:${workspaceId}`}
            policy={policy.data.policy}
            revision={policy.data.revision}
            canEdit={capabilities.settingsManage && !policy.isFetching}
            canConfigureWhatsApp={
              canReadWhatsApp &&
              capabilities.whatsappConfigure === true &&
              !senders.isFetching &&
              !senders.isError &&
              senders.isFetchedAfterMount
            }
            senders={
              canReadWhatsApp &&
              !senders.isError &&
              !senders.isFetching &&
              senders.isFetchedAfterMount
                ? (senders.data?.items ?? [])
                : []
            }
            templates={
              canReadWhatsApp &&
              !templates.isError &&
              !templates.isFetching &&
              templates.isFetchedAfterMount
                ? (templates.data?.items ?? [])
                : []
            }
            templatesLoading={templates.isFetching}
            templatesError={templates.isError ? templates.error.message : null}
            onSenderChange={(id) => setSenderDraft({ id })}
            onSave={(next, revision) =>
              save.mutateAsync({ policy: next, revision, userId, workspaceId })
            }
          />
        </>
      ) : (
        <p role="status">Carregando política de notificações…</p>
      )}
      {capabilities.slackView !== true ? (
        <p className="text-sm text-muted-foreground">
          A política coletiva do Slack exige permissão sobre a integração.
        </p>
      ) : slack.isError ? (
        <div role="alert" className="space-y-2 border-t border-border pt-6">
          <p>Não foi possível carregar a política do Slack. {slack.error.message}</p>
          <Button variant="outline" onClick={() => void slack.refetch()}>
            Tentar carregar Slack novamente
          </Button>
        </div>
      ) : slack.data && slack.isFetchedAfterMount ? (
        <NotificationSlackPolicyPanel
          key={`${userId}:${workspaceId}`}
          settings={slack.data}
          canEdit={
            capabilities.settingsManage &&
            capabilities.slackConfigure === true &&
            !slack.isFetching &&
            slack.data.canManage
          }
          onSave={(next, revision) =>
            saveSlack.mutateAsync({ policy: next, revision, userId, workspaceId })
          }
        />
      ) : (
        <p role="status">Carregando política do Slack…</p>
      )}
    </div>
  );
}

export function NotificationDeliveryHistorySection(
  props: DeliveryContext & { canWorkspace: boolean },
) {
  return <DeliveryHistoryContext key={`${props.userId}:${props.workspaceId}`} {...props} />;
}

function DeliveryHistoryContext({
  workspaceId,
  userId,
  canWorkspace,
}: {
  workspaceId: string;
  userId: string;
  canWorkspace: boolean;
}) {
  const permissions = usePermissions();
  const contextReady =
    !permissions.isLoading && !permissions.isError && permissions.workspaceId === workspaceId;
  const listFn = useServerFn(listNotificationDeliveryHistory);
  const [filters, setFilters] = useState<DeliveryFilters>({
    scope: "own",
    status: "",
    channel: "",
  });
  const allowed = contextReady && (filters.scope === "own" || canWorkspace);
  useEffect(() => {
    if (!canWorkspace)
      setFilters((current) => ({
        ...current,
        scope: "own",
        channel: current.channel === "slack" ? "" : current.channel,
      }));
  }, [canWorkspace]);
  const q = useInfiniteQuery({
    queryKey: [
      "notification-delivery-history",
      userId,
      workspaceId,
      filters.scope,
      filters.status,
      filters.channel,
    ],
    initialPageParam: null as NotificationCursor | null,
    queryFn: ({ pageParam }) =>
      listFn({
        data: {
          workspaceId,
          scope: filters.scope,
          status: filters.status || undefined,
          channel: (filters.scope === "workspace"
            ? filters.channel || undefined
            : filters.channel === "slack"
              ? undefined
              : filters.channel || undefined) as
            | "inapp"
            | "email"
            | "whatsapp"
            | "slack"
            | undefined,
          cursor: pageParam,
        },
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: allowed,
    refetchInterval: 60_000,
    ...freshDeliveryQuery,
  });
  if (!contextReady) return <p role="status">Aguardando confirmação do workspace…</p>;
  return (
    <DeliveryHistoryPanel
      canRead={contextReady && allowed}
      items={
        allowed && !q.isError && q.isFetchedAfterMount
          ? (q.data?.pages.flatMap((page) => page.items) ?? [])
          : []
      }
      filters={filters}
      canWorkspace={canWorkspace}
      loading={q.isLoading || q.isRefetching || !q.isFetchedAfterMount || !allowed}
      error={q.isError ? q.error.message : null}
      hasMore={q.hasNextPage}
      loadingMore={q.isFetchingNextPage}
      onFilters={setFilters}
      onMore={() => void q.fetchNextPage()}
      onRetry={() => void q.refetch()}
    />
  );
}

export function NotificationConsentSection(props: DeliveryContext) {
  return <DeliveryConsentContext key={`${props.userId}:${props.workspaceId}`} {...props} />;
}

function DeliveryConsentContext({ workspaceId, userId }: { workspaceId: string; userId: string }) {
  const permissions = usePermissions();
  const contextReady =
    !permissions.isLoading && !permissions.isError && permissions.workspaceId === workspaceId;
  const qc = useQueryClient();
  const getFn = useServerFn(getNotificationDeliveryConsent),
    saveFn = useServerFn(saveNotificationDeliveryConsent);
  const phoneFn = useServerFn(updateNotificationProfilePhone);
  const key = ["notification-delivery-consent", userId, workspaceId];
  const q = useQuery({
    queryKey: key,
    queryFn: () => getFn({ data: { workspaceId } }),
    enabled: contextReady,
    ...freshDeliveryQuery,
  });
  const save = useMutation({
    mutationFn: (
      input: DeliveryContext & { granted: boolean; phone: string; revision: number },
    ) => {
      if (
        !contextReady ||
        input.userId !== userId ||
        input.workspaceId !== workspaceId ||
        q.isFetching ||
        q.isError ||
        !q.isFetchedAfterMount
      )
        throw new Error("Confirme o workspace antes de salvar sua autorização.");
      return saveFn({
        data: {
          workspaceId: input.workspaceId,
          granted: input.granted,
          phone: input.phone,
          revision: input.revision,
        },
      });
    },
    onSuccess: (data, input) => {
      qc.setQueryData(["notification-delivery-consent", input.userId, input.workspaceId], data);
    },
  });
  const phone = useMutation({
    mutationFn: (input: DeliveryContext & { phone: string; expectedPhone: string | null }) => {
      if (
        !contextReady ||
        input.userId !== userId ||
        input.workspaceId !== workspaceId ||
        q.isFetching ||
        q.isError ||
        !q.isFetchedAfterMount
      )
        throw new Error("Confirme o workspace antes de atualizar seu telefone.");
      return phoneFn({
        data: {
          workspaceId: input.workspaceId,
          phone: input.phone,
          expectedPhone: input.expectedPhone,
        },
      });
    },
    onSuccess: async (_, input) => {
      await qc.invalidateQueries({ queryKey: ["notification-delivery-consent", input.userId] });
    },
  });
  if (!contextReady) return <p role="status">Aguardando confirmação do workspace…</p>;
  if (q.isError)
    return (
      <div role="alert" className="space-y-2 border-t border-border pt-6">
        <p>Não foi possível carregar sua autorização de WhatsApp. {q.error.message}</p>
        <Button variant="outline" onClick={() => void q.refetch()}>
          Tentar carregar autorização novamente
        </Button>
      </div>
    );
  if (!q.data || !q.isFetchedAfterMount)
    return <p role="status">Carregando sua autorização de WhatsApp…</p>;
  return (
    <NotificationConsentPanel
      key={`${userId}:${workspaceId}`}
      canEdit={contextReady && !q.isFetching && !save.isPending && !phone.isPending}
      data={q.data}
      onSave={(input) => save.mutateAsync({ ...input, userId, workspaceId })}
      onUpdatePhone={(input) => phone.mutateAsync({ ...input, userId, workspaceId })}
    />
  );
}

export function NotificationDigestSection(props: DeliveryContext) {
  return <DigestContext key={`${props.userId}:${props.workspaceId}`} {...props} />;
}
function DigestContext({ userId, workspaceId }: DeliveryContext) {
  const readOnly = Boolean(readViewAs());
  const permissions = usePermissions();
  const contextReady =
    !permissions.isLoading && !permissions.isError && permissions.workspaceId === workspaceId;
  const qc = useQueryClient();
  const getFn = useServerFn(getNotificationDigestSettings);
  const saveFn = useServerFn(saveNotificationDigestSettings);
  const q = useQuery({
    queryKey: ["notification-digest-settings", userId, workspaceId],
    queryFn: () => getFn({ data: { workspaceId } }),
    enabled: contextReady,
    ...freshDeliveryQuery,
  });
  const save = useMutation({
    mutationFn: (
      input: DeliveryContext & { settings: NotificationDigestSettings; revision: number },
    ) => {
      if (
        readOnly ||
        !contextReady ||
        input.userId !== userId ||
        input.workspaceId !== workspaceId ||
        q.isFetching ||
        q.isError ||
        !q.isFetchedAfterMount
      )
        throw new Error("Confirme o workspace e recarregue o resumo antes de salvar.");
      return saveFn({
        data: {
          workspaceId: input.workspaceId,
          settings: input.settings,
          revision: input.revision,
        },
      });
    },
    onSuccess: (data, input) => {
      qc.setQueryData(["notification-digest-settings", input.userId, input.workspaceId], data);
    },
  });
  if (!contextReady) return <p role="status">Aguardando confirmação do workspace para o resumo…</p>;
  if (q.isError)
    return (
      <div role="alert" className="space-y-2 border-t border-border pt-6">
        <p>Não foi possível carregar suas opções do resumo. {q.error.message}</p>
        <Button variant="outline" onClick={() => void q.refetch()}>
          Tentar carregar resumo novamente
        </Button>
      </div>
    );
  if (!q.data || !q.isFetchedAfterMount)
    return <p role="status">Carregando suas opções do resumo…</p>;
  return (
    <section className="min-w-0 space-y-3">
      {q.isFetching && <p role="status">Conferindo suas opções do resumo…</p>}
      <div hidden={q.isFetching}>
        <NotificationDigestPanel
          userId={userId}
          workspaceId={workspaceId}
          settings={q.data.settings}
          revision={q.data.revision}
          canEdit={!readOnly && !q.isFetching && !save.isPending}
          onSave={(settings, revision) =>
            save.mutateAsync({ settings, revision, userId, workspaceId })
          }
        />
      </div>
    </section>
  );
}
