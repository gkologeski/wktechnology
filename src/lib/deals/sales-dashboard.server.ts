import { DEFAULT_UTC_OFFSET_MS } from "@/lib/time-zone";
// Agregação do painel inicial do TechSales (server-only).
// Toda a lógica vive aqui; `sales-dashboard.functions.ts` é só o wrapper RPC.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Deal } from "@/lib/db-types";
import type { Pipeline, PipelineStage } from "@/lib/pipelines";
import { computeHotScore } from "@/lib/deals/hot-score";
import {
  dashboardStageParameters,
  parseDealDashboardAggregates,
} from "@/lib/deals/sales-dashboard-aggregates";
import {
  advancedStageIds,
  parseDashboardSecondary,
  summarizeLeadJourney,
  type SecondaryDealRow,
} from "@/lib/deals/sales-dashboard-secondary";
import type {
  ContactsByDay,
  DealListItem,
  FunnelStageRow,
  MeetingItem,
  SalesDashboardData,
  SalesDashboardInput,
  TaskItem,
} from "./sales-dashboard.types";

type Client = SupabaseClient<Database>;

type DealRow = {
  id: string;
  name: string;
  value: number | null;
  stage: string;
  stage_id: string | null;
  pipeline_id: string | null;
  owner_id: string | null;
  assigned_to: string | null;
  company_id: string | null;
  expected_close_date: string | null;
  closed_at: string | null;
  updated_at: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Horário comercial do Brasil (GMT-3, sem horário de verão desde 2019).
// O servidor roda em UTC, então agrupamos por dia local para que um contato
// registrado às 23h não caia no dia seguinte.
const BR_OFFSET_MS = DEFAULT_UTC_OFFSET_MS;

function brDayKey(d: Date): string {
  return new Date(d.getTime() - BR_OFFSET_MS).toISOString().slice(0, 10);
}

function brDayStart(dayKey: string): Date {
  return new Date(Date.parse(`${dayKey}T00:00:00.000Z`) + BR_OFFSET_MS);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function stageOf(deal: DealRow, stages: PipelineStage[]): PipelineStage | null {
  const key = deal.stage_id || deal.stage;
  return stages.find((s) => s.value === key) ?? stages.find((s) => s.value === deal.stage) ?? null;
}

export async function loadSalesDashboard(
  supabase: Client,
  userId: string,
  workspaceId: string,
  input: SalesDashboardInput,
): Promise<SalesDashboardData> {
  const now = new Date();
  const today = startOfDay(now);
  const in7 = new Date(today.getTime() + 7 * DAY_MS);
  const d14 = new Date(brDayStart(brDayKey(now)).getTime() - 13 * DAY_MS);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const periodStart = new Date(input.from);
  const periodEnd = new Date(input.to);
  const periodLen = periodEnd.getTime() - periodStart.getTime();
  const prevPeriodEnd = new Date(periodStart.getTime() - 1);
  const prevPeriodStart = new Date(prevPeriodEnd.getTime() - periodLen);

  // Escopo "equipe" exige permissão granular de visualização além do próprio usuário.
  const permsRes = await supabase
    .rpc("current_user_permissions_json", { _workspace_id: workspaceId })
    .then(
      (r) => r,
      () => ({ data: null }) as { data: unknown },
    );
  const perms: string[] = Array.isArray(permsRes.data) ? (permsRes.data as string[]) : [];
  const canViewTeam = perms.some((p) => /^techsales\.dashboard\.view\.(team|workspace)$/.test(p));
  // Sem permissão de equipe, o servidor força o próprio usuário.
  const requested = input.assignee === "__me__" ? userId : input.assignee;
  const effectiveAssignee: string = canViewTeam ? requested : userId;

  // 1) Pipelines de negócio (para o filtro e metadados de etapa)
  const pipesRes = await supabase
    .from("pipelines")
    .select("id, name, entity, stages, is_default")
    .eq("workspace_id", workspaceId)
    .eq("entity", "deal")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (pipesRes.error) throw new Error(pipesRes.error.message);
  const pipelines = (pipesRes.data ?? []) as unknown as Pipeline[];
  const selected: Pipeline | null =
    pipelines.find((p) => p.id === input.pipelineId) ??
    pipelines.find((p) => p.is_default) ??
    pipelines[0] ??
    null;
  const stages: PipelineStage[] = selected?.stages ?? [];
  const stageParameters = dashboardStageParameters(stages);

  const leadPipesRes = await supabase
    .from("pipelines")
    .select("id, name, entity, stages, is_default")
    .eq("workspace_id", workspaceId)
    .eq("entity", "lead")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (leadPipesRes.error) throw new Error(leadPipesRes.error.message);
  const leadPipelines = (leadPipesRes.data ?? []) as unknown as Pipeline[];
  const selectedLeadPipeline =
    leadPipelines.find((p) => p.id === input.leadPipelineId) ??
    leadPipelines.find((p) => p.is_default) ??
    leadPipelines[0] ??
    null;
  const leadStages = selectedLeadPipeline?.stages ?? [];

  // Filtro de responsável quando o escopo é "me"
  const mine = <T extends { eq: (c: string, v: string) => T; is: (c: string, v: null) => T }>(
    q: T,
  ): T =>
    effectiveAssignee === "__all__"
      ? q
      : effectiveAssignee === "__none__"
        ? q.is("owner_id", null)
        : q.eq("owner_id", effectiveAssignee);

  // Consultas secundárias não podem derrubar o painel inteiro: em caso de
  // falha, o bloco correspondente fica vazio.
  const safe = <T>(p: PromiseLike<{ data: T | null; error?: unknown }>) =>
    Promise.resolve(p).then(
      (r) => r,
      () => ({ data: null }) as { data: T | null; error?: unknown },
    );

  const ownerMode =
    effectiveAssignee === "__all__" ? "all" : effectiveAssignee === "__none__" ? "none" : "one";
  const ownerParam =
    effectiveAssignee === "__all__" || effectiveAssignee === "__none__" ? userId : effectiveAssignee;

  // Leads a trabalhar: contagem exata + amostra (sem baixar a lista inteira).
  const leadsToWorkBase = () =>
    mine(
      supabase
        .from("leads")
        .select("id, first_name, last_name, company_name, status, updated_at", {
          count: "exact",
        })
        .eq("workspace_id", workspaceId)
        .in("status", ["new", "contacted", "nurturing"]),
    );

  const [
    aggregatesRes,
    secondaryRes,
    meetingsRes,
    bookingsRes,
    tasksRes,
    goalsRes,
    leadsRes,
  ] = await Promise.all([
    supabase.rpc("get_sales_dashboard_deal_aggregates", {
      p_workspace_id: workspaceId,
      p_pipeline_id: selected?.id,
      p_owner_mode: ownerMode,
      p_owner_id: ownerParam,
      p_open_stage_ids: stageParameters.open,
      p_won_stage_ids: stageParameters.won,
      p_lost_stage_ids: stageParameters.lost,
      p_stage_probabilities: stageParameters.probabilities,
      p_period_start: periodStart.toISOString(),
      p_period_end: periodEnd.toISOString(),
      p_prev_start: prevPeriodStart.toISOString(),
      p_prev_end: prevPeriodEnd.toISOString(),
      p_month_start: monthStart.toISOString(),
      p_month_end: monthEnd.toISOString(),
    }),
    supabase.rpc("get_sales_dashboard_secondary", {
      p_workspace_id: workspaceId,
      p_pipeline_id: selected?.id,
      p_lead_pipeline_id: selectedLeadPipeline?.id,
      p_owner_mode: ownerMode,
      p_owner_id: ownerParam,
      p_open_stage_ids: stageParameters.open,
      p_advanced_stage_ids: advancedStageIds(stages),
      p_now: now.toISOString(),
      p_today: today.toISOString(),
      p_contacts_since: d14.toISOString(),
      p_utc_offset_minutes: Math.round(BR_OFFSET_MS / 60000),
      p_period_start: periodStart.toISOString(),
      p_period_end: periodEnd.toISOString(),
    }),
    safe(
      mine(
        supabase
          .from("meetings")
          .select("id, title, scheduled_at, status, public_token, related_deal_id")
          .eq("workspace_id", workspaceId)
          .gte("scheduled_at", now.toISOString())
          .lte("scheduled_at", in7.toISOString())
          .not("status", "in", '("cancelled","canceled")')
          .order("scheduled_at", { ascending: true })
          .limit(10),
      ),
    ),
    safe(
      mine(
        supabase
          .from("bookings")
          .select("id, invitee_name, invitee_email, start_at, meet_link, status")
          .eq("workspace_id", workspaceId)
          .eq("status", "confirmed")
          .gte("start_at", now.toISOString())
          .lte("start_at", in7.toISOString())
          .order("start_at", { ascending: true })
          .limit(10),
      ),
    ),
    safe(
      supabase
        .from("activities")
        .select("id, subject, due_date, type, completed")
        .eq("workspace_id", workspaceId)
        .eq("owner_id", userId)
        .eq("completed", false)
        .not("due_date", "is", null)
        .order("due_date", { ascending: true })
        .limit(12),
    ),
    safe(
      mine(
        supabase
          .from("goals")
          .select("id, metric, target_value, period_start, period_end, pipeline_id, target_user_id")
          .eq("workspace_id", workspaceId)
          .eq("metric", "deals_won_value")
          .lte("period_start", isoDay(monthEnd))
          .gte("period_end", isoDay(monthStart)),
      ),
    ),
    safe(leadsToWorkBase().order("updated_at", { ascending: true }).limit(5)),
  ]);

  if (aggregatesRes.error) throw new Error(aggregatesRes.error.message);
  if (secondaryRes.error) throw new Error(secondaryRes.error.message);
  const dealAggregates = parseDealDashboardAggregates(aggregatesRes.data);
  if (!dealAggregates) throw new Error("Agregação comercial indisponível.");
  const secondary = parseDashboardSecondary(secondaryRes.data);
  if (!secondary) throw new Error("Listas do painel indisponíveis.");

  // Negócios carregados apenas para as listas (os totais vêm do agregado SQL).
  const deals: SecondaryDealRow[] = [
    ...secondary.advanced,
    ...secondary.overdue,
    ...secondary.stale,
  ];

  const goals = (
    (goalsRes.data ?? []) as Array<{
      target_value: number | null;
      pipeline_id: string | null;
      target_user_id: string | null;
    }>
  ).filter((g) => !g.pipeline_id || !selected || g.pipeline_id === selected.id);
  const goalValue = goals.length ? goals.reduce((acc, g) => acc + (g.target_value ?? 0), 0) : null;

  // Nomes de responsáveis e empresas (para as listas)
  const ownerIds = Array.from(new Set(deals.map((d) => d.owner_id).filter(Boolean) as string[]));
  const companyIds = Array.from(
    new Set(deals.map((d) => d.company_id).filter(Boolean) as string[]),
  );
  const [profilesRes, companiesRes] = await Promise.all([
    ownerIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", ownerIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null }> }),
    companyIds.length
      ? supabase.from("companies").select("id, name").in("id", companyIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }> }),
  ]);
  const ownerName = new Map(
    ((profilesRes.data ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [
      p.id,
      p.full_name,
    ]),
  );
  const companyName = new Map(
    ((companiesRes.data ?? []) as Array<{ id: string; name: string | null }>).map((c) => [
      c.id,
      c.name,
    ]),
  );

  // Atividade recente (data efetiva nos últimos 7 dias) já vem calculada no servidor.
  const riskOf = (d: SecondaryDealRow): DealListItem["risk"] => {
    if (d.expected_close_date && new Date(d.expected_close_date).getTime() < today.getTime()) {
      return "overdue_close";
    }
    if (!d.has_recent_activity) return "no_recent_activity";
    return null;
  };

  const toItem = (d: SecondaryDealRow): DealListItem => {
    const st = stageOf(d, stages);
    const pipe: Pipeline = selected
      ? selected
      : ({ id: "", name: "", stages } as unknown as Pipeline);
    const hot = computeHotScore({ deal: d as unknown as Deal, pipeline: pipe });
    return {
      id: d.id,
      name: d.name,
      value: d.value ?? 0,
      stageLabel: st?.label ?? d.stage,
      stageColor: st?.color ?? null,
      probability: st?.probability ?? 0,
      ownerName: d.owner_id ? (ownerName.get(d.owner_id) ?? null) : null,
      companyName: d.company_id ? (companyName.get(d.company_id) ?? null) : null,
      expectedCloseDate: d.expected_close_date,
      hotScore: hot,
      risk: riskOf(d),
    };
  };

  // Negócios em fase avançada (probabilidade >= 60%), ordenados por hot score
  const advancedDeals = secondary.advanced
    .map(toItem)
    .sort((a, b) => b.hotScore - a.hotScore)
    .slice(0, 8);
  const advancedIds = new Set(advancedDeals.map((d) => d.id));

  // Negócios que precisam de atenção: o servidor devolve os 16 maiores de cada risco,
  // o suficiente para completar 8 mesmo após remover os 8 já listados como avançados.
  const attentionDeals = [...secondary.overdue, ...secondary.stale]
    .filter((d) => !advancedIds.has(d.id))
    .map(toItem)
    .filter((d) => d.risk !== null)
    .sort((a, b) => {
      if (a.risk === b.risk) return b.value - a.value;
      return a.risk === "overdue_close" ? -1 : 1;
    })
    .slice(0, 8);

  // Próximas reuniões (mescla meetings internas + bookings confirmados)
  const meetings: MeetingItem[] = [
    ...(
      (meetingsRes.data ?? []) as Array<{
        id: string;
        title: string | null;
        scheduled_at: string;
        public_token: string | null;
      }>
    ).map(
      (m): MeetingItem => ({
        id: m.id,
        kind: "meeting",
        title: m.title ?? "Reunião",
        startAt: m.scheduled_at,
        link: m.public_token ? `/meet/${m.public_token}` : null,
        subtitle: null,
      }),
    ),
    ...(
      (bookingsRes.data ?? []) as Array<{
        id: string;
        invitee_name: string | null;
        invitee_email: string | null;
        start_at: string;
        meet_link: string | null;
      }>
    ).map(
      (b): MeetingItem => ({
        id: b.id,
        kind: "booking",
        title: b.invitee_name ? `Reunião — ${b.invitee_name}` : "Reunião agendada",
        startAt: b.start_at,
        link: b.meet_link ?? null,
        subtitle: b.invitee_email ?? null,
      }),
    ),
  ]
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, 8);

  // Tarefas do usuário (sempre pessoais)
  const tasks: TaskItem[] = (
    (tasksRes.data ?? []) as Array<{
      id: string;
      subject: string | null;
      due_date: string;
      type: string;
    }>
  ).map((t) => ({
    id: t.id,
    subject: t.subject ?? "Tarefa",
    dueDate: t.due_date,
    overdue: new Date(t.due_date).getTime() < now.getTime(),
    type: t.type,
  }));

  // Contatos por dia (últimos 14 dias, empilhado por tipo)
  const bucketKeys = ["calls", "emails", "whatsapp", "meetings", "other"] as const;
  const contactsByDay: ContactsByDay[] = [];
  const byDay = new Map<string, ContactsByDay>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(d14.getTime() + i * DAY_MS);
    const day = brDayKey(d);
    const [, month = "", dayOfMonth = ""] = day.split("-");
    const row: ContactsByDay = {
      day,
      label: `${dayOfMonth}/${month}`,
      calls: 0,
      emails: 0,
      whatsapp: 0,
      meetings: 0,
      other: 0,
      total: 0,
    };
    contactsByDay.push(row);
    byDay.set(day, row);
  }
  for (const g of secondary.contacts) {
    const row = byDay.get(g.day);
    if (!row) continue;
    const key: (typeof bucketKeys)[number] =
      g.type === "call"
        ? "calls"
        : g.type === "email"
          ? "emails"
          : g.type === "whatsapp"
            ? "whatsapp"
            : g.type === "meeting"
              ? "meetings"
              : "other";
    row[key] += g.n;
    row.total += g.n;
  }

  // Funil do pipeline selecionado (apenas etapas abertas)
  const funnel: FunnelStageRow[] = stages
    .filter((s) => s.type === "open")
    .map((s) => {
      const aggregate = dealAggregates.stages[s.value] ?? { count: 0, value: 0 };
      return {
        value: s.value,
        label: s.label,
        color: s.color ?? null,
        probability: s.probability ?? 0,
        count: aggregate.count,
        valueSum: aggregate.value,
      };
    });

  // Leads a trabalhar (amostra + contagem exata)
  const leadsRows = (leadsRes.data ?? []) as Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    status: string;
  }>;
  const leadsToWorkCount =
    typeof (leadsRes as { count?: number | null }).count === "number"
      ? ((leadsRes as { count?: number | null }).count as number)
      : leadsRows.length;

  const journey = summarizeLeadJourney(secondary.journey, leadStages, stages, input.channel);

  return {
    pipelines: pipelines.map((p) => ({ id: p.id, name: p.name, isDefault: p.is_default })),
    leadPipelines: leadPipelines.map((p) => ({ id: p.id, name: p.name, isDefault: p.is_default })),
    selectedPipelineId: selected?.id ?? null,
    selectedPipelineName: selected?.name ?? null,
    canViewTeam,
    effectiveAssignee: effectiveAssignee === userId ? "__me__" : effectiveAssignee,
    kpis: {
      pipelineValue: dealAggregates.pipeline_value,
      openDeals: dealAggregates.open_count,
      forecastValue: dealAggregates.forecast_value,
      forecastDeals: dealAggregates.forecast_count,
      wonValue: dealAggregates.won_month_value,
      wonCount: dealAggregates.won_month_count,
      goalValue,
      conversionRate:
        dealAggregates.won_period_count + dealAggregates.lost_period_count > 0
          ? (dealAggregates.won_period_count /
              (dealAggregates.won_period_count + dealAggregates.lost_period_count)) *
            100
          : 0,
      conversionDelta:
        dealAggregates.won_prev_count + dealAggregates.lost_prev_count > 0
          ? (dealAggregates.won_period_count /
              Math.max(1, dealAggregates.won_period_count + dealAggregates.lost_period_count)) *
              100 -
            (dealAggregates.won_prev_count /
              (dealAggregates.won_prev_count + dealAggregates.lost_prev_count)) *
              100
          : null,
      wonDeltaPct:
        dealAggregates.won_prev_value > 0
          ? ((dealAggregates.won_period_value - dealAggregates.won_prev_value) /
              dealAggregates.won_prev_value) *
            100
          : null,
      avgTicket:
        dealAggregates.won_period_count > 0
          ? dealAggregates.won_period_value / dealAggregates.won_period_count
          : null,
    },
    leadJourney: {
      ...journey,
      selectedChannel: input.channel,
      leadPipelineName: selectedLeadPipeline?.name ?? null,
    },
    advancedDeals,
    attentionDeals,
    meetings,
    tasks,
    contactsByDay,
    funnel,
    leadsToWork: {
      count: leadsToWorkCount,
      sample: leadsRows.slice(0, 5).map((l) => ({
        id: l.id,
        name:
          [l.first_name, l.last_name].filter(Boolean).join(" ") ||
          l.company_name ||
          "Lead sem nome",
        status: l.status,
      })),
    },
  };
}
