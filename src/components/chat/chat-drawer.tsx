// Drawer principal do mensageiro — lista de conversas + thread.
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, ArrowLeft, Users, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { markRead } from "@/lib/chat.functions";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { useAuth } from "@/lib/auth";
import { ChatThread, type Conv } from "./chat-thread";
import { NewConversationDialog } from "./new-conversation-dialog";

function formatTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function ChatDrawer({
  open,
  onOpenChange,
  conversations,
  activeId,
  setActiveId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversations: Conv[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
}) {
  const { user } = useAuth();
  const { nameFor, initialsFor } = useWorkspaceMembers();
  const [newOpen, setNewOpen] = useState(false);
  const qc = useQueryClient();
  const markFn = useServerFn(markRead);

  const markMut = useMutation({
    mutationFn: (cid: string) => markFn({ data: { conversation_id: cid } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat", "conversations"] }),
  });

  useEffect(() => {
    if (open && activeId) markMut.mutate(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeId]);

  const active = useMemo(() => conversations.find((c) => c.id === activeId) ?? null, [conversations, activeId]);

  const labelFor = (c: Conv): string => {
    if (c.kind === "group") return c.title || "Grupo sem nome";
    const other = c.member_user_ids.find((id) => id !== user?.id);
    return other ? nameFor(other) : "Conversa";
  };
  const avatarFor = (c: Conv): string => {
    if (c.kind === "group") return (c.title || "G").slice(0, 2).toUpperCase();
    const other = c.member_user_ids.find((id) => id !== user?.id);
    return other ? initialsFor(other) : "?";
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col gap-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                {active ? (
                  <>
                    <Button size="icon" variant="ghost" onClick={() => setActiveId(null)}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <span>{labelFor(active)}</span>
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-4 w-4" />
                    Mensageiro
                  </>
                )}
              </span>
              {!active && (
                <Button size="sm" onClick={() => setNewOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Nova
                </Button>
              )}
            </SheetTitle>
          </SheetHeader>

          {active ? (
            <ChatThread conversation={active} labelFor={labelFor} />
          ) : (
            <ScrollArea className="flex-1">
              {conversations.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma conversa ainda. Clique em "Nova" para iniciar.
                </div>
              ) : (
                <ul className="divide-y">
                  {conversations.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(c.id)}
                        className="w-full text-left px-4 py-3 hover:bg-muted/50 flex items-center gap-3"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="text-xs">
                            {c.kind === "group" ? <Users className="h-4 w-4" /> : avatarFor(c)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate">{labelFor(c)}</span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatTime(c.last_message_at)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground truncate">
                              {c.last_message_preview || "Sem mensagens ainda"}
                            </span>
                            {c.unread_count > 0 && (
                              <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
                                {c.unread_count}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>

      <NewConversationDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={(id) => {
          setNewOpen(false);
          setActiveId(id);
          qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
          toast.success("Conversa criada");
        }}
      />
    </>
  );
}
