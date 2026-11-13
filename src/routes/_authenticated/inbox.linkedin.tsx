import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { readViewAs } from "@/lib/view-as-client";
import {
  listLinkedinConversations,
  getLinkedinConversation,
  sendLinkedinInboxMessage,
  editLinkedinConversation,
} from "@/lib/unipile/inbox.functions";
import { listConversationMessages } from "@/lib/inbox/message-history.functions";
import { useMessageHistory } from "@/hooks/use-message-history";
import { MessageHistoryViewport } from "@/components/inbox/message-history-viewport";
import {
  InboxWorkspace,
  InboxEmpty,
  InboxError,
  InboxLoading,
  InboxMessageBubble,
} from "@/components/inbox/inbox-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { ServiceAgentPanel } from "@/components/inbox/service-agent-panel";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { toast } from "sonner";
export const Route = createFileRoute("/_authenticated/inbox/linkedin")({
  validateSearch: (s: Record<string, unknown>) => ({
    conversation: z.string().uuid().optional().catch(undefined).parse(s.conversation),
  }),
  component: LinkedinInbox,
});
type Message = { id: string; created_at: string; direction: string; body: string };
function LinkedinInbox() {
  const { user } = useAuth(),
    p = usePermissions(),
    qc = useQueryClient(),
    navigate = Route.useNavigate(),
    search = Route.useSearch();
  const list = useServerFn(listLinkedinConversations),
    get = useServerFn(getLinkedinConversation),
    messages = useServerFn(listConversationMessages),
    send = useServerFn(sendLinkedinInboxMessage),
    edit = useServerFn(editLinkedinConversation);
  const [filter, setFilter] = useState(""),
    term = useDebouncedValue(filter, 300),
    [draft, setDraft] = useState("");
  const attempt = useRef<{ conversation: string; text: string; id: string } | null>(null);
  const canView =
    !p.isLoading &&
    !p.isError &&
    !!user &&
    p.can("techsales.inbox.linkedin.view.own") &&
    (p.can("system.linkedin.view.own") || p.can("system.linkedin.view.workspace"));
  const writable =
    canView &&
    !readViewAs()?.readOnly &&
    (p.can("system.linkedin.manage.own") || p.can("system.linkedin.manage.workspace"));
  const key = ["linkedin-inbox", user?.id, p.workspaceId];
  const rows = useInfiniteQuery({
    queryKey: [...key, term],
    initialPageParam: undefined as { at: string; id: string } | undefined,
    enabled: canView,
    queryFn: ({ pageParam }) => list({ data: { search: term, before: pageParam, limit: 50 } }),
    getNextPageParam: (page) =>
      page.hasMore && page.items.length
        ? {
            at: page.items[page.items.length - 1].last_message_at,
            id: page.items[page.items.length - 1].id,
          }
        : undefined,
    refetchInterval: 30000,
  });
  const selected = search.conversation ?? null;
  const current = useQuery({
    queryKey: [...key, "conversation", selected],
    queryFn: () => get({ data: { id: selected! } }),
    enabled: canView && !!selected,
    refetchInterval: 30000,
  });
  const history = useMessageHistory<Message>({
    contextKey: canView && selected ? `${user!.id}:${p.workspaceId}:linkedin:${selected}` : null,
    fetchPage: async ({ before, after, limit }) =>
      messages({
        data: { channel: "linkedin", conversation_id: selected!, before, after, limit },
      }) as Promise<{ items: Message[]; hasMore: boolean }>,
    realtime: selected
      ? { table: "linkedin_messages", filter: `conversation_id=eq.${selected}`, kind: "rows" }
      : null,
  });
  const sending = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Selecione uma conversa.");
      if (
        !attempt.current ||
        attempt.current.conversation !== selected ||
        attempt.current.text !== draft
      )
        attempt.current = { conversation: selected, text: draft, id: crypto.randomUUID() };
      return send({
        data: { conversationId: selected, text: draft, requestId: attempt.current.id },
      });
    },
    onSuccess: () => {
      setDraft("");
      attempt.current = null;
      void history.reconcile();
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const closing = useMutation({
    mutationFn: () =>
      edit({
        data: { id: selected!, status: current.data?.status === "closed" ? "open" : "closed" },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.error(e.message),
  });
  const [entityType, setEntityType] = useState<"contact" | "lead" | "company" | "deal">("contact"),
    [entityId, setEntityId] = useState("");
  const linking = useMutation({
    mutationFn: () =>
      edit({ data: { id: selected!, entityType, entityId: z.string().uuid().parse(entityId) } }),
    onSuccess: () => {
      setEntityId("");
      void qc.invalidateQueries({ queryKey: key });
      toast.success("Vínculo atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (p.isLoading) return <InboxLoading />;
  if (!canView) return <InboxError>Sem permissão para a Inbox LinkedIn pessoal.</InboxError>;
  const items = rows.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <InboxWorkspace
      title="Inbox LinkedIn"
      description="Conversas da sua conta pessoal no workspace ativo"
      actions={
        <Button variant="outline" asChild>
          <Link to="/settings/integrations/linkedin">Conectar conta</Link>
        </Button>
      }
      list={
        <>
          <div className="p-3">
            <Input
              aria-label="Buscar conversa LinkedIn"
              placeholder="Buscar conversa"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {rows.isError ? (
              <InboxError onRetry={() => void rows.refetch()} />
            ) : rows.isPending ? (
              <InboxLoading />
            ) : !items.length ? (
              <InboxEmpty>Nenhuma conversa recebida nesta conta.</InboxEmpty>
            ) : (
              items.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`block w-full border-b p-3 text-left ${selected === c.id ? "bg-accent" : "hover:bg-muted"}`}
                  onClick={() => {
                    setDraft("");
                    attempt.current = null;
                    void navigate({ search: { conversation: c.id } });
                  }}
                >
                  <strong className="block truncate text-sm">{c.title}</strong>
                  <span className="block truncate text-xs text-muted-foreground">{c.snippet}</span>
                </button>
              ))
            )}
            {rows.hasNextPage ? (
              <Button
                variant="ghost"
                disabled={rows.isFetchingNextPage}
                onClick={() => void rows.fetchNextPage()}
              >
                Carregar mais
              </Button>
            ) : null}
          </div>
        </>
      }
      conversation={
        !selected ? (
          <InboxEmpty>Selecione uma conversa LinkedIn.</InboxEmpty>
        ) : current.isError ? (
          <InboxError onRetry={() => void current.refetch()} />
        ) : (
          <>
            <header className="flex shrink-0 items-center justify-between border-b p-3">
              <strong>{current.data?.title ?? "Carregando…"}</strong>
              <Button
                variant="outline"
                disabled={
                  !writable ||
                  !p.can("techsales.inbox.linkedin.manage.own") ||
                  closing.isPending ||
                  !current.data
                }
                onClick={() => closing.mutate()}
              >
                {current.data?.status === "closed" ? "Reabrir" : "Fechar"}
              </Button>
            </header>
            <MessageHistoryViewport
              resetKey={history.key}
              count={history.items.length}
              firstId={history.items[0]?.id ?? null}
              lastId={history.items.at(-1)?.id ?? null}
              hasOlder={history.hasOlder}
              olderLoading={history.olderLoading}
              olderError={history.olderError}
              syncError={history.syncError}
              degraded={history.health === "degraded"}
              onLoadOlder={() => void history.loadOlder()}
              onRetrySync={() => void history.reconcile()}
              className="bg-product-panel-muted p-4"
            >
              {history.initial === "error" ? (
                <InboxError onRetry={history.retryInitial} />
              ) : history.initial === "loading" ? (
                <InboxLoading />
              ) : (
                history.items.map((m) => (
                  <InboxMessageBubble
                    key={m.id}
                    outbound={m.direction === "outbound"}
                    when={m.created_at}
                    status={m.direction === "outbound" ? "sent" : null}
                  >
                    <div className="whitespace-pre-wrap">{m.body}</div>
                  </InboxMessageBubble>
                ))
              )}
            </MessageHistoryViewport>
            <form
              className="flex shrink-0 gap-2 border-t bg-product-panel p-3"
              onSubmit={(e) => {
                e.preventDefault();
                sending.mutate();
              }}
            >
              <Textarea
                aria-label="Mensagem LinkedIn"
                placeholder={
                  current.data?.status === "closed"
                    ? "Reabra a conversa para responder"
                    : "Escreva sua mensagem"
                }
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={
                  !writable ||
                  !p.can("techsales.inbox.linkedin.create.own") ||
                  current.data?.status !== "open" ||
                  sending.isPending
                }
              />
              <Button
                type="submit"
                disabled={
                  !draft.trim() ||
                  !writable ||
                  !p.can("techsales.inbox.linkedin.create.own") ||
                  current.data?.status !== "open" ||
                  sending.isPending
                }
              >
                Enviar
              </Button>
            </form>
          </>
        )
      }
      context={
        selected ? (
          <div className="space-y-4 p-4 text-sm">
            <ServiceAgentPanel channel="linkedin" sourceId={selected} />
            <strong>Registros associados</strong>
            {(["contact", "lead", "company", "deal"] as const).map((t) =>
              current.data?.[`${t}_id`] ? (
                <p key={t}>
                  {t}:{" "}
                  <Link
                    to={
                      (
                        {
                          contact: "/contacts/$id",
                          lead: "/leads/$id",
                          company: "/companies/$id",
                          deal: "/deals/$id",
                        } as const
                      )[t]
                    }
                    params={{ id: current.data[`${t}_id`]! }}
                  >
                    {current.data[`${t}_id`]}
                  </Link>
                </p>
              ) : null,
            )}
            <label className="block">
              Vincular a
              <select
                className="mt-1 w-full rounded border bg-background p-2"
                value={entityType}
                onChange={(e) => setEntityType(e.target.value as typeof entityType)}
              >
                <option value="contact">Contato</option>
                <option value="lead">Lead</option>
                <option value="company">Empresa</option>
                <option value="deal">Negócio</option>
              </select>
            </label>
            <EntityCombobox
              key={entityType}
              entity={entityType === "company" ? "companies" : entityType + "s"}
              select={
                entityType === "contact" || entityType === "lead"
                  ? "id,first_name,last_name,email"
                  : "id,name"
              }
              searchColumn={
                entityType === "contact" || entityType === "lead" ? "first_name" : "name"
              }
              filters={{ workspace_id: p.workspaceId }}
              labelFrom={(r) =>
                entityType === "contact" || entityType === "lead"
                  ? [r.first_name, r.last_name].filter(Boolean).join(" ") ||
                    String(r.email ?? "Sem nome")
                  : String(r.name ?? "Sem nome")
              }
              value={entityId || null}
              onChange={(id) => setEntityId(id ?? "")}
              disabled={!writable || !p.can("techsales.inbox.linkedin.manage.own")}
              placeholder="Buscar registro…"
            />
            <Button
              disabled={
                !entityId ||
                !writable ||
                !p.can("techsales.inbox.linkedin.manage.own") ||
                linking.isPending
              }
              onClick={() => linking.mutate()}
            >
              Associar registro
            </Button>
          </div>
        ) : undefined
      }
    />
  );
}
