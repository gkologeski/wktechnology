// /people/analytics — Sprint 11: dashboard de People (headcount, turnover, custo, margem).
// Sprint 12: integração com TechFinance (sincronizar folha como recorrências).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  UserMinus,
  Wallet,
  HeartHandshake,
  DollarSign,
  TrendingUp,
  Briefcase,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getPeopleAnalytics } from "@/lib/people/analytics.functions";
import {
  materializePeoplePayroll,
  type PayrollSyncResult,
} from "@/lib/people/finance-sync.functions";
import {
  PEOPLE_STATUS_LABELS,
  PEOPLE_EMPLOYMENT_LABELS,
  type PeopleStatus,
  type PeopleEmploymentType,
} from "@/lib/people/people.functions";

export const Route = createFileRoute("/_authenticated/people/analytics")({
  component: PeopleAnalyticsPage,
  head: () => ({
    meta: [
      { title: "Analytics · TechPeople" },
      {
        name: "description",
        content: "Dashboard de headcount, turnover, custos e margem de alocações.",
      },
    ],
  }),
});

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (n: number) => `${n.toFixed(1)}%`;
const monthLabel = (m: string) => {
  const [y, mm] = m.split("-");
  const d = new Date(Number(y), Number(mm) - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
};

function KpiCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "primary" | "success" | "danger" | "muted";
}) {
  const toneCls =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
        ? "text-emerald-600 dark:text-emerald-400"
        : tone === "danger"
          ? "text-red-600 dark:text-red-400"
          : "";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2 text-xs">
          {icon} {label}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-semibold ${toneCls} truncate`}>{value}</div>
        {hint ? <div className="text-xs text-muted-foreground mt-1">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

function TrendBars({
  data,
  colorClass,
}: {
  data: { month: string; count: number }[];
  colorClass: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex items-end gap-1.5 h-32">
      {data.map((d) => {
        const h = (d.count / max) * 100;
        return (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-full rounded-t ${colorClass} min-h-[2px] transition-all`}
              style={{ height: `${Math.max(2, h)}%` }}
              title={`${d.month}: ${d.count}`}
            />
            <div className="text-[10px] text-muted-foreground">{monthLabel(d.month)}</div>
            <div className="text-[10px] font-medium">{d.count}</div>
          </div>
        );
      })}
    </div>
  );
}

