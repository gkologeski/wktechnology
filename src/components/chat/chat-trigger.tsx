// Botão flutuante que abre o mensageiro (drawer).
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquare } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { listConversations } from "@/lib/chat.functions";
import { useAuth } from "@/lib/auth";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { useChatRealtime } from "@/hooks/use-chat-realtime";
import { ChatDrawer } from "./chat-drawer";

export function ChatTrigger() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const listFn = useServerFn(listConversations);
  const { nameFor } = useWorkspaceMembers();

  const { data } = useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: () => listFn(),
    enabled: !!user?.id,
    staleTime: 15_000,
    retry: false,
  });

  useChatRealtime({
    activeConversationId: open ? activeId : null,
    resolveSender: nameFor,
  });

  const unread = (data ?? []).reduce((acc, c) => acc + (c.unread_count || 0), 0);

  return (
    <>
      <div className="fixed bottom-5 right-20 z-50">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                onClick={() => setOpen(true)}
                aria-label="Abrir mensageiro"
                className="h-12 w-12 rounded-full shadow-lg relative opacity-10 hover:opacity-100 transition-opacity duration-200"
                variant="secondary"
              >
                <MessageSquare className="h-5 w-5" />
                {unread > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs rounded-full"
                  >
                    {unread > 99 ? "99+" : unread}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Mensageiro do workspace</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
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
