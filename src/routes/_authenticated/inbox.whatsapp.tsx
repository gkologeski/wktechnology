import { usePermissions } from "@/lib/access-control/use-permissions";
import { compactCount } from "@/lib/inbox/channel-page";
import { useInboxChannelPage } from "@/hooks/use-inbox-channel-page";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { InboxListFooter } from "@/components/inbox/inbox-list-footer";
import { InboxListSearch } from "@/components/inbox/inbox-list-search";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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
import { WhatsAppMediaBubble, LinkifiedText } from "@/components/whatsapp/whatsapp-media-bubble";
import { isLegacyPlaceholder } from "@/lib/whatsapp/inbound-media";
import { useScopedComposerValue } from "@/hooks/use-scoped-composer-value";
import { useMessageDraft } from "@/hooks/use-message-draft";
import { MessageDraftStatus } from "@/components/message-draft-status";
import {
  listWhatsAppConversations,
  sendWhatsAppMessage,
  markWhatsAppRead,
  listAssignableMembers,
  assignWhatsAppConversation,
  setWhatsAppConversationStatus,
} from "@/lib/whatsapp.functions";
import { useChannelAvailability } from "@/hooks/use-channel-availability";
import { useInboxIdentityNames } from "@/hooks/use-inbox-identity-names";
import { usePersonPhotos } from "@/hooks/use-person-photos";
import { conversationDisplayName } from "@/lib/inbox/identity-names";
import { useWhatsAppComposer } from "@/hooks/use-whatsapp-composer";
import {
  WhatsAppTemplateFields,
  templateValuesComplete,
} from "@/components/whatsapp/whatsapp-template-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { listConversationMessages } from "@/lib/inbox/message-history.functions";
import { useMessageHistory } from "@/hooks/use-message-history";
import { MessageHistoryViewport } from "@/components/inbox/message-history-viewport";
import type { HistoryPage } from "@/lib/inbox/message-history";
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
  InboxAiSuggestionCard,
  SdrMaterialLink,
  useConversationSuggestions,
} from "@/components/inbox/inbox-ai-suggestions";
import { ConversationAiOwnerToggle } from "@/components/inbox/conversation-ai-owner-toggle";
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

type WaConversationRow = Awaited<ReturnType<typeof listWhatsAppConversations>>[number];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    conversation?: string;
    state?: "open" | "closed";
    who?: "mine" | "unassigned" | "interacted";
  } => {
    const c = search.conversation;
    const st = search.state;
    const who = search.who;
    return {
      ...(who === "mine" || who === "unassigned" || who === "interacted" ? { who } : {}),
      ...(typeof c === "string" && UUID_RE.test(c) ? { conversation: c } : {}),
      ...(st === "open" || st === "closed" ? { state: st } : {}),
    };
  },
  component: WhatsAppInbox,
});

