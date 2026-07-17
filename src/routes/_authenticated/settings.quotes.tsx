import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listQuotes, deleteQuote } from "@/lib/quotes.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDateTime } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/settings/quotes")({
  component: QuotesPage,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicada",
  sent: "Enviada",
  accepted: "Aceita",
  declined: "Recusada",
  expired: "Expirada",
};

function QuotesPage() {
  const qc = useQueryClient();
  const list = useServerFn(listQuotes);
  const del = useServerFn(deleteQuote);
  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: () => list({}),
  });

  async function remove(id: string) {
    if (!confirm("Excluir esta cotação?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["quotes"] });
  }
  async function copyLink(token: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/quote/${token}`);
    toast.success("Link copiado.");
  }

  const total = quotes.length;
  const accepted = quotes.filter((q) => q.status === "accepted").length;
  const acceptedValue = quotes
    .filter((q) => q.status === "accepted")
    .reduce((s, q) => s + Number(q.total), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total emitidas" value={String(total)} />
        <Stat label="Aceitas" value={String(accepted)} />
        <Stat label="Valor aceito" value={formatCurrency(acceptedValue, "BRL")} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cotações</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : quotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma cotação. Crie a partir da aba "Cotações" em um negócio.
            </p>
          ) : (
            <div className="space-y-2">
              {quotes.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{q.title || q.number}</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {q.number}
                      </Badge>
                      <Badge
                        variant={
                          q.status === "accepted"
                            ? "default"
                            : q.status === "declined"
                              ? "destructive"
                              : q.status === "sent"
                                ? "secondary"
                                : "outline"
                        }
                      >
                        {STATUS_LABEL[q.status]}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDateTime(q.created_at)} · {formatCurrency(Number(q.total), q.currency)}
                      {q.view_count > 0 && ` · ${q.view_count} visualizações`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.open(`/quote/${q.public_token}`, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => copyLink(q.public_token)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(q.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
