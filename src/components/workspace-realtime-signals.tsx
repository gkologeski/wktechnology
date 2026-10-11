import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { listMyWorkspaces } from "@/lib/workspaces.functions";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";

export function WorkspaceRealtimeSignals() {
  const { user } = useAuth();
  const list = useServerFn(listMyWorkspaces);
  const context = useQuery({
    queryKey: ["my-workspaces", user?.id],
    queryFn: () => list(),
    enabled: !!user,
    staleTime: 60_000,
  });
  const workspaceId = context.data?.active_workspace_id;
  useRealtimeInvalidate(
    workspaceId
      ? [
          {
            table: "workspace_realtime_signals",
            filter: `workspace_id=eq.${workspaceId}`,
            queryKeys: [["deals"], ["meetings"], ["calendar"], ["activities"]],
            onChange: () => window.dispatchEvent(new Event("timeline:refresh")),
          },
        ]
      : [],
    { scope: `${user?.id ?? ""}:${workspaceId ?? ""}` },
  );
  return null;
}
