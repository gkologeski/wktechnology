import { createFileRoute } from "@tanstack/react-router";
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
  Check,
  CheckCheck,
  Paperclip,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadWhatsAppMedia } from "@/lib/whatsapp-media";
import { WhatsAppMediaBubble } from "@/components/whatsapp/whatsapp-media-bubble";
import {
  listWhatsAppConversations,
  listWhatsAppMessages,
  sendWhatsAppMessage,
  markWhatsAppRead,
  getWhatsAppConfig,
  saveWhatsAppConfig,
  listAssignableMembers,
  assignWhatsAppConversation,
  setWhatsAppConversationStatus,
} from "@/lib/whatsapp.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { SendWhatsAppDialog } from "@/components/whatsapp/send-whatsapp-dialog";
import { WhatsAppTemplatesEditor } from "@/components/whatsapp/whatsapp-templates-editor";

export const Route = createFileRoute("/_authenticated/inbox/whatsapp")({
  component: WhatsAppInbox,
});

function WhatsAppInbox() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const listFn = useServerFn(listWhatsAppConversations);
  const msgsFn = useServerFn(listWhatsAppMessages);
  const sendFn = useServerFn(sendWhatsAppMessage);
  const markFn = useServerFn(markWhatsAppRead);
  const membersFn = useServerFn(listAssignableMembers);
  const assignFn = useServerFn(assignWhatsAppConversation);
  const statusFn = useServerFn(setWhatsAppConversationStatus);

  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState<"mine" | "unassigned" | "all">("all");
  const [pendingMedia, setPendingMedia] = useState<{
    url: string;
    contentType: string;
    name: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const conversationsQ = useQuery({ queryKey: ["wa", "conversations"], queryFn: () => listFn() });
  const messagesQ = useQuery({
    queryKey: ["wa", "messages", selected],
    queryFn: () => msgsFn({ data: { conversationId: selected! } }),
    enabled: !!selected,
  });
  const membersQ = useQuery({ queryKey: ["wa", "members"], queryFn: () => membersFn() });
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
    }) => sendFn({ data: input }),
    onSuccess: (res) => {
      toast.success("Mensagem enviada");
      setDraft("");
      setPendingMedia(null);
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
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inbox WhatsApp</h1>
          <p className="text-sm text-muted-foreground">Conversas via Twilio</p>
        </div>
        <div className="flex gap-2">
          <WhatsAppSettingsButton />
          <SendWhatsAppDialog
            onSent={(id) => setSelected(id)}
            trigger={
              <Button>
                <MessageCircle className="mr-2 h-4 w-4" /> Nova conversa
              </Button>
            }
          />
        </div>
      </div>

      <div className="grid flex-1 grid-cols-[320px_1fr] gap-3 overflow-hidden">
        {/* Lista de conversas */}
        <Card className="flex flex-col overflow-hidden">
          <div className="border-b p-2">
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
          </div>
          <ScrollArea className="flex-1">
            {conversationsQ.isLoading && (
              <div className="p-4 text-sm text-muted-foreground">Carregando…</div>
            )}
            {!conversationsQ.isLoading && conversations.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">
                Nenhuma conversa ainda. Envie uma mensagem para começar.
              </div>
            )}
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={`flex w-full flex-col gap-1 border-b p-3 text-left transition hover:bg-muted/50 ${
                  selected === c.id ? "bg-muted" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 truncate text-sm font-medium">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate">{c.contact_phone}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {c.status === "closed" && (
                      <Badge variant="secondary" className="text-[10px]">
                        fechada
                      </Badge>
                    )}
                    {c.unread_count > 0 && <Badge variant="default">{c.unread_count}</Badge>}
                  </div>
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {c.last_message_preview || "—"}
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{c.last_message_at ? formatDateTime(c.last_message_at) : ""}</span>
                  {c.assigned_to ? (
                    <span className="flex items-center gap-1">
                      <UserCheck className="h-3 w-3" />
                      {memberMap.get(c.assigned_to) ?? "atribuída"}
                    </span>
                  ) : (
                    <span className="italic">sem dono</span>
                  )}
                </div>
              </button>
            ))}
          </ScrollArea>
        </Card>

        {/* Painel de mensagens */}
        <Card className="flex flex-col overflow-hidden">
          {!current ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Selecione uma conversa
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
                <div>
                  <div className="text-sm font-medium">{current.contact_phone}</div>
                  <div className="text-xs text-muted-foreground">via {current.twilio_number}</div>
                </div>
                <div className="flex items-center gap-2">
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
                </div>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-2">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                          m.direction === "outbound"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
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
                        <div className="mt-1 flex items-center gap-1 text-[10px] opacity-70">
                          <span>{formatDateTime(m.created_at)}</span>
                          {m.direction === "outbound" && (
                            <span className="ml-auto inline-flex items-center gap-0.5">
                              {m.status === "read" ? (
                                <CheckCheck className="h-3 w-3 text-sky-300" />
                              ) : m.status === "delivered" ? (
                                <CheckCheck className="h-3 w-3" />
                              ) : m.status === "sent" || m.status === "queued" ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <span>{m.status}</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>
              <div className="border-t p-3">
                {pendingMedia && (
                  <div className="mb-2 flex items-start gap-2 rounded-md border p-2">
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
                    <Button size="icon" variant="ghost" onClick={() => setPendingMedia(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
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
                    variant="outline"
                    size="icon"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    title="Anexar mídia"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Escreva uma mensagem…"
                    rows={2}
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
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Ctrl/Cmd + Enter para enviar · anexe imagem, áudio, vídeo ou PDF (até 16MB)
                </p>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function WhatsAppSettingsButton() {
  const qc = useQueryClient();
  const getCfg = useServerFn(getWhatsAppConfig);
  const saveCfg = useServerFn(saveWhatsAppConfig);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const cfgQ = useQuery({ queryKey: ["wa", "config"], queryFn: () => getCfg(), enabled: open });
  useEffect(() => {
    if (cfgQ.data) {
      setFrom(cfgQ.data.from_number || "");
      setBaseUrl(cfgQ.data.public_base_url || "");
    }
  }, [cfgQ.data]);
  const saveMut = useMutation({
    mutationFn: () => saveCfg({ data: { from_number: from, public_base_url: baseUrl } }),
    onSuccess: () => {
      toast.success("Configuração salva");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["wa", "config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const effectiveBase = cfgQ.data?.effective_public_base ?? "";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <SettingsIcon className="mr-2 h-4 w-4" /> Configurar
        </Button>
      </DialogTrigger>
      <DialogContent className="overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Twilio WhatsApp</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">From (E.164)</label>
            <Input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="+14155238886 (sandbox)"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Deixe vazio para usar o sandbox padrão da Twilio (+14155238886). Para produção, cole o
              número aprovado para WhatsApp Business.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">URL pública (base)</label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={effectiveBase || "https://seu-dominio.com"}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Usada para webhooks de entrada e status callback. Padrão: domínio publicado.
            </p>
          </div>
          <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-2">
            <div>
              <div className="font-medium">Webhook inbound (When a message comes in)</div>
              <code className="break-all">{effectiveBase}/api/public/hooks/twilio-whatsapp</code>
            </div>
            <div>
              <div className="font-medium">Status callback (entrega/leitura)</div>
              <code className="break-all">
                {effectiveBase}/api/public/hooks/twilio-whatsapp-status
              </code>
              <p className="mt-1 text-muted-foreground">
                Já é enviado automaticamente em cada mensagem. Use no Twilio Console se quiser
                também receber por número.
              </p>
            </div>
          </div>
          <div className="border-t pt-3">
            <WhatsAppTemplatesEditor />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
