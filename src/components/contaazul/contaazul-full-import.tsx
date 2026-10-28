import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Download, EyeOff, Plus, RotateCcw, ScanSearch } from "lucide-react";

import { EmptyState, SectionHeader } from "@/components/techhire/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { formatDateTime } from "@/lib/crm";
import { Can } from "@/lib/access-control/use-permissions";
import { INTEGRATIONS_MANAGE } from "@/lib/access-control/admin-permission-keys";
import {
  contaAzulFullImportApply,
  contaAzulFullImportDecide,
  contaAzulFullImportPreview,
  contaAzulFullImportRollback,
  contaAzulFullImportStatus,
} from "@/lib/integrations/contaazul-full-import.functions";
import type { FullImportSummary } from "@/lib/integrations/contaazul-full-import.server";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const RUN_STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  running: { label: "Em andamento", variant: "secondary" },
  completed: { label: "Concluída", variant: "default" },
  failed: { label: "Interrompida", variant: "destructive" },
  rolled_back: { label: "Desfeita", variant: "outline" },
};
const REASON: Record<string, string> = {
  date_changed: "Mesmo lançamento com outra data?",
  amount_changed: "Mesmo lançamento com outro valor?",
  ambiguous: "Mesma data e valor, texto diferente",
};
const WRITTEN: Record<string, string> = {
  category_created: "Categorias criadas",
  cost_center_created: "Centros de custo criados",
  bank_account_created: "Contas financeiras criadas",
  companies_created: "Empresas (somente financeiro)",
  contacts_created: "Contatos (somente financeiro)",
  entries_created: "Lançamentos criados",
  allocations_created: "Rateios por centro de custo",
  payments_created: "Baixas registradas",
  payments_estimated_date: "Baixas com data estimada",
  entries_cancelled: "Lançamentos cancelados (perdidos)",
  transfers_created: "Transferências criadas",
  links_written: "Vínculos gravados",
};

function SummaryGrid({ s }: { s: FullImportSummary }) {
  const rows: Array<[string, string]> = [
    ["Lidos do Conta Azul", `${s.api.events} lançamentos · ${s.api.transfers} transferências`],
    ["Já existem no TechERP (só vínculo)", `${s.entries.match} lançamentos`],
    [
      "Novos a criar",
      `${s.entries.create} (${s.entries.createReceivable} a receber, ${s.entries.createPayable} a pagar) · ${brl(s.entries.createValue)}`,
    ],
    [
      "Baixas novas em lançamentos existentes",
      `${s.entries.paymentsToAdd} · ${brl(s.entries.paymentsToAddValue)}`,
    ],
    ["Para revisar", `${s.entries.review} lançamentos`],
    ["Só no TechERP (preservados)", `${s.entries.localOnly}`],
    ["Transferências", `${s.transfers.match} existentes · ${s.transfers.create} novas`],
    [
      "Clientes e fornecedores novos",
      `${s.people.companies} empresas · ${s.people.contacts} contatos (somente financeiro)`,
    ],
    [
      "Categorias",
      `${s.categories.match} existentes · ${s.categories.create} novas · ${s.categories.review} para revisar`,
    ],
    ["Centros de custo", `${s.costCenters.match} existentes · ${s.costCenters.create} novos`],
    ["Contas financeiras", `${s.bankAccounts.match} existentes · ${s.bankAccounts.create} novas`],
  ];
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex flex-col border-b border-border/60 pb-2">
          <dt className="text-xs text-muted-foreground">{k}</dt>
          <dd className="font-medium tabular-nums">{v}</dd>
        </div>
      ))}
      {s.people.pendingSuggestions > 0 ? (
        <p className="text-xs text-muted-foreground sm:col-span-2">
          {s.people.pendingSuggestions} cliente(s)/fornecedor(es) ainda sem decisão ficam de fora
          até você decidir.
        </p>
      ) : null}
      {s.entries.cancelledInContaAzul > 0 ? (
        <p className="text-xs text-muted-foreground sm:col-span-2">
          {s.entries.cancelledInContaAzul} lançamento(s) existentes estão perdidos no Conta Azul e
          não serão cancelados automaticamente.
        </p>
      ) : null}
    </dl>
  );
}

type ReviewRow = {
  id: string;
  entity: string;
  tier: string | null;
  label: string | null;
  decision: string | null;
  candidates: unknown;
};

