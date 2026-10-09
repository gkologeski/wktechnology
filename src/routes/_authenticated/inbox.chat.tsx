import { formatDateTime } from "@/lib/crm";
import { compactCount } from "@/lib/inbox/channel-page";
import { useInboxChannelPage } from "@/hooks/use-inbox-channel-page";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { InboxListFooter } from "@/components/inbox/inbox-list-footer";
import { InboxListSearch } from "@/components/inbox/inbox-list-search";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  listChatSessions,
  sendChatMessage,
  closeChatSession,
  convertChatSessionToTicket,
} from "@/lib/live-chat.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SnippetTextarea } from "@/components/snippets/snippet-textarea";
import { listConversationMessages } from "@/lib/inbox/message-history.functions";
import { useMessageHistory } from "@/hooks/use-message-history";
import { MessageHistoryViewport } from "@/components/inbox/message-history-viewport";
import type { HistoryPage } from "@/lib/inbox/message-history";
import { Badge } from "@/components/ui/badge";
import { Send, X, Ticket as TicketIcon } from "lucide-react";
import { toast } from "sonner";
import { InboxIdentityLinker } from "@/components/inbox/inbox-identity-linker";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { listWorkspaceMembers } from "@/lib/rotation.functions";
import { assignChatSession } from "@/lib/inbox-assignment.functions";
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