function PeopleAnalyticsPage() {
  const analyticsFn = useServerFn(getPeopleAnalytics);
  const syncFn = useServerFn(materializePeoplePayroll);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncResult, setSyncResult] = useState<PayrollSyncResult | null>(null);
  const [previewMode, setPreviewMode] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["people_analytics"],
    queryFn: () => analyticsFn(),
  });

  const sync = useMutation({
    mutationFn: (dryRun: boolean) => syncFn({ data: { dryRun } }),
    onSuccess: (r) => {
      setSyncResult(r);
      if (!previewMode) {
        toast.success(
          `Folha sincronizada · ${r.created} criadas, ${r.updated} atualizadas, ${r.deactivated} desativadas`,
        );
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openSync = () => {
    setSyncResult(null);
    setPreviewMode(true);
    setSyncOpen(true);
    sync.mutate(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="Analytics · TechPeople"
        description="Headcount, movimentação, custos e margem de alocações."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={openSync}>
              <RefreshCw className="h-4 w-4 mr-2" /> Sincronizar folha
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/people">
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
              </Link>
            </Button>
          </div>
        }
      />

      {isLoading || !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          {/* KPIs principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <KpiCard
              icon={<Users className="h-3.5 w-3.5" />}
              label="Headcount ativo"
              value={String(data.headcount_total)}
              hint="Pessoas não desligadas"
            />
            <KpiCard
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label="Turnover 12m"
              value={pct(data.turnover_rate_12m)}
              hint="Desligamentos / headcount atual"
              tone={data.turnover_rate_12m > 20 ? "danger" : "muted"}
            />
            <KpiCard
              icon={<Wallet className="h-3.5 w-3.5" />}
              label="Custo mensal (base)"
              value={brl(data.monthly_cost_total)}
              hint="Salário/custo dos ativos"
            />
            <KpiCard
              icon={<DollarSign className="h-3.5 w-3.5" />}
              label="Custo total mensal"
              value={brl(data.total_cost_monthly)}
              hint="Base + benefícios"
              tone="primary"
            />
          </div>

          {/* Alocações & margem */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <KpiCard
              icon={<Briefcase className="h-3.5 w-3.5" />}
              label="Alocações ativas"
              value={String(data.allocations_active)}
            />
            <KpiCard
              icon={<DollarSign className="h-3.5 w-3.5" />}
              label="Receita projetada"
              value={brl(data.allocations_billable_revenue)}
              hint="Billable × 160h × %"
            />
            <KpiCard
              icon={<Wallet className="h-3.5 w-3.5" />}
              label="Custo projetado"
              value={brl(data.allocations_cost)}
              hint="Cost rate × 160h × %"
            />
            <KpiCard
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label="Margem"
              value={`${brl(data.allocations_margin)} · ${pct(data.allocations_margin_pct)}`}
              tone={data.allocations_margin >= 0 ? "success" : "danger"}
            />
          </div>

          {/* Movimentação 12m */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-emerald-500" /> Admissões (12 meses)
                </CardTitle>
                <CardDescription>
                  Total: {data.hires_last_12m.reduce((s, r) => s + r.count, 0)} pessoas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TrendBars data={data.hires_last_12m} colorClass="bg-emerald-500/70" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserMinus className="h-4 w-4 text-red-500" /> Desligamentos (12 meses)
                </CardTitle>
                <CardDescription>
                  Total: {data.terminations_last_12m.reduce((s, r) => s + r.count, 0)} pessoas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TrendBars data={data.terminations_last_12m} colorClass="bg-red-500/70" />
              </CardContent>
            </Card>
          </div>

          {/* Distribuições */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Por status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(data.headcount_by_status).map(([k, v]) => {
                  const total = data.headcount_total || 1;
                  const p = (v / total) * 100;
                  return (
                    <div key={k} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <Badge variant="outline">
                          {PEOPLE_STATUS_LABELS[k as PeopleStatus] ?? k}
                        </Badge>
                        <span className="tabular-nums text-muted-foreground">
                          {v} · {p.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded overflow-hidden">
                        <div className="h-full bg-primary/70" style={{ width: `${p}%` }} />
                      </div>
                    </div>
                  );
                })}
                {Object.keys(data.headcount_by_status).length === 0 && (
                  <div className="text-sm text-muted-foreground">Sem dados.</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <HeartHandshake className="h-4 w-4" /> Por tipo de contrato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(data.headcount_by_employment).map(([k, v]) => {
                  const total = data.headcount_total || 1;
                  const p = (v / total) * 100;
                  return (
                    <div key={k} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <Badge variant="outline">
                          {PEOPLE_EMPLOYMENT_LABELS[k as PeopleEmploymentType] ?? k}
                        </Badge>
                        <span className="tabular-nums text-muted-foreground">
                          {v} · {p.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded overflow-hidden">
                        <div className="h-full bg-primary/70" style={{ width: `${p}%` }} />
                      </div>
                    </div>
                  );
                })}
                {Object.keys(data.headcount_by_employment).length === 0 && (
                  <div className="text-sm text-muted-foreground">Sem dados.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Sincronizar folha com TechFinance
            </DialogTitle>
            <DialogDescription>
              Cria/atualiza uma recorrência mensal (Pagar) por pessoa ativa com o custo total (base
              + benefícios vigentes). Idempotente — pode rodar quantas vezes precisar.
            </DialogDescription>
          </DialogHeader>

          {sync.isPending && !syncResult ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : syncResult ? (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded border p-2">
                  <div className="text-lg font-semibold text-emerald-600">{syncResult.created}</div>
                  <div className="text-[11px] text-muted-foreground">Criadas</div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-lg font-semibold text-primary">{syncResult.updated}</div>
                  <div className="text-[11px] text-muted-foreground">Atualizadas</div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-lg font-semibold text-red-600">{syncResult.deactivated}</div>
                  <div className="text-[11px] text-muted-foreground">Desativadas</div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-lg font-semibold text-muted-foreground">
                    {syncResult.skipped}
                  </div>
                  <div className="text-[11px] text-muted-foreground">Sem alteração</div>
                </div>
              </div>
              <div className="text-sm">
                Total mensal a materializar:{" "}
                <span className="font-semibold">
                  {syncResult.total_monthly.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: syncResult.currency,
                  })}
                </span>
              </div>
              <div className="max-h-64 overflow-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr className="text-left">
                      <th className="p-2 font-medium">Pessoa</th>
                      <th className="p-2 font-medium text-right">Valor</th>
                      <th className="p-2 font-medium">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncResult.items.map((it) => (
                      <tr key={it.person_id} className="border-t">
                        <td className="p-2">{it.person_name}</td>
                        <td className="p-2 text-right tabular-nums">
                          {it.monthly_amount.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: syncResult.currency,
                          })}
                        </td>
                        <td className="p-2">
                          <Badge
                            variant={
                              it.action === "created"
                                ? "default"
                                : it.action === "updated"
                                  ? "secondary"
                                  : it.action === "deactivated"
                                    ? "destructive"
                                    : "outline"
                            }
                          >
                            {it.action === "created"
                              ? "Criar"
                              : it.action === "updated"
                                ? "Atualizar"
                                : it.action === "deactivated"
                                  ? "Desativar"
                                  : "Sem alteração"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!previewMode ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> Recorrências aplicadas em TechFinance.
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Prévia — nada foi gravado ainda. Clique em "Aplicar" para materializar.
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSyncOpen(false)}>
              Fechar
            </Button>
            {previewMode && syncResult ? (
              <Button
                disabled={sync.isPending}
                onClick={() => {
                  setPreviewMode(false);
                  sync.mutate(false);
                }}
              >
                Aplicar
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
