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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SnippetTextarea } from "@/components/snippets/snippet-textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, X, Ticket as TicketIcon } from "lucide-react";
import { toast } from "sonner";
import {
  InboxConversationHeader,
  InboxConversationItem,
  InboxConversationList,
  InboxContext,
  InboxEmpty,
  InboxError,
  InboxListHeader,
  InboxLoading,
  InboxMessageBubble,
  InboxWorkspace,
} from "@/components/inbox/inbox-workspace";

export const Route = createFileRoute("/_authenticated/inbox/chat")({
  head: () => ({
    meta: [
      { title: "Chat ao vivo — Inbox TechERP" },
      { name: "description", content: "Atendimento em tempo real pelo chat do workspace." },
      { property: "og:title", content: "Chat ao vivo — Inbox TechERP" },
      { property: "og:description", content: "Atendimento em tempo real pelo chat do workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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
    <InboxWorkspace
      title="Chat ao vivo"
      description="Conversas iniciadas pelo widget no seu site."
      list={
        <>
          <InboxListHeader>
            <p className="text-xs text-muted-foreground">{sessions.length} sessão(ões)</p>
          </InboxListHeader>
          <InboxConversationList>
            {sessionsQ.isError ? (
              <InboxError onRetry={() => sessionsQ.refetch()} />
            ) : sessionsQ.isLoading ? (
              <InboxLoading />
            ) : sessions.length === 0 ? (
              <InboxEmpty>Nenhuma sessão ainda.</InboxEmpty>
            ) : null}
            <div className="space-y-1 px-2 pb-3">
              {sessions.map((s) => (
                <InboxConversationItem
                  key={s.id}
                  label={s.visitor_name || s.visitor_email || "Visitante anônimo"}
                  preview={s.visitor_email || "Sem email informado"}
                  when={s.last_message_at}
                  whenTitle={s.last_message_at ? formatDateTime(s.last_message_at) : undefined}
                  selected={selected === s.id}
                  onClick={() => setSelected(s.id)}
                  badge={
                    s.status === "closed" ? (
                      <Badge variant="outline" className="text-[10px]">
                        fechada
                      </Badge>
                    ) : null
                  }
                />
              ))}
            </div>
          </InboxConversationList>
        </>
      }
      conversation={
        <>
          {!current ? (
            <InboxEmpty>Selecione uma sessão para iniciar o atendimento.</InboxEmpty>
          ) : messagesQ.isError ? (
            <InboxError onRetry={() => messagesQ.refetch()}>
              Não foi possível carregar esta conversa.
            </InboxError>
          ) : (
            <>
              <InboxConversationHeader
                label={current.visitor_name || current.visitor_email || "Visitante anônimo"}
                subtitle={`Chat ao vivo${current.visitor_email ? ` · ${current.visitor_email}` : ""}${current.visitor_url ? ` · ${current.visitor_url}` : ""}`}
                actions={
                  current.status !== "closed" ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => convert.mutate(current.id)}
                        disabled={convert.isPending}
                      >
                        <TicketIcon className="mr-1 h-4 w-4" />{" "}
                        {convert.isPending ? "Criando…" : "Virar ticket"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => close.mutate(current.id)}>
                        <X className="mr-1 h-4 w-4" /> Encerrar
                      </Button>
                    </>
                  ) : (
                    <Badge variant="outline">Encerrada</Badge>
                  )
                }
              />
              <ScrollArea className="flex-1 bg-product-panel-muted px-5 py-6" aria-live="polite">
                <div className="space-y-5">
                  {messages.map((m) => (
                    <InboxMessageBubble
                      key={m.id}
                      outbound={m.direction !== "inbound"}
                      when={m.created_at}
                      status={m.direction !== "inbound" ? "sent" : null}
                    >
                      <div className="whitespace-pre-wrap">{m.body}</div>
                    </InboxMessageBubble>
                  ))}
                </div>
              </ScrollArea>
              {current.status !== "closed" && (
                <div className="flex items-end gap-2 bg-product-panel p-4">
                  <div className="flex flex-1 items-end gap-2 rounded-[calc(var(--radius)+1rem)] bg-product-panel-muted p-2 ring-1 ring-border-subtle focus-within:ring-2 focus-within:ring-ring">
                    <SnippetTextarea
                      value={draft}
                      onChange={setDraft}
                      rows={2}
                      placeholder="Responder…"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (draft.trim()) send.mutate();
                        }
                      }}
                      className="min-h-12 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                    />
                    <Button
                      onClick={() => send.mutate()}
                      disabled={!draft.trim() || send.isPending}
                      aria-label="Enviar mensagem"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      }
      context={
        current ? (
          <InboxContext
            initials={(current.visitor_name || current.visitor_email || "VA")
              .slice(0, 2)
              .toUpperCase()}
            title={current.visitor_name || "Visitante"}
            subtitle={current.visitor_email || "Visitante anônimo"}
          >
            <div className="space-y-3 border-t border-border pt-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Página de origem</p>
                <p className="mt-1 break-all font-medium">
                  {current.visitor_url || "Não informada"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="mt-1 font-medium">
                  {current.status === "closed" ? "Encerrada" : "Em atendimento"}
                </p>
              </div>
            </div>
          </InboxContext>
        ) : undefined
      }
    />
  );
}
