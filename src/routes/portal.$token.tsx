import { formatDateTime } from "@/lib/crm";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getPortalSession, listPortalTickets, createPortalTicket } from "@/lib/portal.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, LifeBuoy } from "lucide-react";

export const Route = createFileRoute("/portal/$token")({
  component: PortalPage,
});

const STATUS_LABEL: Record<string, string> = {
  new: "Novo",
  open: "Aberto",
  waiting: "Aguardando",
  resolved: "Resolvido",
  closed: "Fechado",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  new: "default",
  open: "default",
  waiting: "secondary",
  resolved: "outline",
  closed: "outline",
};
const PRIORITY_LABEL: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

function PortalPage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const fetchSession = useServerFn(getPortalSession);
  const fetchTickets = useServerFn(listPortalTickets);
  const create = useServerFn(createPortalTicket);

  const session = useQuery({
    queryKey: ["portal-session", token],
    queryFn: () => fetchSession({ data: { token } }),
  });
  const tickets = useQuery({
    queryKey: ["portal-tickets", token],
    queryFn: () => fetchTickets({ data: { token } }),
    enabled: !!session.data,
  });

  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");

  const mutation = useMutation({
    mutationFn: () =>
      create({ data: { token, subject, description: description || undefined, priority } }),
    onSuccess: () => {
      toast.success("Solicitação enviada!");
      setOpen(false);
      setSubject("");
      setDescription("");
      setPriority("medium");
      qc.invalidateQueries({ queryKey: ["portal-tickets", token] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar solicitação."),
  });

  if (session.isLoading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">Carregando…</div>
    );
  }
  if (session.error) {
    return (
      <div className="min-h-screen grid place-items-center text-destructive">
        {(session.error as Error).message}
      </div>
    );
  }

  const contact = session.data!.contact;
  const list = tickets.data ?? [];

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-primary" />
            <div>
              <h1 className="font-semibold">Portal do cliente</h1>
              <p className="text-xs text-muted-foreground">
                Olá, {contact.first_name}
                {contact.last_name ? ` ${contact.last_name}` : ""}
              </p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Nova solicitação
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova solicitação</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Assunto *</label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Resuma sua solicitação"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Descrição</label>
                  <Textarea
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detalhe o que aconteceu"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Prioridade</label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["low", "medium", "high", "urgent"] as const).map((p) => (
                        <SelectItem key={p} value={p}>
                          {PRIORITY_LABEL[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => mutation.mutate()}
                  disabled={!subject.trim() || mutation.isPending}
                >
                  {mutation.isPending ? "Enviando…" : "Enviar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Suas solicitações</h2>
        {tickets.isLoading ? (
          <p className="text-muted-foreground text-sm">Carregando…</p>
        ) : list.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              Você ainda não tem solicitações.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {list.map((t) => (
              <Card key={t.id}>
                <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2 space-y-0">
                  <CardTitle className="text-base">{t.subject}</CardTitle>
                  <div className="flex gap-1.5 shrink-0">
                    <Badge variant={STATUS_VARIANT[t.status] ?? "secondary"}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </Badge>
                    <Badge variant="outline">{PRIORITY_LABEL[t.priority] ?? t.priority}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {t.description && <p className="text-sm whitespace-pre-wrap">{t.description}</p>}
                  <p className="text-xs text-muted-foreground">
                    Aberto em {formatDateTime(t.created_at)}
                    {t.resolved_at && ` • Resolvido em ${formatDateTime(t.resolved_at)}`}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
