import { GridBulkBar } from "@/components/grid/grid-bulk-bar";
import { OfferTermsEditor } from "@/components/ats/offer-terms-editor";
// Página /offers — gerenciamento de cartas-proposta com integração eSign.
// Lote 5 do rollout UX/UI — segue Design Foundation TechHire.
import { createFileRoute } from "@tanstack/react-router";
import { GridListToolbar } from "@/components/grid/grid-list-toolbar";
import { SortableTableHead } from "@/components/grid/sortable-table-head";
import { useClientSort } from "@/lib/grid-client-sort";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { FileSignature, Send, X, Trash2 } from "lucide-react";
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
import {
  listOffers,
  sendOffer,
  cancelOffer,
  deleteOffer,
  reviewOffer,
  type OfferListRow,
  getOfferLink,
} from "@/lib/ats/offers.functions";
import { useGridSelection, idQueryFor } from "@/components/grid/use-grid-selection";
import { HrScreenAccess, HrAccessError } from "@/components/hr-access";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { ViewModeToggle } from "@/components/kanban/view-mode-toggle";

export const Route = createFileRoute("/_authenticated/(ats)/offers")({
  validateSearch: (search: Record<string, unknown>): { view?: "table" | "kanban" } => ({
    view: search.view === "kanban" ? "kanban" : "table",
  }),
  component: OffersPage,
});

type OfferRow = OfferListRow;

