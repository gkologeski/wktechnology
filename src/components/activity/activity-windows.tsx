import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyWorkspaces } from "@/lib/workspaces.functions";
import { fetchTimelineTarget } from "@/lib/timeline/activity-entities";
import { toast } from "sonner";
import {
  ActivityWindowsProvider,
  WindowChromeContext,
  type ActivityWindowRequest,
} from "./activity-window-context";
import { ActivityWindowFrame } from "./activity-window-frame";
import { ActivityLogWindow } from "./activity-log-window";
import { TimelineActionDialogs } from "./timeline-action-dialogs";

interface WindowEntry {
  id: string;
  request: ActivityWindowRequest;
  minimized: boolean;
  expanded: boolean;
}

export function ActivityWindows({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const listWorkspaces = useServerFn(listMyWorkspaces);
  const { data } = useQuery({
    queryKey: ["my-workspaces", user?.id],
    queryFn: () => listWorkspaces(),
    enabled: !!user,
  });
  const workspaceId = data?.active_workspace_id;
  const [windows, setWindows] = useState<WindowEntry[]>([]);
  const [identity, setIdentity] = useState<string | null>(null);
  const currentIdentity = user && workspaceId ? `${user.id}:${workspaceId}` : null;
  useEffect(() => {
    if (identity !== currentIdentity) {
      setWindows([]);
      setIdentity(currentIdentity);
    }
  }, [identity, currentIdentity]);
  const open = useCallback(
    (request: ActivityWindowRequest) => {
      if (!currentIdentity) return;
      if (request.action.kind === "create" && request.action.disabled) return;
      setWindows((previous) => {
        const match = previous.find(
          (w) =>
            w.request.action.kind === request.action.kind &&
            w.request.action.value === request.action.value &&
            w.request.relatedKey === request.relatedKey &&
            w.request.relatedId === request.relatedId,
        );
        if (match)
          return [...previous.filter((w) => w.id !== match.id), { ...match, minimized: false }];
        return [
          ...previous,
          { id: crypto.randomUUID(), request, minimized: false, expanded: false },
        ];
      });
    },
    [currentIdentity],
  );
  const close = (id: string) => {
    setWindows((ws) => ws.filter((w) => w.id !== id));
    window.dispatchEvent(new CustomEvent("activities:changed"));
  };
  const focus = (id: string) =>
    setWindows((ws) => {
      const w = ws.find((item) => item.id === id);
      return w ? [...ws.filter((item) => item.id !== id), { ...w, minimized: false }] : ws;
    });
  const visible = windows.filter((w) => !w.minimized);
  const minimized = windows.filter((w) => w.minimized);
  return (
    <ActivityWindowsProvider open={open}>
      {children}
      {currentIdentity &&
        windows.map((w) => {
          const position = visible.findIndex((item) => item.id === w.id);
          const chrome = {
            id: w.id,
            title: `${w.request.action.label}`,
            position: Math.max(0, visible.length - 1 - position),
            minimized: w.minimized,
            expanded: w.expanded,
            onFocus: () => focus(w.id),
            onMinimize: () =>
              setWindows((ws) =>
                ws.map((item) => (item.id === w.id ? { ...item, minimized: true } : item)),
              ),
            onExpand: () =>
              setWindows((ws) =>
                ws.map((item) => (item.id === w.id ? { ...item, expanded: !item.expanded } : item)),
              ),
            onClose: () => {
              if (!window.confirm("Fechar esta janela? Alterações não salvas podem ser perdidas."))
                return;
              close(w.id);
            },
          };
          return (
            <WindowChromeContext.Provider key={w.id} value={chrome}>
              <div className={w.minimized || chrome.position > 1 ? "hidden" : "contents"}>
                {w.request.action.kind === "log" ? (
                  <ActivityWindowFrame>
                    <ActivityLogWindow request={w.request} onSaved={() => close(w.id)} />
                  </ActivityWindowFrame>
                ) : (
                  <ActivityActionWindow request={w.request} onClose={() => close(w.id)} />
                )}
              </div>
            </WindowChromeContext.Provider>
          );
        })}
      {currentIdentity && windows.length > 1 && (
        <nav
          aria-label="Janelas de atividades"
          className="fixed bottom-2 left-2 z-[130] flex max-w-[calc(100vw-1rem)] gap-1 overflow-x-auto rounded-md border border-product-divider bg-product-panel p-1 shadow-lg max-sm:bottom-0 max-sm:left-0 max-sm:w-full max-sm:max-w-full max-sm:rounded-none"
        >
          {windows.map((w) => (
            <Button
              key={w.id}
              variant={visible.at(-1)?.id === w.id ? "secondary" : "ghost"}
              size="sm"
              className="shrink-0"
              onClick={() => focus(w.id)}
              aria-label={`${w.minimized ? "Restaurar" : "Alternar para"} ${w.request.action.label}`}
            >
              {w.request.action.label}
            </Button>
          ))}
        </nav>
      )}
    </ActivityWindowsProvider>
  );
}

function ActivityActionWindow({
  request,
  onClose,
}: {
  request: ActivityWindowRequest;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<Awaited<ReturnType<typeof fetchTimelineTarget>>>(null);
  useEffect(() => {
    let active = true;
    void fetchTimelineTarget(request.relatedKey, request.relatedId).then((value) => {
      if (active) setTarget(value);
    });
    return () => {
      active = false;
    };
  }, [request.relatedKey, request.relatedId]);
  const action = request.action.kind === "create" ? request.action.value : null;
  useEffect(() => {
    if ((action === "call" || action === "whatsapp") && target && !target.phone) {
      toast.error("Sem telefone disponível para esta entidade.");
      onClose();
    }
    // Only act on a completed target lookup, not on the changing close callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, target]);
  return (
    <TimelineActionDialogs
      openAction={action}
      onClose={onClose}
      relatedKey={request.relatedKey}
      relatedId={request.relatedId}
      target={target ?? {}}
      dialerMounted={action === "call"}
      onRefresh={() => window.dispatchEvent(new CustomEvent("activities:changed"))}
    />
  );
}
