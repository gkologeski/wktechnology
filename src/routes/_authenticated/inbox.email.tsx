import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import DOMPurify from "dompurify";
import { Mail, RefreshCw, Reply, Eye, MousePointerClick, Paperclip } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { listEmailThreads, getEmailThread } from "@/lib/email-inbox.functions";
import { syncMyEmailAccounts } from "@/lib/gmail-sync.functions";
import { SendEmailDialog } from "@/components/email/send-email-dialog";
import { formatDateTime } from "@/lib/crm";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/inbox/email")({
  component: EmailInbox,
});

function EmailInbox() {
  const qc = useQueryClient();
  const listFn = useServerFn(listEmailThreads);
  const getFn = useServerFn(getEmailThread);
  const syncFn = useServerFn(syncMyEmailAccounts);

  const [selected, setSelected] = useState<string | null>(null);

  const threadsQ = useQuery({
    queryKey: ["email_threads"],
    queryFn: () => listFn(),
  });
  const threadQ = useQuery({
    queryKey: ["email_thread", selected],
    queryFn: () => getFn({ data: { thread_id: selected! } }),
    enabled: !!selected,
  });

  const threads = threadsQ.data?.items ?? [];
  const current = threadQ.data;

  async function handleSync() {
    try {
      const r = await syncFn({ data: {} });
      const inserted = r.results.reduce((a, x) => a + x.inserted, 0);
      toast.success(inserted ? `${inserted} mensagem(ns) novas` : "Sem novidades");
      qc.invalidateQueries({ queryKey: ["email_threads"] });
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
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inbox Email</h1>
          <p className="text-sm text-muted-foreground">
            Threads sincronizadas via Gmail. Sincronização automática a cada 1 min.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSync}>
            <RefreshCw className="mr-2 h-4 w-4" /> Sincronizar
          </Button>
          <SendEmailDialog
            trigger={
              <Button>
                <Mail className="mr-2 h-4 w-4" /> Novo email
              </Button>
            }
          />
        </div>
      </div>

      <div className="grid flex-1 grid-cols-[320px_1fr] gap-3 overflow-hidden">
        <Card className="flex flex-col overflow-hidden">
          <div className="border-b p-2 text-xs text-muted-foreground">
            {threads.length} thread(s)
          </div>
          <ScrollArea className="flex-1">
            {threadsQ.isLoading && (
              <div className="p-4 text-sm text-muted-foreground">Carregando…</div>
            )}
            {!threadsQ.isLoading && threads.length === 0 && (
              <div className="space-y-2 p-4 text-sm text-muted-foreground">
                Nenhuma thread ainda. Conecte uma conta Gmail em{" "}
                <Link to="/settings/email" className="underline">
                  Configurações
                </Link>{" "}
                e clique em <b>Sincronizar</b>.
              </div>
            )}
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={`flex w-full flex-col gap-1 border-b p-3 text-left transition hover:bg-muted/50 ${
                  selected === t.id ? "bg-muted" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {t.subject || "(sem assunto)"}
                  </span>
                  {t.message_count > 1 && (
                    <Badge variant="outline" className="text-[10px]">
                      {t.message_count}
                    </Badge>
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">{t.snippet || "—"}</div>
                <div className="text-[10px] text-muted-foreground">
                  {t.last_message_at ? formatDateTime(t.last_message_at) : ""}
                </div>
              </button>
            ))}
          </ScrollArea>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          {!current ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Selecione uma thread
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {current.thread.subject || "(sem assunto)"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {current.messages.length} mensagem(ns)
                  </div>
                </div>
                <SendEmailDialog
                  threadId={current.thread.id}
                  defaultTo={lastMsg?.from_email ?? ""}
                  trigger={
                    <Button size="sm" variant="outline">
                      <Reply className="mr-2 h-4 w-4" /> Responder
                    </Button>
                  }
                />
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {current.messages.map((m) => (
                    <MessageCard key={m.id} message={m} />
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </Card>
      </div>
    </div>
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
    <div
      className={`rounded-md border p-3 text-sm ${
        isOut ? "border-primary/30 bg-primary/5" : "bg-card"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div>
          <span className="font-medium">{m.from_name || m.from_email || "—"}</span>
          <span className="text-muted-foreground"> → {(m.to_emails ?? []).join(", ")}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          {isOut && (m.open_count ?? 0) > 0 && (
            <Badge variant="outline" className="gap-1">
              <Eye className="h-3 w-3" /> {m.open_count}
            </Badge>
          )}
          {isOut && (m.click_count ?? 0) > 0 && (
            <Badge variant="outline" className="gap-1">
              <MousePointerClick className="h-3 w-3" /> {m.click_count}
            </Badge>
          )}
          {m.has_attachments && <Paperclip className="h-3 w-3" />}
          <span>{formatDateTime((m.sent_at ?? m.received_at ?? m.created_at) as string)}</span>
        </div>
      </div>
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
    </div>
  );
}