const OFFER_STATUS: Record<string, { label: string; cls: string }> = {
  draft: {
    label: "Rascunho",
    cls: "border-border-default bg-surface-sunken text-text-secondary",
  },
  sent: {
    label: "Para assinatura",
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

// Colunas do kanban de leitura: o status da oferta é conduzido pelo fluxo de
// assinatura eletrônica (enviar/cancelar/assinar), então não há drag-and-drop.
const OFFER_KANBAN_COLUMNS = [
  { value: "draft", label: "Rascunho", tone: "bg-muted-foreground/40" },
  { value: "sent", label: "Para assinatura", tone: "bg-status-onhold" },
  { value: "signed", label: "Assinada", tone: "bg-status-open" },
  { value: "declined", label: "Recusada", tone: "bg-status-closed" },
  { value: "cancelled", label: "Cancelada", tone: "bg-border-subtle" },
];

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
  const p = usePermissions();
  return (
    <HrScreenAccess resources={["techhire.offers"]}>
      <OffersContent key={`${p.workspaceId}:${[...p.permissions].sort().join("|")}`} />
    </HrScreenAccess>
  );
}
function OffersContent() {
  const fetchAll = useServerFn(listOffers);
  const send = useServerFn(sendOffer);
  const cancel = useServerFn(cancelOffer);
  const del = useServerFn(deleteOffer);
  const review = useServerFn(reviewOffer);
  const fetchLink = useServerFn(getOfferLink);
  const [reviewing, setReviewing] = useState<OfferRow | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { can } = usePermissions();
  const selection = useGridSelection(rows, { buildIdQuery: idQueryFor("ats_offers") });
  const {
    sorted: sortedRows,
    sort,
    toggle,
    grid: sortGrid,
  } = useClientSort(rows, {
    candidate: (r) => r.ats_candidates?.full_name,
    job: (r) => r.ats_jobs?.title,
    salary: (r) => (r.salary_amount == null ? null : Number(r.salary_amount)),
    start: (r) => r.start_date,
    status: (r) => r.status,
  });

  const view = Route.useSearch().view ?? "table";
  const navigate = Route.useNavigate();
  const setView = (v: "table" | "kanban") =>
    void navigate({ to: ".", search: (prev) => ({ ...prev, view: v }) });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAll();
      setRows(data as OfferRow[]);
      setFailed(false);
    } catch (e) {
      setRows([]);
      setFailed(true);
      toast.error(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }, [fetchAll]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleSend = async (row: OfferRow) => {
    try {
      await send({ data: { id: row.id, revision: row.revision } });
      toast.success(
        "Oferta disponível para assinatura. O envio por e-mail deve ser realizado pelo canal configurado.",
      );
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar");
    }
  };
  const handleCancel = async (row: OfferRow) => {
    if (!(await confirmDialog("Cancelar esta oferta?"))) return;
    try {
      await cancel({ data: { id: row.id, revision: row.revision } });
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
    : `${rows.length} oferta${rows.length === 1 ? "" : "s"} · ${counts.sent ?? 0} para assinatura · ${counts.signed ?? 0} assinadas`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="ATS"
        title="Ofertas"
        description={description}
        descriptionLive
        secondaryActions={<ViewModeToggle value={view} onChange={setView} />}
      />

      {view === "table" && selection.hasSelection && (
        <GridBulkBar
          table="ats_offers"
          ids={selection.ids}
          rows={selection.selectedRows}
          entityLabel="rascunho(s) de oferta"
          onClear={selection.clear}
          onDone={reload}
          totalMatching={rows.length}
          onSelectAll={selection.selectAllMatching}
          isSelectingAll={selection.isSelectingAll}
          canUpdate={false}
          canDelete={
            selection.selectedRows.length === selection.ids.length &&
            selection.selectedRows.every(
              (r) => r.can_delete && r.status === "draft" && r.approval_status === "not_requested",
            )
          }
        />
      )}
      {reviewing && (
        <Dialog open onOpenChange={(open) => !open && !busy && setReviewing(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Revisar oferta — versão {reviewing.revision}</DialogTitle>
            </DialogHeader>
            <p>
              {reviewing.ats_candidates?.full_name} · {reviewing.ats_jobs?.title}
            </p>
            {reviewing.can_view_terms ? (
              <>
                <p>
                  {formatSalary(reviewing.salary_amount, reviewing.salary_currency ?? "BRL")} ·
                  Início: {reviewing.start_date ?? "Não definido"}
                </p>
                <article className="max-h-72 overflow-auto whitespace-pre-wrap rounded border p-4">
                  {reviewing.body}
                </article>
                {reviewing.can_edit_terms && (
                  <OfferTermsEditor
                    offer={reviewing}
                    onSaved={() => {
                      setReviewing(null);
                      void reload();
                    }}
                  />
                )}
                {reviewing.approval_note && <p>Parecer anterior: {reviewing.approval_note}</p>}
                <Textarea
                  aria-label="Parecer da aprovação"
                  placeholder="Parecer (opcional)"
                  maxLength={2000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </>
            ) : (
              <p>Sem permissão para consultar condições.</p>
            )}
            <div className="flex justify-end gap-2">
              {reviewing.can_approve &&
                reviewing.approval_status === "pending" &&
                (["reject", "approve"] as const).map((action) => (
                  <Button
                    key={action}
                    disabled={busy}
                    variant={action === "approve" ? "default" : "outline"}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await review({
                          data: { id: reviewing.id, revision: reviewing.revision, action, note },
                        });
                        setReviewing(null);
                        await reload();
                        toast.success(
                          action === "approve"
                            ? "Versão aprovada"
                            : "Oferta devolvida para revisão",
                        );
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Falha na aprovação");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {action === "approve" ? "Aprovar versão" : "Reprovar"}
                  </Button>
                ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
      {failed && <HrAccessError retry={() => void reload()} />}

      {view === "kanban" ? (
        <KanbanBoard
          rows={rows}
          table="ats_offers"
          stageField="status"
          selectable
          entityLabel="oferta"
          canDelete={false}
          readOnly
          isLoading={loading}
          ariaLabel="Quadro de ofertas"
          columns={OFFER_KANBAN_COLUMNS}
          emptyState={
            <EmptyState
              icon={FileSignature}
              title="Nenhuma oferta ainda"
              description="Crie uma oferta a partir da avaliação de um candidato no detalhe da vaga."
            />
          }
          renderCard={(r) => (
            <div className="space-y-1">
              <p className="text-sm font-medium leading-snug text-text-primary">
                {r.ats_candidates?.full_name ?? "—"}
              </p>
              <p className="text-xs text-text-tertiary">{r.ats_jobs?.title ?? "—"}</p>
              <div className="flex items-center justify-between pt-1">
                <MetaPill>
                  {r.can_view_terms
                    ? formatSalary(r.salary_amount, r.salary_currency ?? "BRL")
                    : "Restrito"}
                </MetaPill>
                <span className="text-xs text-text-tertiary tabular-nums">
                  {r.start_date?.split("-").reverse().join("/") ?? "—"}
                </span>
              </div>
            </div>
          )}
        />
      ) : loading ? (
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
          <GridListToolbar
            canExport={can("techhire.offers.export.workspace")}
            exportValue={{ status: (r) => OFFER_STATUS[r.status]?.label ?? r.status }}
            grid={sortGrid}
            filename="ofertas"
            labels={{
              candidate: "Candidato",
              job: "Vaga",
              salary: "Salário",
              start: "Início",
              status: "Status",
            }}
          />
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
                <SortableTableHead
                  label="Candidato"
                  active={sort?.key === "candidate"}
                  dir={sort?.dir}
                  onSort={() => toggle("candidate")}
                />
                <SortableTableHead
                  label="Vaga"
                  active={sort?.key === "job"}
                  dir={sort?.dir}
                  onSort={() => toggle("job")}
                />
                <SortableTableHead
                  label="Salário"
                  active={sort?.key === "salary"}
                  dir={sort?.dir}
                  onSort={() => toggle("salary")}
                />
                <SortableTableHead
                  label="Início"
                  active={sort?.key === "start"}
                  dir={sort?.dir}
                  onSort={() => toggle("start")}
                />
                <SortableTableHead
                  label="Status"
                  active={sort?.key === "status"}
                  dir={sort?.dir}
                  onSort={() => toggle("status")}
                />
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((r) => (
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
                    <p className="text-xs text-text-secondary">
                      {r.title} · versão {r.revision}
                    </p>
                    {r.ats_candidates?.email && (
                      <div className="text-xs text-text-tertiary">{r.ats_candidates.email}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-text-secondary">
                    {r.ats_jobs?.title ?? "—"}
                  </TableCell>
                  <TableCell>
                    <MetaPill>
                      {r.can_view_terms
                        ? formatSalary(r.salary_amount, r.salary_currency ?? "BRL")
                        : "Restrito"}
                    </MetaPill>
                  </TableCell>
                  <TableCell className="text-sm text-text-secondary tabular-nums">
                    {r.start_date?.split("-").reverse().join("/") ?? "—"}
                  </TableCell>
                  <TableCell>
                    <OfferStatusBadge status={r.status} />
                    {r.status === "draft" && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {
                          {
                            not_requested: "Aprovação não solicitada",
                            pending: "Aguardando aprovação",
                            approved: "Versão aprovada",
                            rejected: "Reprovada — revisar condições",
                          }[r.approval_status]
                        }
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      {r.can_view_terms && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setNote("");
                            setReviewing(r);
                          }}
                        >
                          Revisar
                        </Button>
                      )}
                      {r.status === "draft" &&
                        r.can_request &&
                        ["not_requested", "rejected"].includes(r.approval_status) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                await review({
                                  data: { id: r.id, revision: r.revision, action: "request" },
                                });
                                await reload();
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : "Falha");
                              }
                            }}
                          >
                            Solicitar aprovação
                          </Button>
                        )}
                      {r.status === "draft" && r.can_send && r.approval_status === "approved" && (
                        <Button size="sm" variant="default" onClick={() => handleSend(r)}>
                          <Send className="h-3.5 w-3.5 mr-1" />
                          Disponibilizar para assinatura
                        </Button>
                      )}
                      {r.can_send && ["sent", "signed"].includes(r.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              const token = await fetchLink({ data: { id: r.id } });
                              await navigator.clipboard.writeText(
                                `${window.location.origin}/offer/${token}`,
                              );
                              toast.success("Link da oferta copiado");
                            } catch (e) {
                              toast.error(
                                e instanceof Error ? e.message : "Não foi possível copiar",
                              );
                            }
                          }}
                        >
                          Copiar link
                        </Button>
                      )}
                      {r.can_cancel && (r.status === "draft" || r.status === "sent") && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleCancel(r)}
                          aria-label="Cancelar oferta"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {r.can_delete &&
                        r.status === "draft" &&
                        r.approval_status === "not_requested" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                            onClick={() => handleDelete(r.id)}
                            aria-label="Excluir oferta"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
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
