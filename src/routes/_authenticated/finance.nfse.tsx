import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Loader2, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listNfse } from "@/lib/nfse.functions";
import { formatDateTime } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/finance/nfse")({
  head: () => ({ meta: [{ title: "NFS-e" }] }),
  component: NfseListPage,
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  processing: "secondary",
  issued: "default",
  error: "destructive",
  cancelled: "outline",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  processing: "Processando",
  issued: "Emitida",
  error: "Erro",
  cancelled: "Cancelada",
};

type NfseRow = {
  id: string;
  status: string;
  rps_number: string | null;
  nf_number: string | null;
  service_code: string | null;
  amount: number | null;
  pdf_url: string | null;
  xml_url: string | null;
  issued_at: string | null;
  created_at: string;
  error_message: string | null;
  customer_invoices?: { invoice_number: string | null; amount: number | null; currency: string | null; description: string | null } | null;
};

function NfseListPage() {
  const list = useServerFn(listNfse);
  const { data, isLoading } = useQuery({
    queryKey: ["nfse-invoices"],
    queryFn: () => list() as Promise<{ items: NfseRow[] }>,
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="NFS-e"
        description="Notas fiscais de serviço emitidas pela plataforma."
        actions={
          <Button asChild variant="outline">
            <Link to="/settings/nfse">Configurações</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" /> Últimas emissões
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma NFS-e emitida. Emita a partir de uma fatura em "Faturas".
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fatura</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Nº NF / RPS</TableHead>
                  <TableHead>Cód. serviço</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Emitida em</TableHead>
                  <TableHead className="text-right">Documentos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">
                      {n.customer_invoices?.invoice_number ?? "—"}
                      {n.customer_invoices?.description && (
                        <div className="text-xs text-muted-foreground truncate max-w-[240px]">
                          {n.customer_invoices.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[n.status] ?? "secondary"}>
                        {STATUS_LABEL[n.status] ?? n.status}
                      </Badge>
                      {n.error_message && (
                        <div className="text-xs text-destructive mt-1 max-w-[240px] truncate" title={n.error_message}>
                          {n.error_message}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {n.nf_number ?? n.rps_number ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{n.service_code ?? "—"}</TableCell>
                    <TableCell>
                      {n.amount != null
                        ? Number(n.amount).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {n.issued_at ? formatDateTime(n.issued_at) : formatDateTime(n.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {n.pdf_url && (
                          <Button size="sm" variant="ghost" asChild>
                            <a href={n.pdf_url} target="_blank" rel="noreferrer">
                              PDF <ExternalLink className="ml-1 h-3 w-3" />
                            </a>
                          </Button>
                        )}
                        {n.xml_url && (
                          <Button size="sm" variant="ghost" asChild>
                            <a href={n.xml_url} target="_blank" rel="noreferrer">
                              XML <ExternalLink className="ml-1 h-3 w-3" />
                            </a>
                          </Button>
                        )}
                        {!n.pdf_url && !n.xml_url && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
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
