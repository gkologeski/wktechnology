// Central de atenção no painel (apresentação): contagens persistidas, última avaliação e ações permitidas.
import { BellRing, Loader2, RefreshCw, Settings2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OverviewPanel } from "@/components/dashboard/overview-panel";
import type { DashSummary } from "@/lib/projects/dashboard-views.types";
import { ALERT_RULE_LABEL } from "@/lib/projects/dashboard-views.shared";
import { Grid, Metric, int, num, type ViewCtx } from "./dash-view-parts";

const dt = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null;

export function AlertsOverview({
  data,
  ctx,
  onReevaluate,
  reevaluating,
  onOpenRules,
}: {
  data: DashSummary;
  ctx: ViewCtx;
  onReevaluate: () => void;
  reevaluating: boolean;
  onOpenRules: () => void;
}) {
  const a = data.alerts;
  const last = data.alert_last_run;
  const canRun = data.scope.can_manage_alerts && !data.scope.read_only;
  const byRule = Object.keys(ALERT_RULE_LABEL)
    .map((k) => ({ k, n: num(a, `rule_${k}`) }))
    .filter((r) => r.n > 0);
  return (
    <OverviewPanel
      title="Central de atenção"
      description={
        last
          ? `Última avaliação em ${dt(last.finished_at)} (regras determinísticas, sem envio externo). Reconhecer não corrige o dado.`
          : "Os alertas ainda não foram avaliados neste workspace. Nada é calculado ao abrir o painel."
      }
      action={
        <div className="flex flex-wrap gap-2">
          {data.scope.can_manage_rules ? (
            <Button size="sm" variant="outline" onClick={onOpenRules}>
              <Settings2 className="mr-2 h-4 w-4" aria-hidden />
              Regras
            </Button>
          ) : null}
          {canRun ? (
            <Button size="sm" variant="outline" onClick={onReevaluate} disabled={reevaluating}>
              {reevaluating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
              )}
              Reavaliar agora
            </Button>
          ) : null}
        </div>
      }
    >
      <Grid>
        <Metric
          ctx={ctx}
          dataset="alerts"
          metric="needs_action"
          value={int(num(a, "needs_action"))}
          hint={`${int(num(a, "sev_high"))} de severidade alta`}
          icon={BellRing}
          tone={
            num(a, "sev_high") > 0 ? "negative" : num(a, "needs_action") > 0 ? "warning" : "neutral"
          }
          current
        />
        <Metric
          ctx={ctx}
          dataset="alerts"
          metric="active"
          value={int(num(a, "active"))}
          hint={`${int(num(a, "status_acknowledged"))} reconhecidos · ${int(num(a, "status_snoozed"))} adiados`}
          icon={ShieldAlert}
          current
        />
      </Grid>
      {byRule.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Alertas por regra">
          {byRule.map((r) => (
            <li key={r.k}>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => ctx.onDrill("alerts", `rule_${r.k}`)}
              >
                {ALERT_RULE_LABEL[r.k]} · {int(r.n)}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </OverviewPanel>
  );
}
