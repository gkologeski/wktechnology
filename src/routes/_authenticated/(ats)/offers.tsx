// Página /offers — gerenciamento de cartas-proposta com integração eSign.
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { FileSignature, Send, X, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  listOffers,
  sendOffer,
  cancelOffer,
  deleteOffer,
} from "@/lib/ats/offers.functions";

export const Route = createFileRoute("/_authenticated/(ats)/offers")({
  component: OffersPage,
});

type OfferRow = {
  id: string;
  title: string;
  status: string;
  salary_amount: number | null;
  salary_currency: string;
  start_date: string | null;
  sent_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  created_at: string;
  esign_document_id: string | null;
  ats_candidates: { full_name: string; email: string | null } | null;
  ats_jobs: { title: string } | null;
};

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  sent: "secondary",
  signed: "default",
  declined: "destructive",
  cancelled: "outline",
};
const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviada",
  signed: "Assinada",
  declined: "Recusada",
  cancelled: "Cancelada",
};

function OffersPage() {
  const fetchAll = useServerFn(listOffers);
  const send = useServerFn(sendOffer);
  const cancel = useServerFn(cancelOffer);
  const del = useServerFn(deleteOffer);
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAll();
      setRows(data as OfferRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }, [fetchAll]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleSend = async (id: string) => {
    try {
      await send({ data: { id } });
      toast.success("Oferta enviada para assinatura");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar");
    }
  };
  const handleCancel = async (id: string) => {
    if (!confirm("Cancelar esta oferta?")) return;
    try {
      await cancel({ data: { id } });
      toast.success("Oferta cancelada");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };
  const handleDelete = async (id: string) => {
    if (!confirm("Excluir definitivamente?")) return;
    try {
      await del({ data: { id } });
      toast.success("Excluída");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FileSignature className="h-6 w-6" /> Ofertas
          </h1>
          <p className="text-sm text-muted-foreground">
            Cartas-proposta enviadas aos candidatos com assinatura eletrônica.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Todas as ofertas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma oferta ainda. Crie uma a partir da avaliação de um candidato.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidato</TableHead>
                  <TableHead>Vaga</TableHead>
                  <TableHead>Salário</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.ats_candidates?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.ats_candidates?.email}</div>
                    </TableCell>
                    <TableCell>{r.ats_jobs?.title ?? "—"}</TableCell>
                    <TableCell>
                      {r.salary_amount != null
                        ? `${r.salary_currency} ${r.salary_amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                        : "—"}
                    </TableCell>
                    <TableCell>{r.start_date ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[r.status] ?? "outline"}>
                        {statusLabel[r.status] ?? r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {r.status === "draft" && (
                        <Button size="sm" variant="default" onClick={() => handleSend(r.id)}>
                          <Send className="h-3.5 w-3.5 mr-1" /> Enviar
                        </Button>
                      )}
                      {r.status === "sent" && r.esign_document_id && (
                        <Button size="sm" variant="ghost" asChild>
                          <a href={`/sign-status/${r.esign_document_id}`} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      {(r.status === "draft" || r.status === "sent") && (
                        <Button size="sm" variant="outline" onClick={() => handleCancel(r.id)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
