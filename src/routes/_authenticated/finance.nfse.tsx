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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LegalEntitySelect,
  useLegalEntityFilter,
  useLegalEntityFilterInput,
} from "@/components/finance/legal-entity-select";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { ViewModeToggle } from "@/components/kanban/view-mode-toggle";

const NFSE_STATUSES = ["pending", "processing", "issued", "error", "cancelled"] as const;
type NfseStatus = (typeof NFSE_STATUSES)[number];

export const Route = createFileRoute("/_authenticated/finance/nfse")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { view: "table" | "kanban"; status: NfseStatus | "all" } => ({
    view: search.view === "kanban" ? "kanban" : "table",
    status: NFSE_STATUSES.includes(search.status as NfseStatus)
      ? (search.status as NfseStatus)
      : "all",
  }),
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

// Status vem do provedor fiscal — o quadro é somente leitura.
const STATUS_DOT: Record<string, string> = {
  pending: "bg-muted-foreground/40",
  processing: "bg-amber-500",
  issued: "bg-emerald-500",
  error: "bg-destructive",
  cancelled: "bg-muted-foreground/40",
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
  customer_invoices?: {
    invoice_number: string | null;
    amount: number | null;
    currency: string | null;
    description: string | null;
  } | null;
};

function NfseListPage() {
  const list = useServerFn(listNfse);
  const [legalEntityId, setLegalEntityId] = useLegalEntityFilter();
  const filterInput = useLegalEntityFilterInput(legalEntityId);
  const { view, status } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["nfse-invoices", legalEntityId, JSON.stringify(filterInput)],
    queryFn: () => list({ data: filterInput }) as Promise<{ items: NfseRow[] }>,
  });

  const allItems = data?.items ?? [];
  const items = status === "all" ? allItems : allItems.filter((n) => n.status === status);

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="NFS-e"
        description="Notas fiscais de serviço emitidas pela plataforma."
        actions={
          <div className="flex flex-wrap gap-2">
            <Select
              value={status}
              onValueChange={(v) =>
                void navigate({ to: ".", search: (prev) => ({ ...prev, status: v as NfseStatus }) })
              }
            >
              <SelectTrigger className="w-[180px]" aria-label="Filtrar por status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {NFSE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <LegalEntitySelect value={legalEntityId} onChange={setLegalEntityId} />
            <ViewModeToggle
              value={view}
              onChange={(v) => void navigate({ to: ".", search: (prev) => ({ ...prev, view: v }) })}
            />
            <Button asChild variant="outline">
              <Link to="/settings/nfse">Configurações</Link>
            </Button>
          </div>
        }
      />

      {view === "kanban" && (
        <KanbanBoard
          rows={items}
          table="nfse_invoices"
          stageField="status"
          selectable
          bulkEditFields={[{ name: "service_code", label: "Código de serviço", type: "text" }]}
          entityLabel="NFS-e"
          canDelete={false}
          readOnly
          isLoading={isLoading}
          error={error}
          ariaLabel="Quadro de NFS-e por status"
          columns={NFSE_STATUSES.map((s) => ({
            value: s,
            label: STATUS_LABEL[s] ?? s,
            tone: STATUS_DOT[s],
          }))}
          emptyState={
            <p className="p-12 text-center text-sm text-muted-foreground">
              Nenhuma NFS-e emitida. Emita a partir de uma fatura em "Faturas".
            </p>
          }
          renderCard={(n) => (
            <div className="space-y-1.5">
              <p className="pr-6 text-sm font-medium">
                {n.customer_invoices?.invoice_number ?? "Sem fatura"}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {n.nf_number ?? n.rps_number ?? "—"}
              </p>
              <div className="flex items-center justify-between text-xs">
                <span className="tabular-nums font-medium text-foreground">
                  {n.amount != null
                    ? Number(n.amount).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })
                    : "—"}
                </span>
                <span className="text-muted-foreground">
                  {formatDateTime(n.issued_at ?? n.created_at).split(" ")[0]}
                </span>
              </div>
              {n.error_message && (
                <p className="truncate text-xs text-destructive" title={n.error_message}>
                  {n.error_message}
                </p>
              )}
            </div>
          )}
        />
      )}

      {view === "table" && (
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
                          <div
                            className="text-xs text-destructive mt-1 max-w-[240px] truncate"
                            title={n.error_message}
                          >
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
      )}
    </div>
  );
}