/** Importação completa com simulação, execução, revisão e desfazer. */
export function ContaAzulFullImport({
  canManage,
  connected,
}: {
  canManage: boolean;
  connected: boolean;
}) {
  const qc = useQueryClient();
  const preview = useServerFn(contaAzulFullImportPreview);
  const apply = useServerFn(contaAzulFullImportApply);
  const rollback = useServerFn(contaAzulFullImportRollback);
  const status = useServerFn(contaAzulFullImportStatus);
  const decide = useServerFn(contaAzulFullImportDecide);
  const [page, setPage] = useState(0);
  const [simulated, setSimulated] = useState<FullImportSummary | null>(null);

  const q = useQuery({
    queryKey: ["contaazul", "full-import", page],
    queryFn: () => status({ data: { page } }),
    placeholderData: keepPreviousData,
  });
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["contaazul"] });

  const previewMut = useMutation({
    mutationFn: () => preview({}),
    onSuccess: (r) => setSimulated(r.summary),
    onError: (e: Error) => toast.error(e.message),
  });
  const applyMut = useMutation({
    mutationFn: () => apply({ data: { confirm: true } }),
    onSuccess: (r) => {
      const errs = r.summary.errors?.length ?? 0;
      if (errs) toast.warning(`Importação concluída com ${errs} aviso(s). Veja o resumo.`);
      else toast.success("Importação concluída.");
      setSimulated(null);
      invalidate();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      invalidate();
    },
  });
  const rollbackMut = useMutation({
    mutationFn: (runId: string) => rollback({ data: { runId } }),
    onSuccess: () => {
      toast.success("Execução desfeita.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const decideMut = useMutation({
    mutationFn: (v: { ids: string[]; decision: "same" | "new" | "ignore"; localId?: string }) =>
      decide({ data: v }),
    onSuccess: () => {
      toast.success("Decisão registrada. Ela é aplicada na próxima importação.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = previewMut.isPending || applyMut.isPending || rollbackMut.isPending;
  const runs = q.data?.runs ?? [];
  const review = (q.data?.review ?? []) as ReviewRow[];
  const reviewTotal = q.data?.reviewTotal ?? 0;

  const handleApply = async () => {
    const ok = await confirmDialog({
      title: "Importar do Conta Azul agora?",
      description:
        "Grava só o que falta: vínculos com o que já existe, lançamentos novos com suas baixas, transferências, cadastros auxiliares e clientes/fornecedores somente financeiros. Nada é alterado no Conta Azul. A execução pode ser desfeita.",
      confirmLabel: "Importar",
    });
    if (ok) applyMut.mutate();
  };
  const handleRollback = async (runId: string) => {
    const ok = await confirmDialog({
      title: "Desfazer esta importação?",
      description:
        "Remove os lançamentos, baixas, transferências e cadastros criados por ela e arquiva as empresas e contatos somente financeiros criados. Registros que já existiam não são afetados.",
      confirmLabel: "Desfazer",
      variant: "destructive",
    });
    if (ok) rollbackMut.mutate(runId);
  };

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <SectionHeader
          title="Importação completa"
          description="Traz do Conta Azul o que ainda não está no TechERP, sem duplicar o que veio da planilha. Simule antes para ver as quantidades."
          action={
            canManage ? (
              <Can any={INTEGRATIONS_MANAGE} fallback={null}>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => previewMut.mutate()}
                    disabled={busy || !connected}
                  >
                    <ScanSearch className="mr-2 h-4 w-4" aria-hidden />
                    {previewMut.isPending ? "Simulando..." : "Simular"}
                  </Button>
                  <Button
                    onClick={() => void handleApply()}
                    disabled={busy || !connected || !simulated}
                  >
                    <Download className="mr-2 h-4 w-4" aria-hidden />
                    {applyMut.isPending ? "Importando..." : "Importar"}
                  </Button>
                </div>
              </Can>
            ) : null
          }
        />
        {!connected ? (
          <p className="text-sm text-muted-foreground">
            Conecte o Conta Azul para simular ou importar.
          </p>
        ) : null}
        {canManage && !simulated && connected ? (
          <p className="text-xs text-muted-foreground">
            O botão Importar fica disponível depois de uma simulação.
          </p>
        ) : null}
        {previewMut.isPending || applyMut.isPending ? (
          <div className="space-y-2" aria-live="polite">
            <p className="text-sm text-muted-foreground">
              {applyMut.isPending
                ? "Importando. Pode levar alguns minutos; não feche esta página."
                : "Lendo o Conta Azul e comparando com o TechERP..."}
            </p>
            <Skeleton className="h-24 w-full" />
          </div>
        ) : simulated ? (
          <div className="space-y-2 rounded-md border border-border p-4">
            <p className="text-sm font-medium">Simulação (nada foi gravado)</p>
            <SummaryGrid s={simulated} />
          </div>
        ) : null}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Execuções</h3>
          {q.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : q.isError ? (
            <p className="text-sm text-destructive">
              Não foi possível carregar as execuções. {(q.error as Error).message}{" "}
              <Button variant="link" className="h-auto p-0" onClick={() => void q.refetch()}>
                Tentar novamente
              </Button>
            </p>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma importação completa executada ainda.
            </p>
          ) : (
            <ul className="space-y-3">
              {runs.map((r) => {
                const st = RUN_STATUS[r.status] ?? { label: r.status, variant: "outline" as const };
                const s = r.summary as FullImportSummary & {
                  written?: Record<string, number>;
                  errors?: string[];
                };
                return (
                  <li key={r.id} className="space-y-2 rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant={st.variant}>{st.label}</Badge>
                        <span className="text-muted-foreground">
                          {formatDateTime(r.started_at)}
                        </span>
                      </div>
                      {canManage && (r.status === "completed" || r.status === "failed") ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleRollback(r.id)}
                          disabled={busy}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
                          Desfazer
                        </Button>
                      ) : null}
                    </div>
                    {s?.written ? (
                      <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
                        {Object.entries(s.written).map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-2">
                            <dt className="text-muted-foreground">{WRITTEN[k] ?? k}</dt>
                            <dd className="font-medium tabular-nums">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                    {r.error ? <p className="text-xs text-destructive">{r.error}</p> : null}
                    {s?.errors?.length ? (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground">
                          {s.errors.length} aviso(s)
                        </summary>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4">
                          {s.errors.map((e, i) => (
                            <li key={i}>{e}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Lançamentos para revisar ({reviewTotal})</h3>
          {q.isLoading ? null : review.length === 0 ? (
            <EmptyState
              title="Nada para revisar"
              description="Itens em dúvida aparecem aqui depois de uma importação."
            />
          ) : (
            <ul className="space-y-2">
              {review.map((row) => {
                const cands = (Array.isArray(row.candidates) ? row.candidates : []) as Array<{
                  id: string;
                  label?: string;
                }>;
                return (
                  <li
                    key={row.id}
                    className="space-y-2 rounded-md border border-border p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {row.entity === "receivable"
                          ? "A receber"
                          : row.entity === "payable"
                            ? "A pagar"
                            : row.entity}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {REASON[row.tier ?? ""] ?? "Conferir"}
                      </span>
                      {row.decision ? (
                        <Badge variant="secondary">
                          Decidido:{" "}
                          {row.decision === "same"
                            ? "mesmo lançamento"
                            : row.decision === "new"
                              ? "criar novo"
                              : "ignorar"}
                        </Badge>
                      ) : null}
                    </div>
                    <p>
                      <span className="text-xs text-muted-foreground">Conta Azul: </span>
                      {row.label}
                    </p>
                    <ul className="space-y-1">
                      {cands.map((c) => (
                        <li
                          key={c.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1"
                        >
                          <span className="text-xs">
                            <span className="text-muted-foreground">TechERP: </span>
                            {c.label ?? c.id}
                          </span>
                          {canManage ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={decideMut.isPending}
                              onClick={() =>
                                decideMut.mutate({ ids: [row.id], decision: "same", localId: c.id })
                              }
                            >
                              <Check className="mr-1 h-3.5 w-3.5" aria-hidden />É o mesmo
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    {canManage ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={decideMut.isPending}
                          onClick={() => decideMut.mutate({ ids: [row.id], decision: "new" })}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
                          Criar como novo
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={decideMut.isPending}
                          onClick={() => decideMut.mutate({ ids: [row.id], decision: "ignore" })}
                        >
                          <EyeOff className="mr-1 h-3.5 w-3.5" aria-hidden />
                          Ignorar
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          {reviewTotal > 50 ? (
            <div className="flex items-center justify-end gap-2 text-xs">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <span className="text-muted-foreground">
                Página {page + 1} de {Math.ceil(reviewTotal / 50)}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={(page + 1) * 50 >= reviewTotal}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
