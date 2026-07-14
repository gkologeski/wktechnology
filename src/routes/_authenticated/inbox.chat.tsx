import { formatDateTime } from "@/lib/crm";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  listChatSessions,
  listChatMessages,
  sendChatMessage,
  closeChatSession,
  convertChatSessionToTicket,
} from "@/lib/live-chat.functions";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SnippetTextarea } from "@/components/snippets/snippet-textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, X, Ticket as TicketIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/inbox/chat")({
  component: LiveChatInbox,
});

function LiveChatInbox() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listChatSessions);
  const msgsFn = useServerFn(listChatMessages);
  const sendFn = useServerFn(sendChatMessage);
  const closeFn = useServerFn(closeChatSession);
  const convertFn = useServerFn(convertChatSessionToTicket);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const sessionsQ = useQuery({
    queryKey: ["chat-sessions"],
    queryFn: () => listFn(),
    refetchInterval: 10000,
  });
  const messagesQ = useQuery({
    queryKey: ["chat-messages", selected],
    queryFn: () => msgsFn({ data: { session_id: selected! } }),
    enabled: !!selected,
    refetchInterval: 3000,
  });

  useEffect(() => {
    const ch = supabase
      .channel("live-chat-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_chat_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["chat-messages"] });
        qc.invalidateQueries({ queryKey: ["chat-sessions"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "live_chat_sessions" }, () => {
        qc.invalidateQueries({ queryKey: ["chat-sessions"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const send = useMutation({
    mutationFn: () => sendFn({ data: { session_id: selected!, body: draft.trim() } }),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["chat-messages", selected] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const close = useMutation({
    mutationFn: (id: string) => closeFn({ data: { session_id: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-sessions"] });
      toast.success("Encerrada.");
    },
  });
  const convert = useMutation({
    mutationFn: (id: string) =>
      convertFn({ data: { session_id: id } }) as Promise<{ ticket_id: string }>,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["chat-sessions"] });
      toast.success("Ticket criado");
      navigate({ to: "/tickets/$id", params: { id: res.ticket_id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sessions = sessionsQ.data ?? [];
  const messages = messagesQ.data ?? [];
  const current = sessions.find((s) => s.id === selected);

  return (
    <div className="space-y-4">
      <PageHeader title="Chat ao vivo" description="Conversas iniciadas pelo widget no seu site." />
      <div className="grid grid-cols-[300px_1fr] gap-3 h-[calc(100vh-12rem)]">
        <Card className="overflow-hidden flex flex-col">
          <div className="p-2 border-b text-xs text-muted-foreground">
            {sessions.length} sessão(ões)
          </div>
          <ScrollArea className="flex-1">
            {sessions.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">Nenhuma sessão ainda.</div>
            )}
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className={`w-full text-left p-3 border-b hover:bg-muted/50 ${selected === s.id ? "bg-muted" : ""}`}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate flex-1">
                    {s.visitor_name || s.visitor_email || "Visitante anônimo"}
                  </span>
                  {s.status === "closed" && (
                    <Badge variant="outline" className="text-[10px]">
                      fechada
                    </Badge>
                  )}
                </div>
                {s.visitor_email && (
                  <div className="text-xs text-muted-foreground truncate">{s.visitor_email}</div>
                )}
                <div className="text-[10px] text-muted-foreground">
                  {s.last_message_at ? formatDateTime(s.last_message_at) : ""}
                </div>
              </button>
            ))}
          </ScrollArea>
        </Card>

        <Card className="overflow-hidden flex flex-col">
          {!current ? (
            <div className="flex-1 grid place-items-center text-sm text-muted-foreground">
              Selecione uma sessão
            </div>
          ) : (
            <>
              <div className="p-3 border-b flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {current.visitor_name || "Visitante"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {current.visitor_email || "—"}
                    {current.visitor_url ? ` · ${current.visitor_url}` : ""}
                  </div>
                </div>
                {current.status !== "closed" && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => convert.mutate(current.id)}
                      disabled={convert.isPending}
                    >
                      <TicketIcon className="h-4 w-4 mr-1" />{" "}
                      {convert.isPending ? "Criando…" : "Virar ticket"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => close.mutate(current.id)}>
                      <X className="h-4 w-4 mr-1" /> Encerrar
                    </Button>
                  </div>
                )}
              </div>
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-2">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.direction === "inbound" ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`rounded-2xl px-3 py-2 max-w-[75%] text-sm ${m.direction === "inbound" ? "bg-muted" : "bg-primary text-primary-foreground"}`}
                      >
                        {m.body}
                        <div className="text-[10px] opacity-70 mt-1">
                          {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {current.status !== "closed" && (
                <div className="border-t p-2 flex items-end gap-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={2}
                    placeholder="Responder…"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (draft.trim()) send.mutate();
                      }
                    }}
                    className="resize-none"
                  />
                  <Button onClick={() => send.mutate()} disabled={!draft.trim() || send.isPending}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
