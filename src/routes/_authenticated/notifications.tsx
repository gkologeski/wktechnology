import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2, Settings2, Workflow, FileText, History } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  NotificationCenter,
  type CenterFilters,
} from "@/components/notifications/notification-center";
import { NotificationRulesPanel } from "@/components/notifications/notification-rules-panel";
import {
  NotificationDeliveryConfiguration,
  NotificationDeliveryHistorySection,
  NotificationConsentSection,
  NotificationDigestSection,
} from "@/components/notifications/delivery-operations";
import { getNotificationDeliveryCapabilities } from "@/lib/notification-delivery.functions";
import { NotificationPreferencesPanel } from "@/components/notifications/notification-preferences-panel";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { listMyWorkspaces } from "@/lib/workspaces.functions";
import { readViewAs } from "@/lib/view-as-client";
import {
  getNotificationCenter,
  lookupCenterNotifications,
  markCenterNotifications,
  snoozeCenterNotification,
  getCenterPreferences,
  saveCenterPreferences,
} from "@/lib/notification-center.functions";
import type { CenterSettingsPatch } from "@/lib/notification-center-preferences";
import type { NotificationCursor } from "@/lib/notification-cursor";

type NotificationArea = "central" | "preferences" | "rules" | "models" | "deliveries";
const areaSchema = z.enum(["central", "preferences", "rules", "models", "deliveries"]);
export const Route = createFileRoute("/_authenticated/notifications")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { area: NotificationArea; notice?: string; invalidNotice?: boolean } => {
    const parsed = areaSchema.safeParse(search.area ?? "central");
    const area = parsed.success ? parsed.data : "central";
    const notice = z.string().uuid().safeParse(search.notice);
    return {
      area,
      notice: area === "central" && notice.success ? notice.data.toLowerCase() : undefined,
      invalidNotice:
        area === "central" && search.notice != null && !notice.success ? true : undefined,
    };
  },
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const permissions = usePermissions();
  if (permissions.isLoading)
    return (
      <div className="flex items-center gap-2 p-6" role="status">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando workspace…
      </div>
    );
  if (permissions.isError || !permissions.workspaceId || !user?.id)
    return (
      <div role="alert" className="space-y-3 p-6">
        <p>Não foi possível confirmar seu acesso ao workspace ativo.</p>
        <Button variant="outline" onClick={permissions.refetch}>
          Tentar novamente
        </Button>
      </div>
    );
  return (
    <NotificationWorkspace
      key={`${user.id}:${permissions.workspaceId}`}
      userId={user.id}
      workspaceId={permissions.workspaceId}
    />
  );
}

