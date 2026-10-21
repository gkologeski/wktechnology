// Visões "Comercial", "Financeiro e gestão" e "Qualidade dos dados" (apresentação pura).
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Banknote,
  Briefcase,
  CheckCircle2,
  Clock3,
  FileWarning,
  Link2,
  ShieldAlert,
} from "lucide-react";
import { OverviewPanel, DistributionBar } from "@/components/dashboard/overview-panel";
import type { DashMoney, DashSummary } from "@/lib/projects/dashboard-views.types";
import { ISSUE_TYPE_LABEL, formatHours } from "@/lib/projects/reconciliation-labels";
import { DASH_ORIGINS, DASH_ORIGIN_LABEL } from "@/lib/projects/dashboard-views.shared";
import { Grid, HoursMetric, Metric, Notice, int, num, secs, type ViewCtx } from "./dash-view-parts";

const dt = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "nunca";

export function CommercialView({ data, ctx }: { data: DashSummary; ctx: ViewCtx }) {
  const d = data.deals ?? {};
  const won = Number(d.won?.n ?? 0);
  const median = d.with_project?.transition_median_s;
  return (
    <div className="flex flex-col gap-6">
      <Notice>
        {data.policy?.enabled
          ? `Política de entrega ativa desde ${dt(data.policy.activated_at)}. Ganhos anteriores não são cobrados como pendência.`
          : "Política de entrega desativada: ganhos sem projeto não são tratados como pendência."}{" "}
        Valores e custos não aparecem nesta visão.
      </Notice>
      <Grid>
        <Metric
          ctx={ctx}
          dataset="deals"
          metric="won"
          value={int(won)}
          hint={`${int(Number(d.with_project?.n ?? 0))} com projeto vinculado`}
          icon={Briefcase}
        />
        <Metric
          ctx={ctx}
          dataset="deals"
          metric="no_project"
          value={int(Number(d.no_project?.n ?? 0))}
          hint={`${int(Number(d.job_pending?.n ?? 0))} com criação em andamento`}
          icon={AlertTriangle}
          tone={Number(d.no_project?.n ?? 0) > 0 ? "warning" : "neutral"}
        />
        <Metric
          ctx={ctx}
          dataset="deals"
          metric="preparation"
          value={int(Number(d.preparation?.n ?? 0))}
          hint={`${int(Number(d.no_owner?.n ?? 0))} com projeto sem responsável`}
          icon={Clock3}
        />
        <Metric
          ctx={ctx}
          dataset="deals"
          metric="no_contract"
          value={int(Number(d.no_contract?.n ?? 0))}
          hint={
            median === null || median === undefined
              ? "Tempo venda → projeto: sem base"
              : `Mediana venda → projeto: ${(Number(median) / 86400).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`
          }
          icon={FileWarning}
        />
      </Grid>
    </div>
  );
}

function money(rows: DashMoney[] | undefined, field: "amount" | "received") {
  if (!rows || rows.length === 0) return "—";
  return rows
    .map((r) =>
      Number(r[field]).toLocaleString("pt-BR", { style: "currency", currency: r.currency }),
    )
    .join(" · ");
}
const count = (rows: DashMoney[] | undefined) => (rows ?? []).reduce((a, r) => a + Number(r.n), 0);

export function FinanceView({ data, ctx }: { data: DashSummary; ctx: ViewCtx }) {
  const m = data.measurements ?? {};
  const c = data.cost;
  const known = secs(c, "cost_known");
  const all = secs(c, "all");
  const coverage = all > 0 ? known / all : null;
  const stage = (
    metric: string,
    icon = Banknote,
    field: "amount" | "received" = "amount",
    missing?: string,
  ) => (
    <Metric
      ctx={ctx}
      dataset="measurements"
      metric={metric}
      value={money(m[metric], field)}
      hint={`${int(count(m[metric]))} medições`}
      icon={icon}
      missing={missing}
    />
  );
  return (
    <div className="flex flex-col gap-6">
      <Notice>
        Cada etapa da receita aparece separada e por moeda; nada é somado entre etapas nem
        convertido. Nenhuma cobrança é gerada a partir do painel. Horas importadas bloqueadas não
        são faturáveis por padrão.
      </Notice>
      <Grid>
        {stage("forecast")}
        {stage("awaiting_approval", Clock3)}
        {stage("approved", CheckCircle2)}
        {stage("awaiting_generation", AlertTriangle)}
      </Grid>
      <Grid>
        {stage("generated")}
        {data.scope.can_received ? (
          stage("received", Banknote, "received")
        ) : (
          <Metric
            ctx={ctx}
            dataset="measurements"
            metric="received"
            value="Sem acesso"
            hint="Recebimentos exigem acesso ao Financeiro (não é zero)"
            icon={Banknote}
            noDrill
          />
        )}
        {stage("reversed", AlertTriangle)}
        <HoursMetric ctx={ctx} map={data.entries} metric="billable" icon={Clock3} />
      </Grid>
      {data.scope.can_cost ? (
        <OverviewPanel
          title={`Cobertura de custo (${data.cost_currency ?? "BRL"})`}
          description="Situação da tarifa de custo na data de cada apontamento. Valores de custo não aparecem aqui."
        >
          <div className="grid gap-3 md:grid-cols-3">
            <DistributionBar
              label={`Com custo · ${formatHours(known)}`}
              value={num(c, "cost_known")}
              total={Math.max(1, num(c, "all"))}
            />
            <DistributionBar
              label={`Sem custo · ${formatHours(secs(c, "cost_missing"))}`}
              value={num(c, "cost_missing")}
              total={Math.max(1, num(c, "all"))}
            />
            <DistributionBar
              label={`Ambíguo · ${formatHours(secs(c, "cost_ambiguous"))}`}
              value={num(c, "cost_ambiguous")}
              total={Math.max(1, num(c, "all"))}
            />
          </div>
          <p className="mt-3 text-xs text-text-secondary">
            {coverage === null
              ? "Sem horas no período: cobertura sem base."
              : coverage < 1
                ? `Cobertura de ${(coverage * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% das horas: a margem consolidada não é exibida enquanto houver custo desconhecido. Veja a rentabilidade por projeto.`
                : "Todo o custo é conhecido; a margem está na rentabilidade de cada projeto."}
          </p>
        </OverviewPanel>
      ) : (
        <Notice>Cobertura de custo exige permissão de tarifas ou rentabilidade.</Notice>
      )}
    </div>
  );
}

