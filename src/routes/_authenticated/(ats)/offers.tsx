// Página /offers — gerenciamento de cartas-proposta com integração eSign.
// Lote 5 do rollout UX/UI — segue Design Foundation TechHire.
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { FileSignature, Send, X, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader, EmptyState, Skeletons, MetaPill } from "@/components/techhire/ui";
import { listOffers, sendOffer, cancelOffer, deleteOffer } from "@/lib/ats/offers.functions";
import { useGridSelection, idQueryFor } from "@/components/grid/use-grid-selection";
import { GridBulkBar } from "@/components/grid/grid-bulk-bar";
import { usePermissions } from "@/lib/access-control/use-permissions";


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

const OFFER_STATUS: Record<string, { label: string; cls: string }> = {
  draft: {
    label: "Rascunho",
    cls: "border-border-default bg-surface-sunken text-text-secondary",
  },
  sent: {
    label: "Enviada",
    cls: "border-status-onhold/30 bg-status-onhold/10 text-status-onhold",
  },
  signed: {
    label: "Assinada",
    cls: "border-status-open/30 bg-status-open/10 text-status-open",
  },
  declined: {
    label: "Recusada",
    cls: "border-status-closed/30 bg-status-closed/10 text-status-closed",
  },
  cancelled: {
    label: "Cancelada",
    cls: "border-border-subtle bg-surface-sunken text-text-tertiary",
  },
};

function OfferStatusBadge({ status }: { status: string }) {
  const cfg = OFFER_STATUS[status] ?? OFFER_STATUS.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5",
        "text-[11px] font-medium leading-none whitespace-nowrap",
        cfg.cls,
      )}
    >
      {cfg.label}
    </span>
  );
}

function formatSalary(amount: number | null, currency: string) {
  if (amount == null) return "—";
  return `${currency} ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function OffersPage() {
  const fetchAll = useServerFn(listOffers);
  const send = useServerFn(sendOffer);
  const cancel = useServerFn(cancelOffer);
  const del = useServerFn(deleteOffer);
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { canAny } = usePermissions();
  const selection = useGridSelection(rows, { buildIdQuery: idQueryFor("ats_offers") });


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
    if (!(await confirmDialog("Cancelar esta oferta?"))) return;
    try {
      await cancel({ data: { id } });
      toast.success("Oferta cancelada");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };
  const handleDelete = async (id: string) => {
    if (!(await confirmDialog("Excluir definitivamente?"))) return;
    try {
      await del({ data: { id } });
      toast.success("Excluída");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  const description = loading
    ? "Carregando…"
    : `${rows.length} oferta${rows.length === 1 ? "" : "s"} · ${counts.sent ?? 0} enviadas · ${counts.signed ?? 0} assinadas`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="ATS" title="Ofertas" description={description} descriptionLive />

      {selection.hasSelection && (
        <GridBulkBar
          table="ats_offers"
          ids={selection.ids}
          rows={selection.selectedRows}
          entityLabel="oferta(s)"
          onClear={selection.clear}
          onDone={reload}
          totalMatching={rows.length}
          onSelectAll={selection.selectAllMatching}
          isSelectingAll={selection.isSelectingAll}
          canUpdate={canAny([
            "techhire.offers.update.workspace",
            "techhire.offers.update.own",
          ])}
          canDelete={canAny([
            "techhire.offers.delete.workspace",
            "techhire.offers.delete.own",
          ])}
        />
      )}

      {loading ? (
        <div className="rounded-lg border border-border-subtle bg-surface-1 p-2 shadow-xs">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeletons.Row key={i} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title="Nenhuma oferta ainda"
          description="Crie uma oferta a partir da avaliação de um candidato no detalhe da vaga."
        />
      ) : (
        <section className="overflow-hidden rounded-lg border border-border-subtle bg-surface-1 shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-2/60">
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Selecionar todas da página"
                    checked={
                      selection.allOnPageSelected
                        ? true
                        : selection.someOnPageSelected
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={selection.toggleAllOnPage}
                  />
                </TableHead>
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
                <TableRow
                  key={r.id}
                  className="group"
                  data-state={selection.isSelected(r.id) ? "selected" : undefined}
                >
                  <TableCell>
                    <Checkbox
                      aria-label="Selecionar oferta"
                      checked={selection.isSelected(r.id)}
                      onCheckedChange={() => selection.toggleOne(r.id)}
                    />
                  </TableCell>

                  <TableCell>
                    <div className="font-medium text-text-primary">
                      {r.ats_candidates?.full_name ?? "—"}
                    </div>
                    {r.ats_candidates?.email && (
                      <div className="text-xs text-text-tertiary">{r.ats_candidates.email}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-text-secondary">
                    {r.ats_jobs?.title ?? "—"}
                  </TableCell>
                  <TableCell>
                    <MetaPill>{formatSalary(r.salary_amount, r.salary_currency)}</MetaPill>
                  </TableCell>
                  <TableCell className="text-sm text-text-secondary tabular-nums">
                    {r.start_date ?? "—"}
                  </TableCell>
                  <TableCell>
                    <OfferStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      {r.status === "draft" && (
                        <Button size="sm" variant="default" onClick={() => handleSend(r.id)}>
                          <Send className="h-3.5 w-3.5 mr-1" />
                          Enviar
                        </Button>
                      )}
                      {r.status === "sent" && r.esign_document_id && (
                        <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                          <a
                            href={`/sign-status/${r.esign_document_id}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Abrir status da assinatura"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      {(r.status === "draft" || r.status === "sent") && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleCancel(r.id)}
                          aria-label="Cancelar oferta"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={() => handleDelete(r.id)}
                        aria-label="Excluir oferta"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </div>
  );
}
