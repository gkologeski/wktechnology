import { usePermissions } from "@/lib/access-control/use-permissions";
// Botão flutuante que abre o mensageiro (drawer).
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { registerDockOpener, setDockState } from "@/components/floating-dock/side-dock-store";
import { listConversations } from "@/lib/chat.functions";
import { useAuth } from "@/lib/auth";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { useChatRealtime } from "@/hooks/use-chat-realtime";
import { ChatDrawer } from "./chat-drawer";

export function ChatTrigger() {
  const { user } = useAuth();
  const permissions = usePermissions();
  const allowed =
    !permissions.isLoading && !permissions.isError && permissions.can("system.messenger.view.own");
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const listFn = useServerFn(listConversations);
  const { nameFor } = useWorkspaceMembers();

  const { data } = useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: async () => {
      // Evita chamar o servidor sem sessão (ex.: durante o logout ou sessão expirada).
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return [];
      return listFn();
    },
    enabled: !!user?.id && allowed,
    staleTime: 15_000,
    retry: false,
  });

  useChatRealtime({
    activeConversationId: open ? activeId : null,
    resolveSender: nameFor,
  });

  const unread = (data ?? []).reduce((acc, c) => acc + (c.unread_count || 0), 0);

  useEffect(() => {
    setDockState({ chatAllowed: allowed, chatUnread: allowed ? unread : 0 });
  }, [allowed, unread]);
  useEffect(() => registerDockOpener("chat", () => setOpen(true)), []);
  useEffect(() => () => setDockState({ chatAllowed: false, chatUnread: 0 }), []);

  if (!allowed) return null;
  return (
    <>
      <ChatDrawer
        open={open}
        onOpenChange={setOpen}
        conversations={data ?? []}
        activeId={activeId}
        setActiveId={setActiveId}
      />
    </>
  );
}