function NotificationWorkspace({ userId, workspaceId }: { userId: string; workspaceId: string }) {
  const routeSearch = Route.useSearch();
  const navigate = Route.useNavigate();
  const tab = routeSearch.area;
  const selectArea = (area: NotificationArea) => {
    setSelectedId(null);
    setActionError(null);
    void navigate({ search: { area }, replace: true });
  };
  const [filters, setFilters] = useState<CenterFilters>({
    scope: "workspace",
    status: "all",
    category: "",
    module: "",
    q: "",
  });
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(routeSearch.notice ?? null);
  useEffect(() => {
    setSelectedId(routeSearch.notice ?? null);
  }, [routeSearch.notice]);
  const [actionError, setActionError] = useState<string | null>(null);
  const qc = useQueryClient();
  const permissions = usePermissions();
  const viewAs = readViewAs();
  const readOnly = viewAs?.readOnly === true || viewAs?.mode === "role";
  const deliveryCapabilitiesFn = useServerFn(getNotificationDeliveryCapabilities);
  const deliveryCapabilities = useQuery({
    queryKey: ["notification-delivery-capabilities", userId, workspaceId],
    queryFn: () => deliveryCapabilitiesFn({ data: { workspaceId } }),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  const canRules = permissions.canAny(
    ["own", "team", "workspace"].map((scope) => `system.workflows.view.${scope}`),
  );
  const listFn = useServerFn(getNotificationCenter);
  const lookupFn = useServerFn(lookupCenterNotifications);
  const markFn = useServerFn(markCenterNotifications);
  const snoozeFn = useServerFn(snoozeCenterNotification);
  const prefsFn = useServerFn(getCenterPreferences);
  const saveFn = useServerFn(saveCenterPreferences);
  const workspacesFn = useServerFn(listMyWorkspaces);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(filters.q), 250);
    return () => clearTimeout(timer);
  }, [filters.q]);
  const prefix = ["notification-center", userId, workspaceId];
  const q = useInfiniteQuery({
    queryKey: [...prefix, filters.scope, filters.status, filters.category, filters.module, search],
    enabled: tab === "central",
    staleTime: 0,
    refetchOnMount: "always",
    initialPageParam: null as { cursor: NotificationCursor; cutoff: string } | null,
    queryFn: ({ pageParam }) =>
      listFn({
        data: {
          workspaceId,
          scope: filters.scope,
          status: filters.status,
          category: filters.category || null,
          module: filters.module || null,
          q: search,
          cursor: pageParam?.cursor,
          cutoff: pageParam?.cutoff,
        },
      }),
    getNextPageParam: (last) =>
      last.nextCursor ? { cursor: last.nextCursor, cutoff: last.cutoff } : undefined,
    refetchInterval: tab === "central" ? 60_000 : false,
  });
  const preferences = useQuery({
    queryKey: ["notification-center-preferences", userId, workspaceId],
    queryFn: () => prefsFn({ data: { workspaceId } }),
  });
  const workspaces = useQuery({
    queryKey: ["my-workspaces", userId],
    queryFn: () => workspacesFn(),
    staleTime: 60_000,
  });
  const workspaceName =
    workspaces.data?.workspaces.find((workspace) => workspace.id === workspaceId)?.name ??
    "Workspace ativo";
  const searchPending = filters.q !== search;
  const listReady =
    tab === "central" &&
    !searchPending &&
    !q.isError &&
    !q.isPending &&
    !(q.isFetching && !q.isFetchingNextPage);
  const items = listReady ? (q.data?.pages.flatMap((page) => page.items) ?? []) : [];
  const cutoff = listReady ? q.data?.pages[0]?.cutoff : undefined;
  const outsidePage = Boolean(selectedId && !items.some((item) => item.id === selectedId));
  const focused = useQuery({
    queryKey: [...prefix, "focus", selectedId],
    queryFn: () => lookupFn({ data: { workspaceId, ids: [selectedId!] } }),
    enabled: tab === "central" && Boolean(selectedId) && listReady && outsidePage,
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: tab === "central" && outsidePage ? 60_000 : false,
  });
  const focusedReady = outsidePage && !focused.isError && !focused.isFetching && focused.isSuccess;
  const focusedItem = focusedReady
    ? (focused.data.items.find((item) => item.id === selectedId) ?? null)
    : null;
  const detailError =
    selectedId && outsidePage && listReady && focused.isError
      ? "Não foi possível conferir este aviso. Atualize a central e tente novamente."
      : selectedId && outsidePage && focusedReady && !focusedItem
        ? "Este aviso está indisponível no workspace ativo ou seu acesso mudou."
        : null;
  const identity = `${userId}:${workspaceId}`;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  useEffect(
    () => () => {
      currentIdentity.current = "";
    },
    [],
  );
  const selectNotice = (id: string) => {
    if (!listReady) return;
    setSelectedId(id);
    setActionError(null);
    void navigate({ search: { area: "central", notice: id }, replace: true });
  };
  const dismissNotice = () => {
    setSelectedId(null);
    void navigate({ search: { area: "central" }, replace: true });
  };
  const changed = async (result: { updated: number }) => {
    if (currentIdentity.current !== identity) return;
    setActionError(
      result.updated
        ? null
        : "Nenhum aviso foi alterado. O acesso ou o estado pode ter mudado; confira a lista atualizada.",
    );
    await qc.invalidateQueries({ queryKey: prefix });
  };
  const fail = (error: Error) => {
    if (currentIdentity.current === identity)
      setActionError(error.message || "Não foi possível salvar a alteração. Tente novamente.");
  };
  const mark = useMutation({
    mutationFn: ({ ids, read }: { ids: string[]; read: boolean }) => {
      const effectiveCutoff =
        ids.length === 1 && focusedItem?.id === ids[0] ? focused.data?.checkedAt : cutoff;
      if (readOnly || !listReady || !effectiveCutoff || currentIdentity.current !== identity)
        throw new Error("Atualize a central antes de alterar a leitura.");
      return markFn({ data: { workspaceId, ids, read, cutoff: effectiveCutoff } });
    },
    onSuccess: changed,
    onError: fail,
  });
  const snooze = useMutation({
    mutationFn: ({ id, minutes }: { id: string; minutes: 0 | 60 | 1440 }) => {
      if (
        readOnly ||
        !listReady ||
        currentIdentity.current !== identity ||
        ![...items, focusedItem].some((item) => item?.id === id)
      )
        throw new Error("Atualize a central antes de alterar o adiamento.");
      return snoozeFn({ data: { workspaceId, id, minutes } });
    },
    onSuccess: changed,
    onError: fail,
  });
  const save = useMutation({
    mutationFn: ({ patch, revision }: { patch: CenterSettingsPatch; revision: number }) => {
      if (readOnly || currentIdentity.current !== identity)
        throw new Error("Preferências indisponíveis nesta visualização.");
      return saveFn({ data: { workspaceId, patch, revision } });
    },
    onSuccess: async () => {
      if (currentIdentity.current !== identity) return;
      await qc.invalidateQueries({
        queryKey: ["notification-center-preferences", userId, workspaceId],
      });
      if (currentIdentity.current === identity) toast.success("Preferências do workspace salvas");
    },
  });
  return (
    <main className="min-w-0 space-y-6 p-4 md:p-6">
      <PageHeader
        title="Notificações"
        description={`Sua central no workspace ${workspaceName}. Avisos, leitura e preferências pessoais.`}
      />
      <nav
        className="flex flex-wrap gap-2 border-b border-border pb-3"
        aria-label="Áreas de notificações"
      >
        <Button
          variant={tab === "central" ? "default" : "ghost"}
          aria-pressed={tab === "central"}
          onClick={() => selectArea("central")}
        >
          <Bell className="mr-2 h-4 w-4" />
          Minha central
        </Button>
        {canRules && (
          <Button
            variant={tab === "rules" ? "default" : "ghost"}
            aria-pressed={tab === "rules"}
            onClick={() => selectArea("rules")}
          >
            <Workflow className="mr-2 h-4 w-4" />
            Regras
          </Button>
        )}
        {deliveryCapabilities.data?.settingsView && (
          <Button
            variant={tab === "models" ? "default" : "ghost"}
            aria-pressed={tab === "models"}
            onClick={() => selectArea("models")}
          >
            <FileText className="mr-2 h-4 w-4" />
            Modelos e canais
          </Button>
        )}
        {deliveryCapabilities.data?.deliveriesView && (
          <Button
            variant={tab === "deliveries" ? "default" : "ghost"}
            aria-pressed={tab === "deliveries"}
            onClick={() => selectArea("deliveries")}
          >
            <History className="mr-2 h-4 w-4" />
            Entregas
          </Button>
        )}
        <Button
          variant={tab === "preferences" ? "default" : "ghost"}
          aria-pressed={tab === "preferences"}
          onClick={() => selectArea("preferences")}
        >
          <Settings2 className="mr-2 h-4 w-4" />
          Preferências
        </Button>
      </nav>
      {deliveryCapabilities.isError && (
        <div role="alert" className="text-sm text-muted-foreground">
          Não foi possível confirmar os recursos de entrega. A central continua disponível.{" "}
          <Button variant="link" onClick={() => void deliveryCapabilities.refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {readOnly && (
        <p role="note" className="text-sm text-muted-foreground">
          Visualização somente leitura: os avisos continuam disponíveis; leitura e adiamento não
          podem ser alterados.
        </p>
      )}
      {tab === "central" && routeSearch.invalidNotice && (
        <p role="alert" className="text-sm text-muted-foreground">
          O aviso indicado no endereço não é válido. Selecione um item da central.
        </p>
      )}
      {tab === "central" ? (
        <NotificationCenter
          items={items}
          filters={filters}
          selectedId={selectedId}
          unread={listReady ? (q.data?.pages[0]?.unread ?? null) : null}
          unreadCapped={listReady ? q.data?.pages[0]?.unreadCapped : undefined}
          loading={!listReady && !q.isError && !searchPending}
          searchPending={searchPending}
          focusedItem={focusedItem}
          detailLoading={outsidePage && !detailError && !focusedReady}
          detailError={detailError}
          onDismiss={dismissNotice}
          error={q.isError ? q.error.message : null}
          actionError={actionError}
          pending={mark.isPending || snooze.isPending || readOnly}
          hasMore={listReady && q.hasNextPage}
          loadingMore={q.isFetchingNextPage}
          onFilters={(value) => {
            setFilters(value.scope === "legacy" ? { ...value, module: "", q: "" } : value);
            if (value.scope === "legacy") setSearch("");
            setSelectedId(null);
            if (routeSearch.notice) void navigate({ search: { area: "central" }, replace: true });
            setActionError(null);
          }}
          onSelect={selectNotice}
          onRead={(ids, read) => mark.mutate({ ids, read })}
          onSnooze={(id, minutes) => snooze.mutate({ id, minutes })}
          onRetry={() => {
            void q.refetch();
            if (selectedId && outsidePage) void focused.refetch();
          }}
          onMore={() => {
            if (listReady && !q.isFetchingNextPage) void q.fetchNextPage();
          }}
          summary={
            preferences.data
              ? {
                  mode: preferences.data.settings.summary,
                  timezone: preferences.data.settings.quiet.timezone,
                }
              : undefined
          }
        />
      ) : tab === "rules" ? (
        canRules ? (
          <NotificationRulesPanel
            key={`${userId}:${workspaceId}`}
            userId={userId}
            workspaceId={workspaceId}
          />
        ) : (
          <p>Sem permissão para consultar regras de Workflow.</p>
        )
      ) : tab === "models" ? (
        deliveryCapabilities.data?.settingsView ? (
          <NotificationDeliveryConfiguration
            key={`${userId}:${workspaceId}`}
            userId={userId}
            workspaceId={workspaceId}
            capabilities={deliveryCapabilities.data}
          />
        ) : (
          <p>Não foi possível confirmar sua permissão para configurar modelos e canais.</p>
        )
      ) : tab === "deliveries" ? (
        deliveryCapabilities.data?.deliveriesView ? (
          <NotificationDeliveryHistorySection
            key={`${userId}:${workspaceId}`}
            userId={userId}
            workspaceId={workspaceId}
            canWorkspace={deliveryCapabilities.data.deliveriesWorkspaceView}
          />
        ) : (
          <p>Não foi possível confirmar seu acesso ao histórico de entregas.</p>
        )
      ) : preferences.isError ? (
        <div role="alert" className="space-y-3">
          <p>Não foi possível carregar suas preferências. {preferences.error.message}</p>
          <Button variant="outline" onClick={() => void preferences.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : preferences.data ? (
        <fieldset disabled={readOnly} className="min-w-0 space-y-8">
          <NotificationPreferencesPanel
            legacyPrefs={preferences.data.legacyPrefs}
            settings={preferences.data.settings}
            revision={preferences.data.revision}
            onSave={(patch, revision) =>
              save.mutateAsync({ patch, revision }).then(() => undefined)
            }
          />
          <NotificationDigestSection
            key={`digest:${userId}:${workspaceId}`}
            userId={userId}
            workspaceId={workspaceId}
          />
          <NotificationConsentSection
            key={`${userId}:${workspaceId}`}
            userId={userId}
            workspaceId={workspaceId}
          />
        </fieldset>
      ) : (
        <p className="flex items-center gap-2" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando preferências…
        </p>
      )}
    </main>
  );
}