type ChatSessionRow = Awaited<ReturnType<typeof listChatSessions>>[number];

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const msgsFn = useServerFn(listConversationMessages);
  const sendFn = useServerFn(sendChatMessage);
  const closeFn = useServerFn(closeChatSession);
  const convertFn = useServerFn(convertChatSessionToTicket);
  const membersFn = useServerFn(listWorkspaceMembers);
  const assignFn = useServerFn(assignChatSession);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState<"mine" | "unassigned" | "all">("all");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const {
    rows: sessions,
    counts,
    total,
    query: sessionsQ,
  } = useInboxChannelPage<ChatSessionRow>("chat", filter, debouncedSearch);
  const [selectedSnapshot, setSelectedSnapshot] = useState<ChatSessionRow | null>(null);
  // Antes: consulta a cada 3 s. Agora: tempo real da sessão + reconciliação limitada.
  const history = useMessageHistory<ChatMessageRow>({
    contextKey: selected && user?.id ? `${user.id}:chat:${selected}` : null,
    fetchPage: ({ signal, ...cur }) =>
      msgsFn({
        data: { channel: "chat", conversation_id: selected!, ...cur },
        signal,
      }) as Promise<HistoryPage<ChatMessageRow>>,
    realtime: selected
      ? {
          table: "live_chat_messages",
          filter: `session_id=eq.${selected}`,
          kind: "rows",
          patchKeys: ["body"],
        }
      : null,
  });
  const membersQ = useQuery({ queryKey: ["inbox", "members"], queryFn: () => membersFn() });

  const send = useMutation({
    mutationFn: () => sendFn({ data: { session_id: selected!, body: draft.trim() } }),
    onSuccess: () => {
      setDraft("");
      void history.syncNewer();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const close = useMutation({
    mutationFn: (id: string) => closeFn({ data: { session_id: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inbox-channel", "chat"] });
      toast.success("Encerrada.");
    },
  });
  const convert = useMutation({
    mutationFn: (id: string) =>
      convertFn({ data: { session_id: id } }) as Promise<{ ticket_id: string }>,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["inbox-channel", "chat"] });
      toast.success("Ticket criado");
      navigate({ to: "/tickets/$id", params: { id: res.ticket_id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const assign = useMutation({
    mutationFn: (assignedTo: string | null) =>
      assignFn({ data: { conversationId: selected ?? "", assignedTo } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox-channel", "chat"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const messages = history.items;
  const current =
    sessions.find((s) => s.id === selected) ??
    (selectedSnapshot?.id === selected ? selectedSnapshot : undefined);
  const memberNames = new Map(
    (membersQ.data ?? []).map((member) => [member.user_id, member.full_name]),
  );

  return (
    <InboxWorkspace
      title="Chat ao vivo"
      description="Conversas iniciadas pelo widget no seu site."
      list={
        <>
          <InboxListHeader>
            <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
              <TabsList className="grid h-auto w-full grid-cols-3">
                <TabsTrigger className="flex-col gap-0 px-1" value="mine">
                  Minhas
                  {counts ? (
                    <span className="block text-[10px] font-normal text-muted-foreground">
                      {compactCount(counts.mine)}
                    </span>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger
                  className="flex-col gap-0 px-1"
                  value="unassigned"
                  title="Sem responsável"
                >
                  Sem dono
                  {counts ? (
                    <span className="block text-[10px] font-normal text-muted-foreground">
                      {compactCount(counts.unassigned)}
                    </span>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger className="flex-col gap-0 px-1" value="all">
                  Todas
                  {counts ? (
                    <span className="block text-[10px] font-normal text-muted-foreground">
                      {compactCount(counts.all)}
                    </span>
                  ) : null}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <InboxListSearch
              value={search}
              onChange={setSearch}
              placeholder="Buscar visitante ou contato…"
            />
          </InboxListHeader>
          <InboxConversationList>
            {sessionsQ.isError && sessions.length === 0 ? (
              <InboxError onRetry={() => sessionsQ.refetch()} />
            ) : sessionsQ.isPending ? (
              <InboxLoading />
            ) : sessions.length === 0 && debouncedSearch.trim() ? (
              <InboxEmpty>Nenhuma sessão encontrada.</InboxEmpty>
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
                  onClick={() => {
                    setSelected(s.id);
                    setSelectedSnapshot(s);
                  }}
                  badge={
                    s.status === "closed" ? (
                      <Badge variant="outline" className="text-[10px]">
                        fechada
                      </Badge>
                    ) : null
                  }
                  meta={sessionAssignee(s.assignee_id, memberNames)}
                />
              ))}
              {sessions.length > 0 ? (
                <InboxListFooter
                  loaded={sessions.length}
                  total={total}
                  hasMore={!!sessionsQ.hasNextPage}
                  loadingMore={sessionsQ.isFetchingNextPage}
                  error={sessionsQ.isError}
                  onLoadMore={() => void sessionsQ.fetchNextPage()}
                  onRetry={() => void sessionsQ.refetch()}
                />
              ) : null}
            </div>
          </InboxConversationList>
        </>
      }
      conversation={
        <>
          {!current ? (
            <InboxEmpty>Selecione uma sessão para iniciar o atendimento.</InboxEmpty>
          ) : history.initial === "error" ? (
            <InboxError onRetry={history.retryInitial}>
              Não foi possível carregar esta conversa.
            </InboxError>
          ) : (
            <>
              <InboxConversationHeader
                label={current.visitor_name || current.visitor_email || "Visitante anônimo"}
                subtitle={`Chat ao vivo${current.visitor_email ? ` · ${current.visitor_email}` : ""}${current.visitor_url ? ` · ${current.visitor_url}` : ""}`}
                actions={
                  <>
                    <Select
                      value={current.assignee_id ?? "_none"}
                      onValueChange={(value) => assign.mutate(value === "_none" ? null : value)}
                    >
                      <SelectTrigger
                        className="h-8 w-[190px] text-xs"
                        aria-label="Responsável pela conversa"
                      >
                        <SelectValue placeholder="Atribuir a…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Sem responsável</SelectItem>
                        {(membersQ.data ?? [])
                          .filter((member) => member.status === "active")
                          .map((member) => (
                            <SelectItem key={member.user_id} value={member.user_id}>
                              {member.full_name}
                              {member.user_id === user?.id ? " (eu)" : ""}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {current.status !== "closed" ? (
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => close.mutate(current.id)}
                        >
                          <X className="mr-1 h-4 w-4" /> Encerrar
                        </Button>
                      </>
                    ) : (
                      <Badge variant="outline">Encerrada</Badge>
                    )}
                  </>
                }
              />
              <MessageHistoryViewport
                resetKey={selected}
                count={messages.length}
                firstId={messages[0]?.id ?? null}
                lastId={messages[messages.length - 1]?.id ?? null}
                hasOlder={history.hasOlder}
                olderLoading={history.olderLoading}
                olderError={history.olderError}
                syncError={history.syncError}
                degraded={history.health === "degraded"}
                onLoadOlder={() => void history.loadOlder()}
                onRetrySync={() => void history.reconcile()}
                className="bg-product-panel-muted px-5 py-6"
              >
                {history.initial === "loading" && !messages.length ? <InboxLoading /> : null}
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
              </MessageHistoryViewport>
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
              <InboxIdentityLinker
                channel="chat"
                conversationId={current.id}
                contactId={current.contact_id}
                leadId={current.lead_id}
                status={current.identity_status}
                onLinked={() => qc.invalidateQueries({ queryKey: ["inbox-channel", "chat"] })}
              />
            </div>
          </InboxContext>
        ) : undefined
      }
    />
  );
}

function sessionAssignee(assigneeId: string | null, memberNames: Map<string, string>) {
  return assigneeId ? (memberNames.get(assigneeId) ?? "atribuída") : "sem responsável";
}

type ChatMessageRow = {
  id: string;
  created_at: string;
  direction: string;
  author_user_id: string | null;
  body: string;
};
