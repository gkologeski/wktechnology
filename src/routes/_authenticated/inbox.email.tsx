import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import DOMPurify from "dompurify";
import { Mail, RefreshCw, Reply, Eye, MousePointerClick, Paperclip, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getEmailThread } from "@/lib/email-inbox.functions";
import { compactCount } from "@/lib/inbox/channel-page";
import { useInboxChannelPage } from "@/hooks/use-inbox-channel-page";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { InboxListFooter } from "@/components/inbox/inbox-list-footer";
import { InboxListSearch } from "@/components/inbox/inbox-list-search";
import { syncMyEmailAccounts } from "@/lib/gmail-sync.functions";
import { useActivityWindows } from "@/components/activity/activity-window-context";
import { ACTIONS_BY_KEY } from "@/components/activity/timeline-shared";
import { formatDateTime } from "@/lib/crm";
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
import { assignEmailThread } from "@/lib/inbox-assignment.functions";
import {
  InboxConversationItem,
  InboxConversationList,
  InboxConversationHeader,
  InboxMessageBubble,
  InboxContext,
  InboxEmpty,
  InboxError,
  InboxListHeader,
  InboxLoading,
  InboxWorkspace,
} from "@/components/inbox/inbox-workspace";

export const Route = createFileRoute("/_authenticated/inbox/email")({
  head: () => ({
    meta: [
      { title: "Email — Inbox TechERP" },
      {
        name: "description",
        content: "Conversas de email do workspace em uma central organizada.",
      },
      { property: "og:title", content: "Email — Inbox TechERP" },
      {
        property: "og:description",
        content: "Conversas de email do workspace em uma central organizada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmailInbox,
});

type EmailThreadRow = {
  id: string;
  subject: string | null;
  snippet: string | null;
  last_message_at: string | null;
  message_count: number;
  contact_id: string | null;
  lead_id: string | null;
  identity_status: string | null;
  account_id: string | null;
  assigned_to: string | null;
};

function EmailInbox() {
  const openActivityWindow = useActivityWindows();
  const openEmail = (to?: string, threadId?: string) => {
    const action = ACTIONS_BY_KEY["create:email"];
    if (action) openActivityWindow?.({ action, to, threadId });
  };
  const qc = useQueryClient();
  const { user } = useAuth();
  const getFn = useServerFn(getEmailThread);
  const syncFn = useServerFn(syncMyEmailAccounts);
  const membersFn = useServerFn(listWorkspaceMembers);
  const assignFn = useServerFn(assignEmailThread);

  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<"mine" | "unassigned" | "all">("all");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const {
    rows: threads,
    counts,
    total,
    query: threadsQ,
  } = useInboxChannelPage<EmailThreadRow>("email", filter, debouncedSearch);
  const threadQ = useQuery({
    queryKey: ["email_thread", selected],
    queryFn: () => getFn({ data: { thread_id: selected! } }),
    enabled: !!selected,
  });
  const membersQ = useQuery({ queryKey: ["inbox", "members"], queryFn: () => membersFn() });
  const assign = useMutation({
    mutationFn: (assignedTo: string | null) =>
      assignFn({ data: { conversationId: selected ?? "", assignedTo } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inbox-channel", "email"] });
      qc.invalidateQueries({ queryKey: ["email_thread", selected] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const current = threadQ.data;
  const memberNames = new Map(
    (membersQ.data ?? []).map((member) => [member.user_id, member.full_name]),
  );

  async function handleSync() {
    try {
      await syncFn({ data: {} });
      qc.invalidateQueries({ queryKey: ["inbox-channel", "email"] });
      if (selected) qc.invalidateQueries({ queryKey: ["email_thread", selected] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  const lastMsg = useMemo(() => {
    const msgs = current?.messages ?? [];
    return msgs[msgs.length - 1];
  }, [current?.messages]);

  return (
    <InboxWorkspace
      title="Inbox Email"
      description="Threads sincronizadas via Gmail. Sincronização automática a cada 1 min."
      actions={
        <>
          <Button variant="outline" onClick={handleSync}>
            <RefreshCw className="mr-2 h-4 w-4" /> Sincronizar
          </Button>
          <Button onClick={() => openEmail()}>
            <Mail className="mr-2 h-4 w-4" /> Novo email
          </Button>
        </>
      }
      list={
        <>
          <InboxListHeader>
            <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="mine">
                  Minhas{counts ? ` (${compactCount(counts.mine)})` : ""}
                </TabsTrigger>
                <TabsTrigger value="unassigned" title="Sem responsável">
                  Sem dono{counts ? ` (${compactCount(counts.unassigned)})` : ""}
                </TabsTrigger>
                <TabsTrigger value="all">
                  Todas{counts ? ` (${compactCount(counts.all)})` : ""}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <InboxListSearch
              value={search}
              onChange={setSearch}
              placeholder="Buscar assunto, trecho ou contato…"
            />
          </InboxListHeader>
          <InboxConversationList>
            {threadsQ.isError && threads.length === 0 ? (
              <InboxError onRetry={() => threadsQ.refetch()} />
            ) : threadsQ.isPending ? (
              <InboxLoading />
            ) : threads.length === 0 && debouncedSearch.trim() ? (
              <InboxEmpty>Nenhuma conversa encontrada.</InboxEmpty>
            ) : threads.length === 0 ? (
              <InboxEmpty>
                <div className="space-y-2">
                  Nenhuma thread ainda. Conecte uma conta Gmail em{" "}
                  <Link to="/settings/email" className="underline">
                    Configurações
                  </Link>{" "}
                  e clique em <b>Sincronizar</b>.
                </div>
              </InboxEmpty>
            ) : null}
            <div className="space-y-1 px-2 pb-3">
              {threads.map((t) => (
                <InboxConversationItem
                  key={t.id}
                  label={t.subject || "(sem assunto)"}
                  preview={t.snippet || "—"}
                  when={t.last_message_at}
                  whenTitle={t.last_message_at ? formatDateTime(t.last_message_at) : undefined}
                  selected={selected === t.id}
                  onClick={() => setSelected(t.id)}
                  badge={
                    t.message_count > 1 ? (
                      <Badge variant="outline" className="text-[10px]">
                        {t.message_count}
                      </Badge>
                    ) : null
                  }
                  meta={
                    t.assigned_to ? (
                      <span className="inline-flex items-center gap-1">
                        <UserCheck className="h-3 w-3" />
                        {memberNames.get(t.assigned_to) ?? "atribuída"}
                      </span>
                    ) : (
                      <span className="italic">sem responsável</span>
                    )
                  }
                />
              ))}
              {threads.length > 0 ? (
                <InboxListFooter
                  loaded={threads.length}
                  total={total}
                  hasMore={!!threadsQ.hasNextPage}
                  loadingMore={threadsQ.isFetchingNextPage}
                  error={threadsQ.isError}
                  onLoadMore={() => void threadsQ.fetchNextPage()}
                  onRetry={() => void threadsQ.refetch()}
                />
              ) : null}
            </div>
          </InboxConversationList>
        </>
      }
      conversation={
        <>
          {!current ? (
            <InboxEmpty>Selecione uma conversa de email para visualizar o histórico.</InboxEmpty>
          ) : threadQ.isError ? (
            <InboxError onRetry={() => threadQ.refetch()}>
              Não foi possível carregar esta conversa.
            </InboxError>
          ) : (
            <>
              <InboxConversationHeader
                label={
                  lastMsg?.from_name ||
                  lastMsg?.from_email ||
                  current.thread.subject ||
                  "Contato por email"
                }
                subtitle={`Email · ${current.thread.subject || "(sem assunto)"} · ${current.messages.length} mensagem(ns)`}
                actions={
                  <>
                    <Select
                      value={current.thread.assigned_to ?? "_none"}
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEmail(lastMsg?.from_email ?? "", current.thread.id)}
                    >
                      <Reply className="mr-2 h-4 w-4" /> Responder
                    </Button>
                  </>
                }
              />
              <ScrollArea className="flex-1 bg-product-panel-muted px-5 py-6" aria-live="polite">
                <div className="space-y-5">
                  {current.messages.map((m) => (
                    <MessageCard key={m.id} message={m} />
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </>
      }
      context={
        current ? (
          <InboxContext
            initials={(lastMsg?.from_name || lastMsg?.from_email || "E").slice(0, 2).toUpperCase()}
            title={lastMsg?.from_name || lastMsg?.from_email || "Contato por email"}
            subtitle={lastMsg?.from_email || undefined}
          >
            <div className="space-y-3 border-t border-border pt-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Assunto</p>
                <p className="mt-1 font-medium">{current.thread.subject || "(sem assunto)"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mensagens</p>
                <p className="mt-1 font-medium">{current.messages.length}</p>
              </div>
              <InboxIdentityLinker
                channel="email"
                conversationId={current.thread.id}
                contactId={current.thread.contact_id}
                leadId={current.thread.lead_id}
                status={current.thread.identity_status}
                onLinked={() => {
                  qc.invalidateQueries({ queryKey: ["inbox-channel", "email"] });
                  qc.invalidateQueries({ queryKey: ["email_thread", current.thread.id] });
                }}
              />
            </div>
          </InboxContext>
        ) : undefined
      }
    />
  );
}

type Msg = NonNullable<
  ReturnType<typeof getEmailThread> extends Promise<infer T> ? T : never
>["messages"][number];

function MessageCard({ message: m }: { message: Msg }) {
  const isOut = m.direction === "outbound";
  const html =
    m.body_html && typeof window !== "undefined"
      ? DOMPurify.sanitize(m.body_html, { USE_PROFILES: { html: true } })
      : null;
  return (
    <InboxMessageBubble
      outbound={isOut}
      when={(m.sent_at ?? m.received_at ?? m.created_at) as string}
      status={isOut ? ((m.open_count ?? 0) > 0 ? "read" : "sent") : null}
      author={
        <>
          {m.from_name || m.from_email || "—"}
          <span className="font-normal text-muted-foreground">
            {" "}
            → {(m.to_emails ?? []).join(", ")}
          </span>
        </>
      }
      footer={
        <>
          {isOut && (m.open_count ?? 0) > 0 && (
            <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]" title="Aberturas">
              <Eye className="h-3 w-3" /> {m.open_count}
            </Badge>
          )}
          {isOut && (m.click_count ?? 0) > 0 && (
            <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]" title="Cliques">
              <MousePointerClick className="h-3 w-3" /> {m.click_count}
            </Badge>
          )}
          {m.has_attachments && <Paperclip className="h-3 w-3" aria-label="Com anexo" />}
        </>
      }
    >
      {html ? (
        <div
          className="prose prose-sm max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="whitespace-pre-wrap font-sans text-sm">
          {m.body_text || m.snippet || ""}
        </pre>
      )}
    </InboxMessageBubble>
  );
}
