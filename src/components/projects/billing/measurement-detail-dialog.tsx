// Detalhe da medição: composição (linhas incluídas e excluídas com motivo), pendências, trilha e ações
// conforme a situação. A tela só oferece; o banco revalida permissão, hash da prévia e fontes a cada ação.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { EmptyState, RowSkeleton } from "@/components/techhire/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  addMeasurementAdjustment,
  addMeasurementSuccessEvent,
  approveMeasurement,
  cancelMeasurement,
  generateMeasurementEntry,
  getMeasurement,
  linkMeasurementLegacy,
  recheckMeasurement,
  refreshMeasurement,
  removeMeasurementLine,
  returnMeasurement,
  reverseMeasurement,
  submitMeasurement,
} from "@/lib/projects/billing.functions";
import {
  BILLING_MODEL_LABEL,
  MEASUREMENT_STATUS_LABEL,
  formatMoney,
  issueLabel,
  measurementStatusVariant,
  parseMoneyInput,
} from "@/lib/projects/billing.shared";
import { formatSeconds } from "@/lib/projects/time-entry.shared";
import type { IssueItem } from "@/lib/projects/billing.types";

import { IsoDatePicker } from "@/components/iso-date-picker";
const br = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const P = "techprojects.";

function IssueList({
  title,
  items,
  tone,
}: {
  title: string;
  items: IssueItem[];
  tone: "block" | "gate" | "warn";
}) {
  if (!items.length) return null;
  return (
    <div className="rounded-md border p-3 text-sm">
      <p className="font-medium">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {items.map((i) => (
          <li
            key={i.code}
            className={tone === "warn" ? "text-muted-foreground" : "text-destructive"}
            role={tone === "warn" ? undefined : "alert"}
          >
            {issueLabel(i.code)}{" "}
            {i.count > 0 ? `(${i.count}${i.seconds ? ` · ${formatSeconds(i.seconds)}` : ""})` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MeasurementDetailDialog({
  id,
  open,
  onOpenChange,
}: {
  id: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const getFn = useServerFn(getMeasurement);
  const fns = {
    refresh: useServerFn(refreshMeasurement),
    submit: useServerFn(submitMeasurement),
    ret: useServerFn(returnMeasurement),
    approve: useServerFn(approveMeasurement),
    recheck: useServerFn(recheckMeasurement),
    generate: useServerFn(generateMeasurementEntry),
    legacy: useServerFn(linkMeasurementLegacy),
    reverse: useServerFn(reverseMeasurement),
    cancel: useServerFn(cancelMeasurement),
    adjust: useServerFn(addMeasurementAdjustment),
    success: useServerFn(addMeasurementSuccessEvent),
    remove: useServerFn(removeMeasurementLine),
  };
  const [reason, setReason] = useState("");
  const [due, setDue] = useState("");
  const [adjDesc, setAdjDesc] = useState("");
  const [adjAmount, setAdjAmount] = useState("");
  const [evRef, setEvRef] = useState("");
  const [evType, setEvType] = useState<"ats_offer" | "ats_application">("ats_offer");
  const [evBase, setEvBase] = useState("");
  const [showExcluded, setShowExcluded] = useState(false);

  const q = useQuery({
    queryKey: ["measurement", id],
    queryFn: () => getFn({ data: { id: id as string } }),
    enabled: Boolean(id) && open,
    retry: false,
  });
  const d = q.data;
  const m = d?.measurement;
  const refreshAll = () => {
    void qc.invalidateQueries({ queryKey: ["measurement", id] });
    void qc.invalidateQueries({ queryKey: ["measurements"] });
    void qc.invalidateQueries({ queryKey: ["profitability"] });
  };
  const act = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: (r) => {
      const res = r as { status?: string; error?: string } | undefined;
      if (res?.status === "failed")
        toast.error(
          `Falha ao gerar: ${res.error ?? "erro"}. A aprovação foi mantida; tente de novo.`,
        );
      else toast.success("Feito.");
      setReason("");
      refreshAll();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      refreshAll();
    },
  });
  const busy = act.isPending;
  const run = (fn: () => Promise<unknown>) => act.mutate(fn);
  const reasonOk = reason.trim().length >= 10;

  const included = (d?.lines ?? []).filter((l) => l.included);
  const excluded = (d?.lines ?? []).filter((l) => !l.included);
  const legacyIds = (m?.gates ?? []).find((g) => g.code === "legacy_entry_exists")?.entries ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Medição {m ? `${br(m.period_from).slice(3)} · ${BILLING_MODEL_LABEL[m.model]}` : ""}
          </DialogTitle>
          <DialogDescription>
            Gerar no Financeiro cria um título interno a receber. Não emite nota fiscal, boleto nem
            envia cobrança.
          </DialogDescription>
        </DialogHeader>
        {q.isLoading ? (
          <RowSkeleton />
        ) : q.isError ? (
          <EmptyState
            title="Não foi possível abrir a medição"
            description={(q.error as Error).message}
          />
        ) : !m || !d ? null : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={measurementStatusVariant(m.status)}>
                {MEASUREMENT_STATUS_LABEL[m.status]}
              </Badge>
              {m.kind === "complement" && <Badge variant="outline">Complemento</Badge>}
              <span className="font-semibold tabular-nums">
                {formatMoney(m.total_amount, m.currency)}
              </span>
              <span className="text-muted-foreground">
                · {formatSeconds(m.total_seconds)} medidas · revisão {m.revision} · fuso{" "}
                {m.timezone}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Preparada por {d.names[m.created_by] ?? "—"}
              {m.submitted_by ? ` · enviada por ${d.names[m.submitted_by] ?? "—"}` : ""}
              {m.approved_by ? ` · aprovada por ${d.names[m.approved_by] ?? "—"}` : ""}
              {m.failure_reason ? ` · última falha: ${m.failure_reason}` : ""}
              {m.closed_reason ? ` · motivo: ${m.closed_reason}` : ""}
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <IssueList
                title="Pendências (impedem envio e aprovação)"
                items={m.blockers}
                tone="block"
              />
              <IssueList title="Pendências para o Financeiro" items={m.gates} tone="gate" />
              <IssueList title="Fora da medição" items={m.warnings} tone="warn" />
            </div>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Projeto · pessoa</TableHead>
                    <TableHead className="text-right">Tempo</TableHead>
                    <TableHead className="text-right">Tarifa/h</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {included.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-sm text-muted-foreground">
                        Nada incluído.
                      </TableCell>
                    </TableRow>
                  )}
                  {[...included, ...(showExcluded ? excluded : [])].map((l) => (
                    <TableRow
                      key={l.id}
                      className={l.included ? undefined : "text-muted-foreground"}
                    >
                      <TableCell>{br(l.work_date)}</TableCell>
                      <TableCell>
                        {l.description ??
                          (l.source_type === "time_entry" ? "Apontamento" : l.source_type)}
                      </TableCell>
                      <TableCell>
                        {[
                          l.project_id ? d.names[l.project_id] : null,
                          l.user_id ? d.names[l.user_id] : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.seconds !== null ? formatSeconds(l.seconds) : "—"}
                        {l.package_seconds
                          ? ` (${formatSeconds(l.package_seconds)} na franquia)`
                          : ""}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.rate_amount !== null ? formatMoney(l.rate_amount, m.currency) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.included ? formatMoney(l.amount, m.currency) : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {l.issue ? issueLabel(l.issue) : "Incluído"}
                        {l.reason ? ` · ${l.reason}` : ""}
                        {m.status === "draft" &&
                          (l.source_type === "adjustment" || l.source_type === "success_event") &&
                          can(`${P}measurements.manage.workspace`) && (
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto px-1"
                              disabled={busy}
                              onClick={() =>
                                run(() =>
                                  fns.remove({
                                    data: {
                                      lineId: l.id,
                                      reason: "Removido na revisão do rascunho",
                                    },
                                  }),
                                )
                              }
                            >
                              Remover
                            </Button>
                          )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {excluded.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setShowExcluded((v) => !v)}>
                {showExcluded ? "Ocultar" : "Mostrar"} {excluded.length} item(ns) fora da medição
              </Button>
            )}

            {d.financial.length > 0 && (
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">Financeiro</p>
                {d.financial.map((f) => (
                  <p key={f.id} className="text-muted-foreground">
                    <Link
                      to="/finance/entries/$id"
                      params={{ id: f.id }}
                      className="text-foreground underline-offset-2 hover:underline"
                    >
                      {f.kind === "legacy_linked" ? "Título legado vinculado" : "Título gerado"}
                    </Link>
                    {f.amount !== null
                      ? ` · ${formatMoney(f.amount, m.currency)} · pago ${formatMoney(f.paid_amount, m.currency)} · ${f.status} · vence ${br(f.due_date)}`
                      : " · valores visíveis só com acesso ao Financeiro"}
                    {f.active ? "" : " · desvinculado"}
                  </p>
                ))}
              </div>
            )}

            {/* ações */}
            <div className="space-y-3 rounded-md border p-3">
              {m.status === "draft" && can(`${P}measurements.manage.workspace`) && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => run(() => fns.refresh({ data: { id: m.id } }))}
                    >
                      Atualizar prévia
                    </Button>
                    <Button
                      disabled={busy || m.blockers.length > 0}
                      onClick={() =>
                        run(() => fns.submit({ data: { id: m.id, hash: m.lines_hash } }))
                      }
                    >
                      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar para revisão
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto] sm:items-end">
                    <div className="grid gap-1">
                      <Label htmlFor="adj-desc">Ajuste explícito (desconto, reajuste)</Label>
                      <Input
                        id="adj-desc"
                        value={adjDesc}
                        onChange={(e) => setAdjDesc(e.target.value)}
                        placeholder="Descrição"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="adj-amount">Valor (negativo = desconto)</Label>
                      <Input
                        id="adj-amount"
                        inputMode="decimal"
                        value={adjAmount}
                        onChange={(e) => setAdjAmount(e.target.value)}
                      />
                    </div>
                    <Button
                      variant="outline"
                      disabled={busy || !reasonOk || adjDesc.trim().length < 3 || !adjAmount.trim()}
                      onClick={() => {
                        try {
                          const v = parseMoneyInput(adjAmount.replace(/^-/, ""));
                          const amount = (adjAmount.trim().startsWith("-") ? -1 : 1) * (v ?? 0);
                          run(() =>
                            fns.adjust({
                              data: {
                                id: m.id,
                                description: adjDesc.trim(),
                                amount,
                                reason: reason.trim(),
                              },
                            }),
                          );
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      Adicionar ajuste
                    </Button>
                  </div>
                  {m.model === "percent" && (
                    <div className="grid gap-2 sm:grid-cols-[160px_1fr_140px_auto] sm:items-end">
                      <div className="grid gap-1">
                        <Label htmlFor="ev-type">Evento de sucesso</Label>
                        <Select
                          value={evType}
                          onValueChange={(v) => setEvType(v as "ats_offer" | "ats_application")}
                        >
                          <SelectTrigger id="ev-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ats_offer">Proposta (TechHire)</SelectItem>
                            <SelectItem value="ats_application">Candidatura (TechHire)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="ev-ref">Identificador do registro</Label>
                        <Input
                          id="ev-ref"
                          value={evRef}
                          onChange={(e) => setEvRef(e.target.value.trim())}
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="ev-base">Base (se explícita)</Label>
                        <Input
                          id="ev-base"
                          inputMode="decimal"
                          value={evBase}
                          onChange={(e) => setEvBase(e.target.value)}
                        />
                      </div>
                      <Button
                        variant="outline"
                        disabled={busy || !reasonOk || evRef.length < 36}
                        onClick={() => {
                          try {
                            run(() =>
                              fns.success({
                                data: {
                                  id: m.id,
                                  refType: evType,
                                  refId: evRef,
                                  base: parseMoneyInput(evBase),
                                  reason: reason.trim(),
                                },
                              }),
                            );
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                        }}
                      >
                        Adicionar evento
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {m.status === "in_review" && can(`${P}measurements.approve.workspace`) && (
                <Button
                  disabled={busy}
                  onClick={() => run(() => fns.approve({ data: { id: m.id, hash: m.lines_hash } }))}
                >
                  Aprovar medição
                </Button>
              )}
              {(m.status === "approved" || m.status === "ready" || m.status === "failed") && (
                <div className="flex flex-wrap items-end gap-2">
                  {m.status === "approved" && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => run(() => fns.recheck({ data: { id: m.id } }))}
                    >
                      Reverificar pendências
                    </Button>
                  )}
                  {can(`${P}measurement_finance.create.workspace`) && (
                    <>
                      <div className="grid gap-1">
                        <Label htmlFor="due">Vencimento</Label>
                        <IsoDatePicker
                          id="due"
                          value={due}
                          onChange={(v) => setDue((v ?? ""))}
                        />
                      </div>
                      <Button
                        disabled={busy || !due || m.status === "approved"}
                        onClick={() =>
                          run(() =>
                            fns.generate({ data: { id: m.id, hash: m.lines_hash, dueDate: due } }),
                          )
                        }
                      >
                        Gerar no Financeiro
                      </Button>
                      {legacyIds.map((eid) => (
                        <Button
                          key={eid}
                          variant="outline"
                          disabled={busy || !reasonOk}
                          onClick={() =>
                            run(() =>
                              fns.legacy({
                                data: {
                                  id: m.id,
                                  entryId: eid,
                                  hash: m.lines_hash,
                                  reason: reason.trim(),
                                },
                              }),
                            )
                          }
                        >
                          Vincular título legado existente
                        </Button>
                      ))}
                    </>
                  )}
                </div>
              )}
              {["draft", "in_review", "approved", "ready", "failed", "generated"].includes(
                m.status,
              ) && (
                <div className="space-y-2">
                  <div className="grid gap-1">
                    <Label htmlFor="m-reason">Motivo / justificativa (mín. 10 caracteres)</Label>
                    <Textarea
                      id="m-reason"
                      rows={2}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["in_review", "approved", "ready", "failed"].includes(m.status) && (
                      <Button
                        variant="outline"
                        disabled={busy || !reasonOk}
                        onClick={() =>
                          run(() => fns.ret({ data: { id: m.id, reason: reason.trim() } }))
                        }
                      >
                        Devolver para rascunho
                      </Button>
                    )}
                    {m.status !== "generated" && can(`${P}measurements.manage.workspace`) && (
                      <Button
                        variant="outline"
                        disabled={busy || !reasonOk}
                        onClick={() =>
                          run(() => fns.cancel({ data: { id: m.id, reason: reason.trim() } }))
                        }
                      >
                        Cancelar medição
                      </Button>
                    )}
                    {m.status === "generated" &&
                      can(`${P}measurement_reverse.manage.workspace`) && (
                        <Button
                          variant="destructive"
                          disabled={busy || !reasonOk}
                          onClick={() =>
                            run(() => fns.reverse({ data: { id: m.id, reason: reason.trim() } }))
                          }
                        >
                          Estornar (cancela o título sem pagamento)
                        </Button>
                      )}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium">Trilha</p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {d.events.map((e) => (
                  <li key={e.id}>
                    {new Date(e.created_at).toLocaleString("pt-BR")} · {e.action} ·{" "}
                    {e.actor_name ?? "sistema"}
                    {e.reason ? ` · ${e.reason}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
