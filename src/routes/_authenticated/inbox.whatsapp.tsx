import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  MessageCircle,
  Phone,
  Settings as SettingsIcon,
  UserCheck,
  CheckCircle2,
  Paperclip,
  X,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadWhatsAppMedia } from "@/lib/whatsapp-media";
import { WhatsAppMediaBubble } from "@/components/whatsapp/whatsapp-media-bubble";
import { useMessageDraft } from "@/hooks/use-message-draft";
import { MessageDraftStatus } from "@/components/message-draft-status";
import {
  listWhatsAppConversations,
  listWhatsAppMessages,
  sendWhatsAppMessage,
  markWhatsAppRead,
  listAssignableMembers,
  assignWhatsAppConversation,
  setWhatsAppConversationStatus,
  listWhatsAppTemplates,
  applyTemplate,
} from "@/lib/whatsapp.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/crm";
import { useAuth } from "@/lib/auth";
import { useActivityWindows } from "@/components/activity/activity-window-context";
import { ACTIONS_BY_KEY } from "@/components/activity/timeline-shared";
import { InboxIdentityLinker } from "@/components/inbox/inbox-identity-linker";
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

export const Route = createFileRoute("/_authenticated/inbox/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp — Inbox TechERP" },
      {
        name: "description",
        content: "Conversas de WhatsApp do workspace em uma central organizada.",
      },
      { property: "og:title", content: "WhatsApp — Inbox TechERP" },
      {
        property: "og:description",
        content: "Conversas de WhatsApp do workspace em uma central organizada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WhatsAppInbox,
});

