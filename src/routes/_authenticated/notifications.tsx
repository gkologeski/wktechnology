import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  NotificationCenter,
  type CenterFilters,
} from "@/components/notifications/notification-center";
import { NotificationPreferencesPanel } from "@/components/notifications/notification-preferences-panel";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { listMyWorkspaces } from "@/lib/workspaces.functions";
import {
  getNotificationCenter,
  markCenterNotifications,
  snoozeCenterNotification,
  getCenterPreferences,
  saveCenterPreferences,
} from "@/lib/notification-center.functions";
import type { CenterSettingsPatch } from "@/lib/notification-center-preferences";
import type { NotificationCursor } from "@/lib/notification-cursor";

export const Route = createFileRoute("/_authenticated/notifications")({
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
  const [tab, setTab] = useState<"central" | "preferences">("central");
  const [filters, setFilters] = useState<CenterFilters>({
    scope: "workspace",
    status: "all",
    category: "",
    module: "",
    q: "",
  });
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const qc = useQueryClient();
  const listFn = useServerFn(getNotificationCenter);
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
    refetchInterval: 60_000,
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
  const items = q.data?.pages.flatMap((page) => page.items) ?? [];
  const cutoff = q.data?.pages[0]?.cutoff;
  const changed = async (result: { updated: number }) => {
    setActionError(
      result.updated
        ? null
        : "Nenhum aviso foi alterado. O acesso ou o estado pode ter mudado; confira a lista atualizada.",
    );
    await qc.invalidateQueries({ queryKey: prefix });
  };
  const fail = (error: Error) =>
    setActionError(error.message || "Não foi possível salvar a alteração. Tente novamente.");
  const mark = useMutation({
    mutationFn: ({ ids, read }: { ids: string[]; read: boolean }) => {
      if (!cutoff) throw new Error("Atualize a central antes de alterar a leitura.");
      return markFn({ data: { workspaceId, ids, read, cutoff } });
    },
    onSuccess: changed,
    onError: fail,
  });
  const snooze = useMutation({
    mutationFn: ({ id, minutes }: { id: string; minutes: 0 | 60 | 1440 }) =>
      snoozeFn({ data: { workspaceId, id, minutes } }),
    onSuccess: changed,
    onError: fail,
  });
  const save = useMutation({
    mutationFn: ({ patch, revision }: { patch: CenterSettingsPatch; revision: number }) =>
      saveFn({ data: { workspaceId, patch, revision } }),
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ["notification-center-preferences", userId, workspaceId],
      });
      toast.success("Preferências do workspace salvas");
    },
  });
  return (
    <main className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Notificações"
        description={`Sua central no workspace ${workspaceName}. Avisos, leitura e preferências pessoais.`}
      />
      <nav className="flex gap-2 border-b border-border pb-3" aria-label="Áreas de notificações">
        <Button
          variant={tab === "central" ? "default" : "ghost"}
          aria-pressed={tab === "central"}
          onClick={() => setTab("central")}
        >
          <Bell className="mr-2 h-4 w-4" />
          Minha central
        </Button>
        <Button
          variant={tab === "preferences" ? "default" : "ghost"}
          aria-pressed={tab === "preferences"}
          onClick={() => setTab("preferences")}
        >
          <Settings2 className="mr-2 h-4 w-4" />
          Preferências
        </Button>
      </nav>
      {tab === "central" ? (
        <NotificationCenter
          items={items}
          filters={filters}
          selectedId={selectedId}
          unread={q.data?.pages[0]?.unread ?? 0}
          unreadCapped={q.data?.pages[0]?.unreadCapped}
          loading={q.isLoading}
          error={q.isError ? q.error.message : null}
          actionError={actionError}
          pending={mark.isPending || snooze.isPending}
          hasMore={q.hasNextPage}
          loadingMore={q.isFetchingNextPage}
          onFilters={(value) => {
            setFilters(value);
            setSelectedId(null);
            setActionError(null);
          }}
          onSelect={setSelectedId}
          onRead={(ids, read) => mark.mutate({ ids, read })}
          onSnooze={(id, minutes) => snooze.mutate({ id, minutes })}
          onRetry={() => void q.refetch()}
          onMore={() => void q.fetchNextPage()}
          summary={
            preferences.data
              ? {
                  mode: preferences.data.settings.summary,
                  timezone: preferences.data.settings.quiet.timezone,
                }
              : undefined
          }
        />
      ) : preferences.isError ? (
        <div role="alert" className="space-y-3">
          <p>Não foi possível carregar suas preferências. {preferences.error.message}</p>
          <Button variant="outline" onClick={() => void preferences.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : preferences.data ? (
        <NotificationPreferencesPanel
          legacyPrefs={preferences.data.legacyPrefs}
          settings={preferences.data.settings}
          revision={preferences.data.revision}
          onSave={(patch, revision) => save.mutateAsync({ patch, revision }).then(() => undefined)}
        />
      ) : (
        <p className="flex items-center gap-2" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando preferências…
        </p>
      )}
    </main>
  );
}
