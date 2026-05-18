import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, MessageCircle, Phone, Settings as SettingsIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listWhatsAppConversations,
  listWhatsAppMessages,
  sendWhatsAppMessage,
  markWhatsAppRead,
  getWhatsAppConfig,
  saveWhatsAppConfig,
} from "@/lib/whatsapp.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/crm";
import { SendWhatsAppDialog } from "@/components/whatsapp/send-whatsapp-dialog";
import { WhatsAppTemplatesEditor } from "@/components/whatsapp/whatsapp-templates-editor";

export const Route = createFileRoute("/_authenticated/inbox/whatsapp")({
  component: WhatsAppInbox,
});

function WhatsAppInbox() {
  const qc = useQueryClient();
  const listFn = useServerFn(listWhatsAppConversations);
  const msgsFn = useServerFn(listWhatsAppMessages);
  const sendFn = useServerFn(sendWhatsAppMessage);
  const markFn = useServerFn(markWhatsAppRead);

  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const conversationsQ = useQuery({ queryKey: ["wa", "conversations"], queryFn: () => listFn() });
  const messagesQ = useQuery({
    queryKey: ["wa", "messages", selected],
    queryFn: () => msgsFn({ data: { conversationId: selected! } }),
    enabled: !!selected,
  });

  // Realtime: nova mensagem entra -> refetch
  useEffect(() => {
    const channel = supabase
      .channel("wa-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["wa", "messages"] });
        qc.invalidateQueries({ queryKey: ["wa", "conversations"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations" }, () => {
        qc.invalidateQueries({ queryKey: ["wa", "conversations"] });
      })
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
    mutationFn: (input: { to: string; body: string; contactId?: string }) => sendFn({ data: input }),
    onSuccess: (res) => {
      toast.success("Mensagem enviada");
      setDraft("");
      setComposeBody("");
      setComposeTo("");
      setComposeOpen(false);
      setSelected(res.conversationId);
      qc.invalidateQueries({ queryKey: ["wa"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const conversations = conversationsQ.data ?? [];
  const messages = messagesQ.data ?? [];
  const current = useMemo(() => conversations.find((c) => c.id === selected), [conversations, selected]);

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
          <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
            <DialogTrigger asChild>
              <Button>
                <MessageCircle className="mr-2 h-4 w-4" /> Nova conversa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Enviar WhatsApp</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Para (E.164, ex: +5511999999999)</label>
                  <Input value={composeTo} onChange={(e) => setComposeTo(e.target.value)} placeholder="+5511..." />
                </div>
                <div>
                  <label className="text-sm font-medium">Mensagem</label>
                  <Textarea value={composeBody} onChange={(e) => setComposeBody(e.target.value)} rows={4} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    No sandbox, o destinatário precisa primeiro enviar o "join &lt;código&gt;" ao número da Twilio.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => sendMut.mutate({ to: composeTo, body: composeBody })}
                  disabled={!composeTo || !composeBody || sendMut.isPending}
                >
                  <Send className="mr-2 h-4 w-4" /> Enviar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-[320px_1fr] gap-3 overflow-hidden">
        {/* Lista de conversas */}
        <Card className="flex flex-col overflow-hidden">
          <div className="border-b p-3 text-sm font-medium">
            Conversas <span className="text-muted-foreground">({conversations.length})</span>
          </div>
          <ScrollArea className="flex-1">
            {conversationsQ.isLoading && <div className="p-4 text-sm text-muted-foreground">Carregando…</div>}
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
                  {c.unread_count > 0 && <Badge variant="default">{c.unread_count}</Badge>}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {c.last_message_preview || "—"}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {c.last_message_at ? formatDateTime(c.last_message_at) : ""}
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
              <div className="border-b p-3">
                <div className="text-sm font-medium">{current.contact_phone}</div>
                <div className="text-xs text-muted-foreground">via {current.twilio_number}</div>
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
                          <a href={m.media_url} target="_blank" rel="noreferrer" className="mb-1 block underline">
                            [mídia]
                          </a>
                        )}
                        <div className="whitespace-pre-wrap">{m.body}</div>
                        <div className="mt-1 text-[10px] opacity-70">
                          {formatDateTime(m.created_at)} · {m.status}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>
              <div className="border-t p-3">
                <div className="flex gap-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Escreva uma mensagem…"
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        if (draft.trim())
                          sendMut.mutate({ to: current.contact_phone, body: draft, contactId: current.contact_id ?? undefined });
                      }
                    }}
                  />
                  <Button
                    onClick={() =>
                      sendMut.mutate({
                        to: current.contact_phone,
                        body: draft,
                        contactId: current.contact_id ?? undefined,
                      })
                    }
                    disabled={!draft.trim() || sendMut.isPending}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">Ctrl/Cmd + Enter para enviar</p>
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
  const cfgQ = useQuery({ queryKey: ["wa", "config"], queryFn: () => getCfg(), enabled: open });
  useEffect(() => {
    if (cfgQ.data) setFrom(cfgQ.data.from_number || "");
  }, [cfgQ.data]);
  const saveMut = useMutation({
    mutationFn: () => saveCfg({ data: { from_number: from } }),
    onSuccess: () => {
      toast.success("Configuração salva");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["wa", "config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <SettingsIcon className="mr-2 h-4 w-4" /> Configurar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Número Twilio WhatsApp</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">From (E.164)</label>
            <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="+14155238886 (sandbox)" />
            <p className="mt-1 text-xs text-muted-foreground">
              Deixe vazio para usar o sandbox padrão da Twilio (+14155238886). Para produção, cole o número aprovado para WhatsApp Business.
            </p>
          </div>
          <div className="rounded-md border bg-muted/40 p-3 text-xs">
            <div className="font-medium">Webhook inbound</div>
            <code className="break-all">{typeof window !== "undefined" ? window.location.origin : ""}/api/public/hooks/twilio-whatsapp</code>
            <p className="mt-1 text-muted-foreground">
              Cole essa URL em Twilio Console → Messaging → Sandbox (ou Sender) em "When a message comes in" (POST).
            </p>
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
