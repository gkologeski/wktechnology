import { formatDateTime } from "@/lib/crm";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mail, MessageCircle, Search, Send, ExternalLink, Sparkles } from "lucide-react";
import { sendGmailEmail } from "@/lib/email-send.functions";
import { sendWhatsAppMessage } from "@/lib/whatsapp.functions";
import { smartCompose } from "@/lib/ai-compose.functions";
import { toast } from "sonner";
import { useMessageDraft } from "@/hooks/use-message-draft";
import { MessageDraftStatus } from "@/components/message-draft-status";
import {
  InboxAvatar,
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
  channel: "email" | "whatsapp";
  title: string;
  snippet: string;
  contactLabel: string;
  lastAt: string | null;
  href: string;
  replyTo: string | null; // email address or phone
  contactId: string | null;
  subject: string;
};

function UnifiedInboxPage() {
  const [channel, setChannel] = useState<"all" | "email" | "whatsapp">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const sendEmail = useServerFn(sendGmailEmail);
  const sendWa = useServerFn(sendWhatsAppMessage);
  const compose = useServerFn(smartCompose);

  const emailQ = useQuery({
    queryKey: ["inbox-unified", "email"],
    queryFn: async () => {
      const { data } = await supabase
        .from("email_threads")
        .select("id, subject, snippet, last_message_at, contact_id")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(150);
      return data ?? [];
    },
  });
  const waQ = useQuery({
    queryKey: ["inbox-unified", "whatsapp"],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_conversations")
        .select("id, contact_phone, last_message_preview, last_message_at, contact_id, status")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(150);
      return data ?? [];
    },
  });

  // For email: load last inbound email per thread to know from_email
  const emailThreadIds = (emailQ.data ?? []).map((t) => t.id);
  const lastEmailQ = useQuery({
    queryKey: ["inbox-unified", "email-last", emailThreadIds.join(",")],
    enabled: emailThreadIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("email_messages")
        .select("thread_id, from_email, subject, direction")
        .in("thread_id", emailThreadIds)
        .order("created_at", { ascending: false });
      const map = new Map<string, { from_email: string | null; subject: string | null }>();
      for (const m of data ?? []) {
        if (!m.thread_id) continue;
        if (!map.has(m.thread_id) && m.direction === "inbound") {
          map.set(m.thread_id, { from_email: m.from_email ?? null, subject: m.subject ?? null });
        }
      }
      return map;
    },
  });

  const contactIds = useMemo(() => {
    const s = new Set<string>();
    (emailQ.data ?? []).forEach((t) => t.contact_id && s.add(t.contact_id));
    (waQ.data ?? []).forEach((t) => t.contact_id && s.add(t.contact_id));
    return Array.from(s);
  }, [emailQ.data, waQ.data]);

  const contactsQ = useQuery({
    queryKey: ["inbox-unified", "contacts", contactIds.sort().join(",")],
    enabled: contactIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email")
        .in("id", contactIds);
      const m = new Map<string, string>();
      (data ?? []).forEach((c) =>
        m.set(
          c.id,
          [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ||
            c.email ||
            c.id.slice(0, 8),
        ),
      );
      return m;
    },
  });

  const items: Item[] = useMemo(() => {
    const m = contactsQ.data ?? new Map<string, string>();
    const lastMap = lastEmailQ.data ?? new Map();
    const a: Item[] = (emailQ.data ?? []).map((t) => {
      const last = lastMap.get(t.id);
      return {
        id: `email:${t.id}`,
        channel: "email" as const,
        title: t.subject || "(sem assunto)",
        snippet: t.snippet ?? "",
        contactLabel:
          (t.contact_id ? m.get(t.contact_id) : undefined) ??
          last?.from_email ??
          "Remetente desconhecido",
        lastAt: t.last_message_at,
        href: `/inbox/email`,
        replyTo: last?.from_email ?? null,
        contactId: t.contact_id ?? null,
        subject: t.subject ?? "",
      };
    });
    const b: Item[] = (waQ.data ?? []).map((c) => ({
      id: `wa:${c.id}`,
      channel: "whatsapp" as const,
      title: c.contact_id ? (m.get(c.contact_id) ?? c.contact_phone) : c.contact_phone,
      snippet: c.last_message_preview ?? "",
      contactLabel: c.contact_id ? (m.get(c.contact_id) ?? c.contact_phone) : c.contact_phone,
      lastAt: c.last_message_at,
      href: `/inbox/whatsapp`,
      replyTo: c.contact_phone,
      contactId: c.contact_id ?? null,
      subject: "",
    }));
    let merged = [...a, ...b];
    if (channel !== "all") merged = merged.filter((i) => i.channel === channel);
    if (search.trim()) {
      const q = search.toLowerCase();
      merged = merged.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.snippet.toLowerCase().includes(q) ||
          i.contactLabel.toLowerCase().includes(q),
      );
    }
    merged.sort((x, y) => new Date(y.lastAt ?? 0).getTime() - new Date(x.lastAt ?? 0).getTime());
    return merged;
  }, [emailQ.data, waQ.data, contactsQ.data, lastEmailQ.data, channel, search]);

  const current = items.find((i) => i.id === selected) ?? null;

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
        : {
            channel: "email",
            threadId: current?.id ?? null,
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
      } else {
        const res = await sendWa({
          data: {
            to: current.replyTo!,
            body: draft,
            contactId: current.contactId ?? undefined,
          } as never,
        });
        if (!res.ok) throw new Error(res.error);
      }
    },
    onSuccess: () => {
      toast.success("Enviado!");
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
      description="Conversas de email e WhatsApp em um só lugar. Responda inline."
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
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={channel === "all" ? "default" : "outline"}
                onClick={() => setChannel("all")}
              >
                Todos
              </Button>
              <Button
                size="sm"
                variant={channel === "email" ? "default" : "outline"}
                onClick={() => setChannel("email")}
              >
                <Mail className="h-4 w-4 mr-1" /> E-mail
              </Button>
              <Button
                size="sm"
                variant={channel === "whatsapp" ? "default" : "outline"}
                onClick={() => setChannel("whatsapp")}
              >
                <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
              </Button>
            </div>
          </InboxListHeader>
          <InboxConversationList>
            {emailQ.isError || waQ.isError || lastEmailQ.isError || contactsQ.isError ? (
              <InboxError
                onRetry={() => {
                  emailQ.refetch();
                  waQ.refetch();
                  lastEmailQ.refetch();
                  contactsQ.refetch();
                }}
              />
            ) : emailQ.isLoading || waQ.isLoading ? (
              <InboxLoading />
            ) : items.length === 0 ? (
              <InboxEmpty>Nenhuma conversa encontrada.</InboxEmpty>
            ) : (
              <ul className="space-y-0.5 p-2">
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
                        setDraft("");
                      }}
                      channelIcon={
                        it.channel === "email" ? (
                          <Mail className="h-3 w-3 text-primary" />
                        ) : (
                          <WhatsAppIcon className="h-3 w-3 text-success" />
                        )
                      }
                    />
                  </li>
                ))}
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
                subtitle={`${current.channel === "email" ? "Email" : "WhatsApp"}${current.replyTo ? ` · ${current.replyTo}` : ""}`}
                actions={
                  <Button asChild size="sm" variant="outline">
                    <Link to={current.href}>
                      Abrir no canal <ExternalLink className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                }
              />
              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <InboxMessageBubble outbound={false} when={current.lastAt}>
                  <p className="text-sm font-medium text-foreground">{current.title}</p>
                  {current.snippet && current.snippet !== current.title ? (
                    <p className="mt-1 text-sm text-text-secondary">{current.snippet}</p>
                  ) : null}
                </InboxMessageBubble>
              </div>
              <div className="m-3 space-y-2 rounded-[var(--radius)] border border-border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring">
                <Textarea
                  className="min-h-24 resize-none border-0 shadow-none focus-visible:ring-0"
                  rows={6}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={
                    current.channel === "email" ? "Escreva sua resposta…" : "Mensagem do WhatsApp…"
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