function WhatsAppInbox() {
  const permissions = usePermissions();
  const openActivity = useActivityWindows();
  const qc = useQueryClient();
  const { user } = useAuth();
  const msgsFn = useServerFn(listConversationMessages);
  const sendFn = useServerFn(sendWhatsAppMessage);
  const markFn = useServerFn(markWhatsAppRead);
  const membersFn = useServerFn(listAssignableMembers);
  const assignFn = useServerFn(assignWhatsAppConversation);
  const statusFn = useServerFn(setWhatsAppConversationStatus);

  const { conversation: urlConversation, state: urlState, who: urlWho } = Route.useSearch();
  const stateFilter = urlState ?? "all";
  const navigate = Route.useNavigate();
  const [selected, setSelected] = useState<string | null>(urlConversation ?? null);
  // Clique em notificação (ou link compartilhado): a conversa do endereço é aberta.
  useEffect(() => {
    if (urlConversation) setSelected(urlConversation);
  }, [urlConversation]);
  const composerScope = `${user?.id ?? ""}:${selected ?? ""}`;
  const [draft, setDraft] = useScopedComposerValue(composerScope, "");
  const filter = urlWho ?? "all";
  const setFilter = (v: "mine" | "unassigned" | "interacted" | "all") =>
    navigate({ search: (prev) => ({ ...prev, who: v === "all" ? undefined : v }), replace: true });
  const [pendingMedia, setPendingMedia] = useScopedComposerValue<{
    url: string;
    contentType: string;
    name: string;
  } | null>(composerScope, null);
  const [uploading, setUploading] = useScopedComposerValue(composerScope, false);
  const [templateRequiredByServer, setTemplateRequired] = useScopedComposerValue(
    composerScope,
    false,
  );
  const [templateName, setTemplateName] = useScopedComposerValue(composerScope, "");
  const [templateVars, setTemplateVars] = useScopedComposerValue<string[]>(composerScope, []);
  const [templateHeaderVars, setTemplateHeaderVars] = useScopedComposerValue<string[]>(
    composerScope,
    [],
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const {
    rows: conversations,
    counts,
    stateCounts,
    total,
    query: conversationsQ,
  } = useInboxChannelPage<WaConversationRow>("whatsapp", filter, debouncedSearch, stateFilter);
  const [selectedSnapshot, setSelectedSnapshot] = useState<WaConversationRow | null>(null);
  const history = useMessageHistory<WaMessageRow>({
    contextKey: selected && user?.id ? `${user.id}:whatsapp:${selected}` : null,
    fetchPage: ({ signal, ...cur }) =>
      msgsFn({
        data: { channel: "whatsapp", conversation_id: selected!, ...cur },
        signal,
      }) as Promise<HistoryPage<WaMessageRow>>,
    realtime: selected
      ? {
          table: "whatsapp_messages",
          filter: `conversation_id=eq.${selected}`,
          kind: "rows",
          patchKeys: WA_PATCH_KEYS,
        }
      : null,
  });
  const membersQ = useQuery({ queryKey: ["wa", "members"], queryFn: () => membersFn() });
  // Conversa vinda do endereço fora da página atual: lida com RLS do usuário.
  useEffect(() => {
    if (!urlConversation || conversationsQ.isPending) return;
    if (conversations.some((c) => c.id === urlConversation)) return;
    if (selectedSnapshot?.id === urlConversation) return;
    let cancelled = false;
    void supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("id", urlConversation)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          toast.error("Conversa não encontrada ou sem acesso.");
          setSelected(null);
          navigate({ search: (prev) => ({ ...prev, conversation: undefined }), replace: true });
          return;
        }
        setSelectedSnapshot(data as unknown as WaConversationRow);
      });
    return () => {
      cancelled = true;
    };
  }, [urlConversation, conversations, conversationsQ.isPending, selectedSnapshot?.id, navigate]);
  const current = useMemo(
    () =>
      conversations.find((c) => c.id === selected) ??
      (selectedSnapshot?.id === selected ? selectedSnapshot : undefined),
    [conversations, selectedSnapshot, selected],
  );
  const identityNames = useInboxIdentityNames(
    current ? [...conversations, current] : conversations,
  );
  const nameOf = (c: {
    contact_id?: string | null;
    lead_id?: string | null;
    contact_phone: string;
  }) => conversationDisplayName(c, identityNames.contacts, identityNames.leads);
  const currentName = current ? nameOf(current) : "";
  const photoRows = current ? [...conversations, current] : conversations;
  const photos = usePersonPhotos(
    photoRows.map((c) => c.contact_id),
    photoRows.filter((c) => !c.contact_id).map((c) => c.lead_id),
  );
  const photoOf = (c: { contact_id?: string | null; lead_id?: string | null }) =>
    (c.contact_id && photos[`contact:${c.contact_id}`]) ||
    (c.lead_id && photos[`lead:${c.lead_id}`]) ||
    null;
  const suggestionsQ = useConversationSuggestions(selected);
  const suggestionsByMsg = useMemo(() => {
    const map = new Map<string, NonNullable<typeof suggestionsQ.data>>();
    for (const sg of suggestionsQ.data ?? []) {
      const list = map.get(sg.message_id) ?? [];
      list.push(sg);
      map.set(sg.message_id, list);
    }
    return map;
  }, [suggestionsQ.data]);
  const currentNamed = !!current && currentName !== current.contact_phone;
  // Janela de 24 h + catálogo pelo hook único do compositor (o servidor revalida no envio).
  const availabilityQ = useChannelAvailability();
  const currentPhone = current?.contact_phone ?? "";
  // Último recebimento visto (inclusive em tempo real): ao mudar, a janela é refeita.
  const lastInboundHint = useMemo(() => {
    let last: string | null = null;
    for (const m of history.items)
      if (m.direction === "inbound" && (!last || m.created_at > last)) last = m.created_at;
    return last;
  }, [history.items]);
  const composer = useWhatsAppComposer({
    to: currentPhone,
    conversationId: selected ?? null,
    lastInboundHint,
    enabled: !!current,
    templateRequiredByServer,
  });
  const { windowQ, templatesQ } = composer;
  const windowUnknown =
    !!currentPhone &&
    composer.policy.windowState !== "open" &&
    composer.policy.windowState !== "closed";
  const templateRequired = composer.policy.windowState === "closed";
  const freeTextBlocked = !composer.policy.freeTextAllowed;

  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    (membersQ.data ?? []).forEach((m) => map.set(m.id, m.full_name || "—"));
    return map;
  }, [membersQ.data]);

  // Marca como lido ao selecionar
  useEffect(() => {
    if (selected) {
      markFn({ data: { conversationId: selected } }).then(() => {
        qc.invalidateQueries({ queryKey: ["inbox-channel", "whatsapp"] });
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
      templateHeaderVariables?: string[];
    }) =>
      Promise.resolve()
        .then(() => {
          if (
            !permissions.canAny([
              "techsales.inbox.whatsapp.create.own",
              "techsales.inbox.whatsapp.create.team",
              "techsales.inbox.whatsapp.create.workspace",
            ])
          )
            throw new Error("Sem permissão para enviar WhatsApp.");
          return sendFn({ data: { ...input, conversationId: selected ?? undefined } });
        })
        .then((res) => {
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
      qc.invalidateQueries({ queryKey: ["inbox-channel", "whatsapp"] });
      void history.syncNewer();
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
    // Fora da janela (ou sem confirmação dela) texto livre e anexo não saem.
    if (freeTextBlocked) return;
    if (!draft.trim() && !pendingMedia) return;
    sendMut.mutate({
      to: current.contact_phone,
      body: draft,
      contactId: current.contact_id ?? undefined,
      mediaUrl: pendingMedia?.url,
      mediaContentType: pendingMedia?.contentType,
    });
  }

  const approvedTemplates = composer.templates;
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
      templateHeaderVariables: Array.from(
        { length: selectedTemplate.headerVariableCount },
        (_, index) => templateHeaderVars[index] ?? "",
      ),
    });
  }

  const assignMut = useMutation({
    mutationFn: (vars: { conversationId: string; assignedTo: string | null }) =>
      assignFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox-channel", "whatsapp"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (vars: { conversationId: string; status: "open" | "closed" | "snoozed" }) =>
      statusFn({ data: vars }),
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["inbox-channel", "whatsapp"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const messages = history.items;

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
            <Tabs
              value={stateFilter}
              onValueChange={(v) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    state: v === "open" || v === "closed" ? v : undefined,
                  }),
                  replace: true,
                })
              }
            >
              <TabsList
                aria-label="Situação da conversa"
                className="grid h-auto w-full grid-cols-3 p-0.5"
              >
                {(
                  [
                    ["open", "Abertas"],
                    ["closed", "Fechadas"],
                    ["all", "Todas"],
                  ] as const
                ).map(([value, label]) => (
                  <TabsTrigger
                    key={value}
                    className="h-5 gap-1 px-1 py-0 text-[11px]"
                    value={value}
                  >
                    {label}
                    {stateCounts ? (
                      <span className="text-[10px] font-normal text-muted-foreground">
                        {compactCount(stateCounts[value])}
                      </span>
                    ) : null}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <TabsList className="grid h-auto w-full grid-cols-4 p-0.5">
                <TabsTrigger className="h-5 gap-1 px-1 py-0 text-[11px]" value="mine">
                  Minhas
                  {counts ? (
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {compactCount(counts.mine)}
                    </span>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger className="h-5 gap-1 px-1 py-0 text-[11px]" value="unassigned">
                  Sem dono
                  {counts ? (
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {compactCount(counts.unassigned)}
                    </span>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger className="h-5 gap-1 px-1 py-0 text-[11px]" value="interacted">
                  Interagiu
                  {counts ? (
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {compactCount(counts.interacted)}
                    </span>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger className="h-5 gap-1 px-1 py-0 text-[11px]" value="all">
                  Todas
                  {counts ? (
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {compactCount(counts.all)}
                    </span>
                  ) : null}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <InboxListSearch
              value={search}
              onChange={setSearch}
              placeholder="Buscar telefone, mensagem ou contato…"
            />
          </InboxListHeader>
          <InboxConversationList>
            {conversationsQ.isError && conversations.length === 0 ? (
              <InboxError onRetry={() => conversationsQ.refetch()} />
            ) : conversationsQ.isPending ? (
              <InboxLoading />
            ) : conversations.length === 0 && debouncedSearch.trim() ? (
              <InboxEmpty>Nenhuma conversa encontrada.</InboxEmpty>
            ) : conversations.length === 0 ? (
              <InboxEmpty>Nenhuma conversa ainda. Envie uma mensagem para começar.</InboxEmpty>
            ) : null}
            <div className="space-y-1 px-2 pb-3">
              {conversations.map((c) => (
                <InboxConversationItem
                  key={c.id}
                  label={nameOf(c)}
                  photoUrl={photoOf(c)}
                  title={nameOf(c) !== c.contact_phone ? c.contact_phone : undefined}
                  preview={c.last_message_preview || "—"}
                  when={c.last_message_at}
                  whenTitle={c.last_message_at ? formatDateTime(c.last_message_at) : undefined}
                  selected={selected === c.id}
                  onClick={() => {
                    setSelected(c.id);
                    setSelectedSnapshot(c);
                    navigate({
                      search: (prev) => ({ ...prev, conversation: c.id }),
                      replace: true,
                    });
                  }}
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
              {conversations.length > 0 ? (
                <InboxListFooter
                  loaded={conversations.length}
                  total={total}
                  hasMore={!!conversationsQ.hasNextPage}
                  loadingMore={conversationsQ.isFetchingNextPage}
                  error={conversationsQ.isError}
                  onLoadMore={() => void conversationsQ.fetchNextPage()}
                  onRetry={() => void conversationsQ.refetch()}
                />
              ) : null}
            </div>
          </InboxConversationList>
        </>
      }
      conversation={
        <>
          {!current ? (
            <InboxEmpty>Selecione uma conversa para visualizar o histórico.</InboxEmpty>
          ) : history.initial === "error" ? (
            <InboxError onRetry={history.retryInitial}>
              Não foi possível carregar esta conversa.
            </InboxError>
          ) : (
            <>
              <InboxConversationHeader
                label={currentName}
                photoUrl={photoOf(current)}
                subtitle={
                  currentNamed
                    ? `WhatsApp · ${current.contact_phone} · via ${current.twilio_number}`
                    : `WhatsApp · via ${current.twilio_number}`
                }
                actions={
                  <>
                    <ConversationAiOwnerToggle conversationId={current.id} />
                    <Select
                      value={current.assigned_to ?? "_none"}
                      onValueChange={(v) =>
                        assignMut.mutate({
                          conversationId: current.id,
                          assignedTo: v === "_none" ? null : v,
                        })
                      }
                    >
                      <SelectTrigger className="h-6 w-[190px] text-xs">
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
                className="bg-product-panel-muted px-5 py-4"
              >
                {history.initial === "loading" && !messages.length ? <InboxLoading /> : null}
                {messages.map((m) => (
                  <Fragment key={m.id}>
                    <InboxMessageBubble
                      key={m.id}
                      outbound={m.direction === "outbound"}
                      when={m.created_at}
                      status={m.direction === "outbound" ? m.status : null}
                      failure={
                        m.direction === "outbound" &&
                        (m.status === "failed" || m.status === "undelivered")
                          ? describeDeliveryError(m.error_code, m.error_message)
                          : null
                      }
                    >
                      {m.media_url && (
                        <div className="mb-1">
                          <WhatsAppMediaBubble
                            url={m.media_url}
                            contentType={m.media_content_type}
                            filename={m.body?.match(/^📎 Documento: (.+)$/m)?.[1] ?? null}
                          />
                        </div>
                      )}
                      {m.body && !(m.media_url && isLegacyPlaceholder(m.body)) && (
                        <div className="whitespace-pre-wrap">
                          <LinkifiedText
                            text={sdrMaterialOf(m) ? stripMaterialLine(m.body) : m.body}
                          />
                        </div>
                      )}
                      {sdrMaterialOf(m) ? (
                        <SdrMaterialLink messageId={m.id} label={sdrMaterialOf(m)!} />
                      ) : null}
                    </InboxMessageBubble>
                    {suggestionsByMsg.get(m.id)?.map((sg) => (
                      <InboxAiSuggestionCard
                        key={sg.id}
                        s={sg}
                        personName={currentName || "O cliente"}
                      />
                    ))}
                  </Fragment>
                ))}
              </MessageHistoryViewport>
              <div className="shrink-0 bg-product-panel px-4 pb-3 pt-2">
                {!templateRequired && windowUnknown && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="mb-3 flex items-center justify-between gap-2 rounded-md border border-border bg-product-panel-muted p-3 text-xs"
                  >
                    {windowQ.isError ? (
                      <>
                        <span className="text-destructive">
                          Não foi possível verificar a janela de 24 horas. O envio fica bloqueado
                          até a verificação.
                        </span>
                        <Button size="sm" variant="outline" onClick={() => windowQ.refetch()}>
                          Verificar novamente
                        </Button>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        Verificando a janela de 24 horas…
                      </span>
                    )}
                  </div>
                )}
                {templateRequired && (
                  <div
                    role="region"
                    aria-label="Envio por modelo aprovado"
                    className="mb-2 max-h-[40vh] space-y-2 overflow-y-auto rounded-md border border-border bg-product-panel-muted p-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex gap-2 text-sm text-text-primary">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <div>
                          <p className="font-medium">Janela de 24 horas encerrada</p>
                          <p className="text-xs text-muted-foreground">
                            O cliente não respondeu nas últimas 24 horas. Envie um modelo aprovado
                            pela Meta; seu texto fica guardado como rascunho.
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void composer.refreshTemplates()}
                        disabled={templatesQ.isFetching}
                      >
                        {templatesQ.isFetching ? "Atualizando…" : "Atualizar modelos"}
                      </Button>
                    </div>
                    {availabilityQ.isSuccess && !availabilityQ.data.whatsapp.ready ? (
                      <p className="text-xs text-destructive">
                        WhatsApp não conectado neste workspace. Conecte o número para listar os
                        modelos.
                      </p>
                    ) : templatesQ.isError ? (
                      <div className="flex items-center justify-between gap-2 text-xs text-destructive">
                        <span>Não foi possível carregar os modelos aprovados da Meta.</span>
                        <Button size="sm" variant="outline" onClick={() => templatesQ.refetch()}>
                          Tentar novamente
                        </Button>
                      </div>
                    ) : templatesQ.isPending ? (
                      <p className="text-xs text-muted-foreground">Carregando modelos aprovados…</p>
                    ) : approvedTemplates.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        A conta conectada não tem nenhum modelo com status aprovado. Crie ou aprove
                        um modelo na Meta e clique em “Atualizar modelos”.
                      </p>
                    ) : (
                      <>
                        <Select
                          value={templateName}
                          onValueChange={(value) => {
                            setTemplateName(value);
                            setTemplateVars([]);
                            setTemplateHeaderVars([]);
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
                            <WhatsAppTemplateFields
                              template={selectedTemplate}
                              values={{ body: templateVars, header: templateHeaderVars }}
                              onChange={(v) => {
                                setTemplateVars(v.body);
                                setTemplateHeaderVars(v.header);
                              }}
                              idPrefix="inbox-wa-tpl"
                            />
                            <Button
                              onClick={submitTemplate}
                              disabled={
                                sendMut.isPending ||
                                !templateValuesComplete(selectedTemplate, {
                                  body: templateVars,
                                  header: templateHeaderVars,
                                })
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
                    disabled={uploading || freeTextBlocked}
                    onClick={() => fileRef.current?.click()}
                    title="Anexar mídia"
                    aria-label="Anexar mídia"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    readOnly={freeTextBlocked}
                    aria-disabled={freeTextBlocked}
                    placeholder={
                      templateRequired
                        ? "Fora da janela de 24 horas: envie um modelo aprovado"
                        : "Escreva uma mensagem…"
                    }
                    rows={3}
                    className="field-sizing-content min-h-20 max-h-60 resize-none overflow-y-auto border-0 bg-transparent shadow-none focus-visible:ring-0"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        if (freeTextBlocked) return;
                        submitDraft();
                      }
                    }}
                  />
                  <Button
                    onClick={submitDraft}
                    disabled={
                      freeTextBlocked ||
                      (!draft.trim() && !pendingMedia) ||
                      sendMut.isPending ||
                      uploading
                    }
                    aria-label="Enviar mensagem"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] text-muted-foreground">
                    {templateRequired
                      ? "Texto livre e anexos ficam disponíveis assim que o cliente responder."
                      : "Ctrl/Cmd + Enter para enviar · anexe imagem, áudio, vídeo ou PDF (até 16MB)"}
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
            photoUrl={photoOf(current)}
            initials={
              currentNamed
                ? currentName
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => w[0]?.toUpperCase() ?? "")
                    .join("")
                : current.contact_phone.slice(-2)
            }
            title={currentName}
            titleSlot={
              current.contact_id ? (
                <Link
                  to="/contacts/$id"
                  params={{ id: current.contact_id }}
                  aria-label={`Abrir contato ${currentName}`}
                  className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {currentName}
                </Link>
              ) : current.lead_id ? (
                <Link
                  to="/leads/$id"
                  params={{ id: current.lead_id }}
                  aria-label={`Abrir lead ${currentName}`}
                  className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {currentName}
                </Link>
              ) : undefined
            }
            subtitle={
              currentNamed
                ? `${current.contact_phone} · via ${current.twilio_number}`
                : `via ${current.twilio_number}`
            }
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
                key={current.id}
                channel="whatsapp"
                conversationId={current.id}
                contactId={current.contact_id}
                leadId={current.lead_id}
                status={current.identity_status}
                onLinked={() => qc.invalidateQueries({ queryKey: ["inbox-channel", "whatsapp"] })}
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

type WaMessageRow = {
  id: string;
  created_at: string;
  direction: string;
  body: string | null;
  media_url: string | null;
  media_content_type: string | null;
  status: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  wa_message_id: string | null;
  template_name: string | null;
  is_template: boolean | null;
  error_code?: string | null;
  error_message?: string | null;
};
const WA_PATCH_KEYS = [
  "status",
  "sent_at",
  "delivered_at",
  "read_at",
  "wa_message_id",
  "body",
  "media_url",
  "media_content_type",
  "error_code",
  "error_message",
] as const;

/** Material da Lia: anexo de saída sem arquivo guardado na mensagem, com linha "📎 Nome". */
function sdrMaterialOf(m: WaMessageRow): string | null {
  if (m.direction !== "outbound" || m.media_url || !m.media_content_type) return null;
  const hit = m.body?.match(/^📎 (?!Documento:)(.+)$/m);
  return hit?.[1]?.trim() || null;
}
function stripMaterialLine(body: string): string {
  return body.replace(/\n?^📎 (?!Documento:).+$/m, "").trimEnd();
}
