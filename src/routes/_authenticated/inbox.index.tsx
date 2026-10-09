import { formatDateTime } from "@/lib/crm";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useInboxUnifiedPage } from "@/hooks/use-inbox-unified-page";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Mail,
  MessageCircle,
  Search,
  Send,
  ExternalLink,
  Sparkles,
  MessagesSquare,
} from "lucide-react";
import { sendGmailEmail } from "@/lib/email-send.functions";
import { sendWhatsAppMessage } from "@/lib/whatsapp.functions";
import { SendWhatsAppDialog } from "@/components/whatsapp/send-whatsapp-dialog";
import { smartCompose } from "@/lib/ai-compose.functions";
import { sendChatMessage } from "@/lib/live-chat.functions";
import { toast } from "sonner";
import { useMessageDraft } from "@/hooks/use-message-draft";
import { MessageDraftStatus } from "@/components/message-draft-status";
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
import { WhatsAppIcon } from "@/components/whatsapp/whatsapp-icon";

export const Route = createFileRoute("/_authenticated/inbox/")({
  head: () => ({
    meta: [
      { title: "Inbox unificada — TechERP" },
      {
        name: "description",
        content: "Email, WhatsApp e atendimento do workspace em uma única central.",
      },
      { property: "og:title", content: "Inbox unificada — TechERP" },
      {
        property: "og:description",
        content: "Email, WhatsApp e atendimento do workspace em uma única central.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UnifiedInboxPage,
});

type Item = {
  id: string;
  channel: "email" | "whatsapp" | "chat";
  conversationId: string;
  title: string;
  snippet: string;
  contactLabel: string;
  lastAt: string | null;
  href: string;
  replyTo: string | null; // email address or phone
  contactId: string | null;
  leadId: string | null;
  subject: string;
};

function UnifiedInboxPage() {
  const [channel, setChannel] = useState<"all" | "email" | "whatsapp" | "chat">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const sendEmail = useServerFn(sendGmailEmail);
  const sendWa = useServerFn(sendWhatsAppMessage);
  const sendChat = useServerFn(sendChatMessage);
  const compose = useServerFn(smartCompose);

  const debouncedSearch = useDebounced(search, 300);
  const { rows, counts, total, query: pageQ } = useInboxUnifiedPage(channel, debouncedSearch);

  const items: Item[] = useMemo(
    () =>
      rows.map((r) => {
        const person = r.contact_name ?? r.lead_name ?? null;
        if (r.channel === "email")
          return {
            id: `email:${r.id}`,
            conversationId: r.id,
            channel: "email" as const,
            title: r.title || "(sem assunto)",
            snippet: r.snippet ?? "",
            contactLabel: person ?? r.last_inbound_from ?? "Remetente desconhecido",
            lastAt: r.last_message_at,
            href: "/inbox/email",
            replyTo: r.last_inbound_from,
            contactId: r.contact_id,
            leadId: r.lead_id,
            subject: r.title ?? "",
          };
        if (r.channel === "whatsapp")
          return {
            id: `wa:${r.id}`,
            conversationId: r.id,
            channel: "whatsapp" as const,
            title: person ?? r.phone ?? "",
            snippet: r.snippet ?? "",
            contactLabel: person ?? r.phone ?? "",
            lastAt: r.last_message_at,
            href: "/inbox/whatsapp",
            replyTo: r.phone,
            contactId: r.contact_id,
            leadId: r.lead_id,
            subject: "",
          };
        return {
          id: `chat:${r.id}`,
          conversationId: r.id,
          channel: "chat" as const,
          title: r.title || "Visitante anônimo",
          snippet: r.visitor_email || "Chat ao vivo",
          contactLabel: person ?? r.title ?? "Visitante anônimo",
          lastAt: r.last_message_at,
          href: "/inbox/chat",
          replyTo: r.visitor_email,
          contactId: r.contact_id,
          leadId: r.lead_id,
          subject: "Chat ao vivo",
        };
      }),
    [rows],
  );

  const [selectedSnapshot, setSelectedSnapshot] = useState<Item | null>(null);
  // Se a conversa aberta sair das páginas carregadas após uma recarga, ela continua aberta.
  const current =
    items.find((i) => i.id === selected) ??
    (selectedSnapshot?.id === selected ? selectedSnapshot : null);

  // Rascunho automático da resposta inline, por conversa selecionada.
  const messageDraft = useMessageDraft({
    scope:
      current?.channel === "whatsapp"
        ? {
            channel: "whatsapp",
            conversationId: current.id,
            contactId: current.contactId,
            to: current.replyTo,
          }
        : current?.channel === "email"
          ? {
              channel: "email",
              threadId: current?.id ?? null,
              contactId: current?.contactId ?? null,
              to: current?.replyTo ?? null,
            }
          : {
              channel: "chat",
              conversationId: current?.conversationId ?? null,
              contactId: current?.contactId ?? null,
              to: current?.replyTo ?? null,
            },
    enabled: !!current,
    value: { body_text: draft, subject: current?.subject ?? "" },
    onRestore: (d) => setDraft(d.body_text),
  });

  const reply = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("Selecione um item.");
      if (current.channel === "email") {
        if (!current.replyTo)
          throw new Error("Não foi possível identificar o destinatário do e-mail.");
        const subject = current.subject?.toLowerCase().startsWith("re:")
          ? current.subject
          : `Re: ${current.subject || "(sem assunto)"}`;
        await sendEmail({
          data: {
            to: current.replyTo,
            subject,
            body_text: draft,
            contact_id: current.contactId ?? undefined,
          } as never,
        });
      } else if (current.channel === "whatsapp") {
        if (!current.replyTo) throw new Error("Não foi possível identificar o número do cliente.");
        const res = await sendWa({
          data: {
            to: current.replyTo,
            body: draft,
            contactId: current.contactId ?? undefined,
          } as never,
        });
        if (!res.ok) {
          if (res.code === "TEMPLATE_REQUIRED") setTemplateDialogOpen(true);
          throw new Error(res.error);
        }
      } else {
        await sendChat({ data: { session_id: current.conversationId, body: draft } });
      }
    },
    onSuccess: () => {
      setDraft("");
      messageDraft.clearAfterSend();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const aiSuggest = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("Selecione uma conversa.");
      const baseText = `${current.title}\n\n${current.snippet}`.trim();
      const res = (await compose({
        data: {
          channel: current.channel,
          mode: "reply",
          input_text: baseText,
          contact_name: current.contactLabel,
          language: "pt-BR",
        } as never,
      })) as { text: string };
      setDraft((prev) => (prev ? `${prev}\n\n${res.text}` : res.text));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <InboxWorkspace
      title="Inbox unificada"
      description="Conversas de Email, WhatsApp e Chat ao vivo em um só lugar."
      list={
        <>
          <InboxListHeader>
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por contato, assunto ou texto…"
                className="pl-8"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              <Button
                size="sm"
                variant={channel === "all" ? "default" : "outline"}
                onClick={() => setChannel("all")}
              >
                Todos{counts ? ` (${counts.email + counts.whatsapp + counts.chat})` : ""}
              </Button>
              <Button
                size="sm"
                variant={channel === "email" ? "default" : "outline"}
                onClick={() => setChannel("email")}
              >
                <Mail className="h-4 w-4 mr-1" /> E-mail{counts ? ` (${counts.email})` : ""}
              </Button>
              <Button
                size="sm"
                variant={channel === "whatsapp" ? "default" : "outline"}
                onClick={() => setChannel("whatsapp")}
              >
                <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                {counts ? ` (${counts.whatsapp})` : ""}
              </Button>
              <Button
                size="sm"
                variant={channel === "chat" ? "default" : "outline"}
                onClick={() => setChannel("chat")}
              >
                <MessagesSquare className="mr-1 h-4 w-4" /> Chat{counts ? ` (${counts.chat})` : ""}
              </Button>
            </div>
          </InboxListHeader>
          <InboxConversationList>
            {pageQ.isError && items.length === 0 ? (
              <InboxError onRetry={() => void pageQ.refetch()} />
            ) : pageQ.isPending ? (
              <InboxLoading />
            ) : items.length === 0 ? (
              <InboxEmpty>Nenhuma conversa encontrada.</InboxEmpty>
            ) : (
              <ul className="space-y-1 px-2 pb-3">
                {items.map((it) => (
                  <li key={it.id}>
                    <InboxConversationItem
                      label={it.contactLabel}
                      title={it.title}
                      preview={it.snippet && it.snippet !== it.title ? it.snippet : undefined}
                      when={it.lastAt}
                      whenTitle={it.lastAt ? formatDateTime(it.lastAt) : undefined}
                      selected={selected === it.id}
                      onClick={() => {
                        setSelected(it.id);
                        setSelectedSnapshot(it);
                        setDraft("");
                      }}
                      channelIcon={
                        it.channel === "email" ? (
                          <Mail className="h-3 w-3 text-primary" />
                        ) : it.channel === "chat" ? (
                          <MessagesSquare className="h-3 w-3 text-primary" />
                        ) : (
                          <WhatsAppIcon className="h-3 w-3 text-success" />
                        )
                      }
                    />
                  </li>
                ))}
                <li className="px-1 pt-2" aria-live="polite">
                  {pageQ.isError ? (
                    <div className="flex items-center justify-between gap-2 rounded-md border border-destructive/40 px-3 py-2 text-xs text-destructive">
                      <span>Não foi possível atualizar todas as conversas.</span>
                      <Button size="sm" variant="outline" onClick={() => void pageQ.refetch()}>
                        Tentar de novo
                      </Button>
                    </div>
                  ) : pageQ.hasNextPage ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={pageQ.isFetchingNextPage}
                      onClick={() => void pageQ.fetchNextPage()}
                    >
                      {pageQ.isFetchingNextPage
                        ? "Carregando…"
                        : `Carregar mais (${items.length} de ${total ?? items.length})`}
                    </Button>
                  ) : total != null ? (
                    <p className="text-center text-xs text-muted-foreground">
                      {total} conversa{total === 1 ? "" : "s"}
                    </p>
                  ) : null}
                </li>
              </ul>
            )}
          </InboxConversationList>
        </>
      }
      conversation={
        <div className="flex min-h-0 flex-1 flex-col">
          {!current ? (
            <InboxEmpty>Selecione uma conversa para responder inline.</InboxEmpty>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <InboxConversationHeader
                label={current.contactLabel}
                subtitle={`${current.channel === "email" ? "Email" : current.channel === "whatsapp" ? "WhatsApp" : "Chat ao vivo"}${current.replyTo ? ` · ${current.replyTo}` : ""}`}
                actions={
                  <Button asChild size="sm" variant="outline">
                    <Link to={current.href}>
                      Abrir no canal <ExternalLink className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                }
              />
              <div className="min-h-0 flex-1 overflow-y-auto bg-product-panel-muted px-6 py-8">
                <InboxMessageBubble outbound={false} when={current.lastAt}>
                  <p className="text-sm font-medium text-foreground">{current.title}</p>
                  {current.snippet && current.snippet !== current.title ? (
                    <p className="mt-1 text-sm text-text-secondary">{current.snippet}</p>
                  ) : null}
                </InboxMessageBubble>
              </div>
              <div className="m-4 space-y-2 rounded-[calc(var(--radius)+1rem)] bg-product-panel-muted p-2 ring-1 ring-border-subtle focus-within:ring-2 focus-within:ring-ring">
                {current.channel === "whatsapp" && (
                  <SendWhatsAppDialog
                    open={templateDialogOpen}
                    onOpenChange={setTemplateDialogOpen}
                    defaultTo={current.replyTo ?? ""}
                    contactId={current.contactId ?? undefined}
                    contactName={current.contactLabel}
                    draftIndicator={false}
                    onSent={() => {
                      setDraft("");
                      messageDraft.clearAfterSend();
                    }}
                  />
                )}
                <Textarea
                  className="min-h-24 resize-none border-0 shadow-none focus-visible:ring-0"
                  rows={6}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={
                    current.channel === "email"
                      ? "Escreva sua resposta…"
                      : current.channel === "whatsapp"
                        ? "Mensagem do WhatsApp…"
                        : "Responder no chat…"
                  }
                />
                <div className="flex items-center justify-between gap-2">
                  <MessageDraftStatus status={messageDraft.status} savedAt={messageDraft.savedAt} />
                  {messageDraft.status !== "idle" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await messageDraft.discard();
                        setDraft("");
                      }}
                    >
                      Descartar rascunho
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-1">
                    <Button asChild size="sm" variant="ghost">
                      <Link to={current.href}>
                        Abrir <ExternalLink className="h-3.5 w-3.5 ml-1" />
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => aiSuggest.mutate()}
                      disabled={aiSuggest.isPending}
                      title="Gerar rascunho com IA"
                    >
                      <Sparkles className="h-3.5 w-3.5 mr-1" />
                      {aiSuggest.isPending ? "Gerando…" : "IA"}
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => reply.mutate()}
                    disabled={
                      !draft.trim() ||
                      reply.isPending ||
                      (current.channel === "email" && !current.replyTo)
                    }
                  >
                    <Send className="h-4 w-4 mr-1" />
                    {reply.isPending ? "Enviando…" : "Enviar"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      }
      context={
        current ? (
          <InboxContext
            initials={current.contactLabel.slice(0, 2).toUpperCase()}
            title={current.contactLabel}
            subtitle={current.replyTo || undefined}
          >
            <div className="space-y-3 border-t border-border pt-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Canal</p>
                <p className="mt-1 font-medium capitalize">{current.channel}</p>
              </div>
              <Button asChild className="w-full" variant="outline">
                <Link to={current.href}>
                  Abrir conversa <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </InboxContext>
        ) : undefined
      }
    />
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