function WhatsAppInbox() {
  const openActivity = useActivityWindows();
  const qc = useQueryClient();
  const { user } = useAuth();
  const listFn = useServerFn(listWhatsAppConversations);
  const msgsFn = useServerFn(listWhatsAppMessages);
  const sendFn = useServerFn(sendWhatsAppMessage);
  const markFn = useServerFn(markWhatsAppRead);
  const membersFn = useServerFn(listAssignableMembers);
  const assignFn = useServerFn(assignWhatsAppConversation);
  const statusFn = useServerFn(setWhatsAppConversationStatus);
  const templatesFn = useServerFn(listWhatsAppTemplates);

  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState<"mine" | "unassigned" | "all">("all");
  const [pendingMedia, setPendingMedia] = useState<{
    url: string;
    contentType: string;
    name: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [templateRequired, setTemplateRequired] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateVars, setTemplateVars] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const conversationsQ = useQuery({ queryKey: ["wa", "conversations"], queryFn: () => listFn() });
  const messagesQ = useQuery({
    queryKey: ["wa", "messages", selected],
    queryFn: () => msgsFn({ data: { conversationId: selected! } }),
    enabled: !!selected,
  });
  const membersQ = useQuery({ queryKey: ["wa", "members"], queryFn: () => membersFn() });
  const templatesQ = useQuery({
    queryKey: ["wa", "templates"],
    queryFn: () => templatesFn(),
    enabled: templateRequired,
  });
  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    (membersQ.data ?? []).forEach((m) => map.set(m.id, m.full_name || "—"));
    return map;
  }, [membersQ.data]);

  // Realtime: nova mensagem entra -> refetch
  useEffect(() => {
    const channel = supabase
      .channel("wa-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["wa", "messages"] });
        qc.invalidateQueries({ queryKey: ["wa", "conversations"] });
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversations" },
        () => {
          qc.invalidateQueries({ queryKey: ["wa", "conversations"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  // Marca como lido ao selecionar
  useEffect(() => {
    if (selected) {
      markFn({ data: { conversationId: selected } }).then(() => {
        qc.invalidateQueries({ queryKey: ["wa", "conversations"] });
      });
    }
  }, [selected, markFn, qc]);

  const sendMut = useMutation({
    mutationFn: (input: {
      to: string;
      body: string;
      contactId?: string;
      mediaUrl?: string;
      mediaContentType?: string;
      templateName?: string;
      templateLanguage?: string;
      templateVariables?: string[];
    }) =>
      sendFn({ data: input }).then((res) => {
        if (!res.ok) {
          if (res.code === "TEMPLATE_REQUIRED") setTemplateRequired(true);
          throw new Error(res.error);
        }
        return res;
      }),
    onSuccess: (res) => {
      setDraft("");
      messageDraft.clearAfterSend();
      setPendingMedia(null);
      setTemplateRequired(false);
      setTemplateName("");
      setTemplateVars([]);
      setSelected(res.conversationId);
      qc.invalidateQueries({ queryKey: ["wa"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handlePickFile(file: File) {
    setUploading(true);
    try {
      const res = await uploadWhatsAppMedia(file);
      setPendingMedia({ url: res.url, contentType: res.contentType, name: file.name });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function submitDraft() {
    if (!current) return;
    if (!draft.trim() && !pendingMedia) return;
    sendMut.mutate({
      to: current.contact_phone,
      body: draft,
      contactId: current.contact_id ?? undefined,
      mediaUrl: pendingMedia?.url,
      mediaContentType: pendingMedia?.contentType,
    });
  }

  const approvedTemplates = templatesQ.data ?? [];
  const selectedTemplate = approvedTemplates.find((template) => template.name === templateName);
  const templateVariableCount = selectedTemplate?.variableCount ?? 0;

  function submitTemplate() {
    if (!current || !selectedTemplate) return;
    sendMut.mutate({
      to: current.contact_phone,
      body: "",
      contactId: current.contact_id ?? undefined,
      templateName: selectedTemplate.name,
      templateLanguage: selectedTemplate.language,
      templateVariables: Array.from(
        { length: templateVariableCount },
        (_, index) => templateVars[index] ?? "",
      ),
    });
  }

  const assignMut = useMutation({
    mutationFn: (vars: { conversationId: string; assignedTo: string | null }) =>
      assignFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa", "conversations"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (vars: { conversationId: string; status: "open" | "closed" | "snoozed" }) =>
      statusFn({ data: vars }),
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["wa", "conversations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allConversations = conversationsQ.data ?? [];
  const conversations = useMemo(() => {
    if (filter === "mine") return allConversations.filter((c) => c.assigned_to === user?.id);
    if (filter === "unassigned") return allConversations.filter((c) => !c.assigned_to);
    return allConversations;
  }, [allConversations, filter, user?.id]);
  const messages = messagesQ.data ?? [];
  const current = useMemo(
    () =>
      conversations.find((c) => c.id === selected) ??
      allConversations.find((c) => c.id === selected),
    [conversations, allConversations, selected],
  );

  // Rascunho automático da mensagem em digitação por conversa.
  const messageDraft = useMessageDraft({
    scope: {
      channel: "whatsapp",
      conversationId: selected,
      contactId: current?.contact_id ?? null,
      to: current?.contact_phone ?? null,
    },
    enabled: !!selected,
    value: { body_text: draft },
    onRestore: (d) => setDraft(d.body_text),
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <InboxWorkspace
      title="Inbox WhatsApp"
      description="Conversas pelo número conectado do WhatsApp"
      actions={
        <>
          <WhatsAppSettingsButton />
          <Button onClick={() => openActivity?.({ action: ACTIONS_BY_KEY["create:whatsapp"] })}>
            <MessageCircle className="mr-2 h-4 w-4" /> Nova conversa
          </Button>
        </>
      }
      list={
        <>
          <InboxListHeader>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="mine">Minhas</TabsTrigger>
                <TabsTrigger value="unassigned">Sem dono</TabsTrigger>
                <TabsTrigger value="all">Todas</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="mt-2 px-1 text-xs text-muted-foreground">
              {conversations.length} conversa(s)
            </div>
          </InboxListHeader>
          <InboxConversationList>
            {conversationsQ.isError ? (
              <InboxError onRetry={() => conversationsQ.refetch()} />
            ) : conversationsQ.isLoading ? (
              <InboxLoading />
            ) : conversations.length === 0 ? (
              <InboxEmpty>Nenhuma conversa ainda. Envie uma mensagem para começar.</InboxEmpty>
            ) : null}
            <div className="space-y-1 px-2 pb-3">
              {conversations.map((c) => (
                <InboxConversationItem
                  key={c.id}
                  label={c.contact_phone}
                  preview={c.last_message_preview || "—"}
                  when={c.last_message_at}
                  whenTitle={c.last_message_at ? formatDateTime(c.last_message_at) : undefined}
                  selected={selected === c.id}
                  onClick={() => setSelected(c.id)}
                  unread={c.unread_count}
                  badge={
                    c.status === "closed" ? (
                      <Badge variant="secondary" className="text-[10px]">
                        fechada
                      </Badge>
                    ) : null
                  }
                  meta={
                    c.assigned_to ? (
                      <span className="inline-flex items-center gap-1">
                        <UserCheck className="h-3 w-3" />
                        {memberMap.get(c.assigned_to) ?? "atribuída"}
                      </span>
                    ) : (
                      <span className="italic">sem dono</span>
                    )
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
            <InboxEmpty>Selecione uma conversa para visualizar o histórico.</InboxEmpty>
          ) : messagesQ.isError ? (
            <InboxError onRetry={() => messagesQ.refetch()}>
              Não foi possível carregar esta conversa.
            </InboxError>
          ) : (
            <>
              <InboxConversationHeader
                label={current.contact_phone}
                subtitle={`WhatsApp · via ${current.twilio_number}`}
                actions={
                  <>
                    <Select
                      value={current.assigned_to ?? "_none"}
                      onValueChange={(v) =>
                        assignMut.mutate({
                          conversationId: current.id,
                          assignedTo: v === "_none" ? null : v,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-[180px] text-xs">
                        <SelectValue placeholder="Atribuir a…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Sem dono</SelectItem>
                        {user?.id && (
                          <SelectItem value={user.id}>
                            Eu ({memberMap.get(user.id) ?? "—"})
                          </SelectItem>
                        )}
                        {(membersQ.data ?? [])
                          .filter((m) => m.id !== user?.id)
                          .map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.full_name || m.id.slice(0, 6)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {current.status === "closed" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          statusMut.mutate({ conversationId: current.id, status: "open" })
                        }
                      >
                        Reabrir
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          statusMut.mutate({ conversationId: current.id, status: "closed" })
                        }
                      >
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Fechar
                      </Button>
                    )}
                  </>
                }
              />
              <ScrollArea className="flex-1 bg-product-panel-muted px-5 py-6" aria-live="polite">
                <div className="space-y-5">
                  {messages.map((m) => (
                    <InboxMessageBubble
                      key={m.id}
                      outbound={m.direction === "outbound"}
                      when={m.created_at}
                      status={m.direction === "outbound" ? m.status : null}
                    >
                      {m.media_url && (
                        <div className="mb-1">
                          <WhatsAppMediaBubble
                            url={m.media_url}
                            contentType={m.media_content_type}
                          />
                        </div>
                      )}
                      {m.body && <div className="whitespace-pre-wrap">{m.body}</div>}
                    </InboxMessageBubble>
                  ))}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>
              <div className="bg-product-panel p-4 pt-3">
                {templateRequired && (
                  <div className="mb-3 space-y-3 rounded-md border border-border bg-product-panel-muted p-3">
                    <div className="flex gap-2 text-sm text-text-primary">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div>
                        <p className="font-medium">Janela de 24 horas encerrada</p>
                        <p className="text-xs text-muted-foreground">
                          Para iniciar uma nova conversa, escolha um modelo aprovado pela Meta.
                        </p>
                      </div>
                    </div>
                    {templatesQ.isError ? (
                      <div className="flex items-center justify-between gap-2 text-xs text-destructive">
                        <span>Não foi possível carregar os modelos aprovados.</span>
                        <Button size="sm" variant="outline" onClick={() => templatesQ.refetch()}>
                          Tentar novamente
                        </Button>
                      </div>
                    ) : templatesQ.isLoading ? (
                      <p className="text-xs text-muted-foreground">Carregando modelos aprovados…</p>
                    ) : approvedTemplates.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Nenhum modelo aprovado está disponível. Configure um modelo na Meta antes de
                        enviar.
                      </p>
                    ) : (
                      <>
                        <Select
                          value={templateName}
                          onValueChange={(value) => {
                            setTemplateName(value);
                            setTemplateVars([]);
                          }}
                        >
                          <SelectTrigger aria-label="Modelo aprovado pela Meta">
                            <SelectValue placeholder="Escolha um modelo aprovado" />
                          </SelectTrigger>
                          <SelectContent>
                            {approvedTemplates.map((template) => (
                              <SelectItem
                                key={`${template.name}:${template.language}`}
                                value={template.name}
                              >
                                {template.name} · {template.language}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedTemplate && (
                          <div className="space-y-2">
                            {Array.from({ length: templateVariableCount }, (_, index) => (
                              <Input
                                key={index}
                                value={templateVars[index] ?? ""}
                                onChange={(event) =>
                                  setTemplateVars((previous) => {
                                    const next = [...previous];
                                    next[index] = event.target.value;
                                    return next;
                                  })
                                }
                                placeholder={`Valor de {{${index + 1}}}`}
                                aria-label={`Variável ${index + 1} do modelo`}
                              />
                            ))}
                            <div className="whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-sm">
                              {applyTemplate(selectedTemplate.body, templateVars)}
                            </div>
                            <Button
                              onClick={submitTemplate}
                              disabled={
                                sendMut.isPending ||
                                templateVars
                                  .slice(0, templateVariableCount)
                                  .some((value) => !value?.trim())
                              }
                            >
                              <Send className="mr-2 h-4 w-4" /> Enviar modelo
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                {pendingMedia && (
                  <div className="mb-2 flex items-start gap-2 rounded-[calc(var(--radius)+0.75rem)] bg-product-panel-muted p-3 ring-1 ring-border-subtle">
                    <WhatsAppMediaBubble
                      url={pendingMedia.url}
                      contentType={pendingMedia.contentType}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs">{pendingMedia.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {pendingMedia.contentType}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setPendingMedia(null)}
                      aria-label="Remover anexo"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <div className="flex items-end gap-2 rounded-[calc(var(--radius)+1rem)] bg-product-panel-muted p-2 ring-1 ring-border-subtle focus-within:ring-2 focus-within:ring-ring">
                  <input
                    ref={fileRef}
                    type="file"
                    hidden
                    accept="image/*,audio/*,video/*,application/pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePickFile(f);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    title="Anexar mídia"
                    aria-label="Anexar mídia"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Escreva uma mensagem…"
                    rows={2}
                    className="min-h-12 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        submitDraft();
                      }
                    }}
                  />
                  <Button
                    onClick={submitDraft}
                    disabled={(!draft.trim() && !pendingMedia) || sendMut.isPending || uploading}
                    aria-label="Enviar mensagem"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] text-muted-foreground">
                    Ctrl/Cmd + Enter para enviar · anexe imagem, áudio, vídeo ou PDF (até 16MB)
                  </p>
                  <div className="flex items-center gap-2">
                    <MessageDraftStatus
                      status={messageDraft.status}
                      savedAt={messageDraft.savedAt}
                    />
                    {messageDraft.status !== "idle" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await messageDraft.discard();
                          setDraft("");
                        }}
                      >
                        Descartar rascunho
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      }
      context={
        current ? (
          <InboxContext
            initials={current.contact_phone.slice(-2)}
            title={current.contact_phone}
            subtitle={`via ${current.twilio_number}`}
          >
            <div className="space-y-3 border-t border-border pt-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Responsável</p>
                <p className="mt-1 font-medium">
                  {current.assigned_to
                    ? (memberMap.get(current.assigned_to) ?? "Atribuída")
                    : "Sem dono"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="mt-1 font-medium">
                  {current.status === "closed" ? "Fechada" : "Aberta"}
                </p>
              </div>
              <InboxIdentityLinker
                channel="whatsapp"
                conversationId={current.id}
                contactId={current.contact_id}
                leadId={current.lead_id}
                status={current.identity_status}
                onLinked={() => qc.invalidateQueries({ queryKey: ["wa", "conversations"] })}
              />
            </div>
          </InboxContext>
        ) : undefined
      }
    />
  );
}

function WhatsAppSettingsButton() {
  return (
    <Button asChild variant="outline">
      <Link to="/settings/whatsapp">
        <SettingsIcon className="mr-2 h-4 w-4" /> Configurar
      </Link>
    </Button>
  );
}
