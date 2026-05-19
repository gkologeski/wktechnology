import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, SkipForward, ArrowLeft, Phone, Mail, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { getQueueWithItems, updateQueueItem } from "@/lib/task-queues.functions";
import { SendEmailDialog } from "@/components/email/send-email-dialog";

export const Route = createFileRoute("/_authenticated/tasks/queues/$queueId/play")({
  component: PlayQueue,
});

function PlayQueue() {
  const { queueId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(getQueueWithItems);
  const updateFn = useServerFn(updateQueueItem);
  const q = useQuery({
    queryKey: ["task_queue", queueId],
    queryFn: () => getFn({ data: { queue_id: queueId } }),
  });
  const [notes, setNotes] = useState("");

  const pending = useMemo(
    () => (q.data?.items ?? []).filter((i) => !i.completed_at && !i.skipped_at),
    [q.data],
  );
  const current = pending[0];
  const idx = useMemo(
    () => (q.data?.items ?? []).findIndex((i) => i.id === current?.id),
    [q.data, current],
  );

  useEffect(() => {
    setNotes(current?.notes ?? "");
  }, [current?.id]);

  const action = useMutation({
    mutationFn: (a: "complete" | "skip") =>
      updateFn({ data: { id: current!.id, action: a, notes } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task_queue", queueId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!current) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (e.key === "c" || e.key === "C") action.mutate("complete");
      if (e.key === "s" || e.key === "S") action.mutate("skip");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, action]);

  if (q.isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (!q.data) return null;

  const subject = displayName(current);
  const email = current?.contact?.email ?? current?.lead?.email ?? "";
  const phone = current?.contact?.phone ?? current?.lead?.phone ?? "";

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => nav({ to: "/tasks/queues" })}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
        <div className="text-sm text-muted-foreground">
          <ListChecks className="mr-1 inline h-4 w-4" />
          {q.data.queue.name} · {pending.length} pendentes
        </div>
      </div>

      {!current ? (
        <Card>
          <CardContent className="pt-8 text-center space-y-2">
            <p className="text-lg font-medium">Fila concluída 🎉</p>
            <p className="text-sm text-muted-foreground">Todos os itens foram tratados.</p>
            <Button asChild variant="outline">
              <Link to="/tasks/queues">Voltar para filas</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Item {idx + 1} de {q.data.items.length}</div>
                <h2 className="text-xl font-semibold">{subject}</h2>
                {email && <div className="text-sm text-muted-foreground">{email}</div>}
                {phone && <div className="text-sm text-muted-foreground">{phone}</div>}
              </div>
              <div className="flex flex-col gap-2">
                {current.contact_id && (
                  <Badge variant="secondary">Contato</Badge>
                )}
                {current.lead_id && (
                  <Badge variant="secondary">
                    <Link to="/leads/$id" params={{ id: current.lead_id }}>Abrir lead →</Link>
                  </Badge>
                )}
                {current.deal_id && <Badge variant="secondary">Deal</Badge>}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {email && (
                <SendEmailDialog
                  defaultTo={email}
                  contactId={current.contact_id ?? undefined}
                  leadId={current.lead_id ?? undefined}
                  dealId={current.deal_id ?? undefined}
                  contactName={subject}
                  trigger={
                    <Button variant="outline" size="sm">
                      <Mail className="mr-1 h-4 w-4" /> Email
                    </Button>
                  }
                />
              )}
              {phone && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`tel:${phone}`}>
                    <Phone className="mr-1 h-4 w-4" /> Ligar
                  </a>
                </Button>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Anotações</label>
              <Textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="O que aconteceu nesse contato?"
              />
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => action.mutate("skip")} disabled={action.isPending}>
                <SkipForward className="mr-1 h-4 w-4" /> Pular (S)
              </Button>
              <Button onClick={() => action.mutate("complete")} disabled={action.isPending}>
                <Check className="mr-1 h-4 w-4" /> Concluir (C)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type QueueData = Awaited<ReturnType<typeof getQueueWithItems>>;
type HydratedItem = QueueData["items"][number];

function displayName(item: HydratedItem | undefined): string {
  if (!item) return "";
  if (item.contact) return `${item.contact.first_name ?? ""} ${item.contact.last_name ?? ""}`.trim();
  if (item.lead)
    return (
      `${item.lead.first_name ?? ""} ${item.lead.last_name ?? ""}`.trim() ||
      item.lead.company_name ||
      "Lead"
    );
  if (item.deal) return item.deal.name;
  return "Item";
}