export function QualityView({ data, ctx }: { data: DashSummary; ctx: ViewCtx }) {
  const q = data.quality;
  const e = data.entries;
  const issues = Object.entries(q?.issues ?? {}).sort((a, b) => b[1].alerts - a[1].alerts);
  const totalEntries = Number(q?.links.entries ?? 0);
  return (
    <div className="flex flex-col gap-6">
      <Notice>
        A conferência compara o ERP com os dados já coletados das origens; não certifica a origem.
        Última conferência: {dt(q?.last_refresh?.finished_at)}.{" "}
        <Link
          to="/projects/settings/imports/reconciliation"
          className="font-medium text-primary hover:underline"
        >
          Abrir central de conciliação →
        </Link>
      </Notice>
      <Grid>
        <Metric
          ctx={ctx}
          dataset="entries"
          metric="in_review"
          value={int(Number(q?.issues_total.entries ?? 0))}
          def={{
            title: "Apontamentos com pendência",
            definition:
              "Apontamentos do ERP distintos com alerta aberto ou adiado na conciliação; alertas de um mesmo apontamento contam uma vez. Alertas sobre dados de origem ainda não materializados (ex.: horas Jibble sem horário) aparecem à parte, como “só na origem”.",
            source: "Central de conciliação (Ciclo 1).",
          }}
          hint={`${int(Number(q?.issues_total.alerts ?? 0))} alertas · ${int(Number(q?.issues_total.without_entry ?? 0))} só na origem`}
          icon={ShieldAlert}
          tone={Number(q?.issues_total.alerts ?? 0) > 0 ? "warning" : "neutral"}
        />
        <Metric
          ctx={ctx}
          dataset="entries"
          metric="total"
          value={
            totalEntries > 0
              ? `${((Number(q?.links.with_person ?? 0) / totalEntries) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
              : "Sem base"
          }
          hint={`${int(Number(q?.links.with_person ?? 0))} de ${int(totalEntries)} apontamentos ligados a pessoa do TechPeople`}
          icon={Link2}
          def={{
            title: "Vínculo com pessoa",
            definition:
              "Apontamentos do período ligados a uma pessoa do TechPeople por evidência exata (Ciclo 1).",
            source: "Apontamentos + TechPeople.",
          }}
          noDrill
        />
        <Metric
          ctx={ctx}
          dataset="entries"
          metric="total"
          value={
            totalEntries > 0
              ? `${((Number(q?.links.with_allocation ?? 0) / totalEntries) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
              : "Sem base"
          }
          hint={`${int(Number(q?.links.with_allocation ?? 0))} ligados a alocação · ${int(Number(q?.links.without_people_record ?? 0))} de usuários sem cadastro no TechPeople`}
          icon={Link2}
          def={{
            title: "Vínculo com alocação",
            definition: "Apontamentos do período ligados a uma alocação vigente do TechPeople.",
            source: "Apontamentos + alocações.",
          }}
          noDrill
        />
        <Metric
          ctx={ctx}
          dataset="projects"
          metric="no_company"
          value={int(num(data.projects, "no_company"))}
          hint={`${int(num(data.projects, "no_company_any"))} projetos sem empresa no total`}
          icon={AlertTriangle}
          current
        />
      </Grid>
      <div className="grid gap-4 lg:grid-cols-2">
        <OverviewPanel
          title="Pendências por tipo"
          description="Alertas abertos ou adiados por tipo e apontamentos do ERP afetados."
        >
          {issues.length === 0 ? (
            <p className="text-sm text-text-secondary">Nenhuma pendência aberta no período.</p>
          ) : (
            <div className="space-y-3">
              {issues.map(([k, v]) => (
                <DistributionBar
                  key={k}
                  label={`${ISSUE_TYPE_LABEL[k as keyof typeof ISSUE_TYPE_LABEL] ?? k} · ${v.entries > 0 ? `${int(v.entries)} apontamentos` : "só na origem"}`}
                  value={v.alerts}
                  total={Math.max(1, Number(q?.issues_total.alerts ?? 0))}
                />
              ))}
            </div>
          )}
        </OverviewPanel>
        <OverviewPanel
          title="Horas por origem"
          description="Mesmo período e filtros; cada apontamento conta uma vez."
        >
          <div className="space-y-3">
            {DASH_ORIGINS.map((o) => (
              <DistributionBar
                key={o}
                label={`${DASH_ORIGIN_LABEL[o]} · ${formatHours(secs(e, `origin_${o}`))}`}
                value={num(e, `origin_${o}`)}
                total={Math.max(1, num(e, "total"))}
              />
            ))}
          </div>
        </OverviewPanel>
      </div>
    </div>
  );
}
