// Agregação do painel inicial do TechSales (server-only).
// Toda a lógica vive aqui; `sales-dashboard.functions.ts` é só o wrapper RPC.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Deal } from "@/lib/db-types";
import type { Pipeline, PipelineStage } from "@/lib/pipelines";
import { computeHotScore } from "@/lib/deals/hot-score";
import type {
  ContactsByDay,
  DealListItem,
  FunnelStageRow,
  MeetingItem,
  SalesDashboardData,
  SalesDashboardInput,
  SalesDashboardScope,
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

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function stageOf(deal: DealRow, stages: PipelineStage[]): PipelineStage | null {
  const key = deal.stage_id || deal.stage;
  return stages.find((s) => s.value === key) ?? stages.find((s) => s.value === deal.stage) ?? null;
}

function isClosed(deal: DealRow, stages: PipelineStage[]): boolean {
  const st = stageOf(deal, stages);
  if (st) return st.type === "won" || st.type === "lost";
  return deal.stage === "won" || deal.stage === "lost";
}

function isWon(deal: DealRow, stages: PipelineStage[]): boolean {
  const st = stageOf(deal, stages);
  if (st) return st.type === "won";
  return deal.stage === "won";
}

function probabilityOf(deal: DealRow, stages: PipelineStage[]): number {
  return stageOf(deal, stages)?.probability ?? 0;
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
  const d14 = new Date(today.getTime() - 13 * DAY_MS);
  const d30 = new Date(today.getTime() - 30 * DAY_MS);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const periodStart = new Date(today.getTime() - (input.periodDays - 1) * DAY_MS);
  const prevPeriodStart = new Date(periodStart.getTime() - input.periodDays * DAY_MS);
  const prevPeriodEnd = new Date(periodStart.getTime() - 1);

  // Escopo "equipe" exige permissão granular de visualização além do próprio usuário.
  const permsRes = await supabase
    .rpc("current_user_permissions_json", { _workspace_id: workspaceId })
    .then(
      (r) => r,
      () => ({ data: null }) as { data: unknown },
    );
  const perms: string[] = Array.isArray(permsRes.data) ? (permsRes.data as string[]) : [];
  const canViewTeam = perms.some((p) => /^techsales\.dashboard\.view\.(team|workspace)$/.test(p));
  const effectiveScope: SalesDashboardScope = input.scope === "team" && canViewTeam ? "team" : "me";

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

  // Filtro de responsável quando o escopo é "me"
  const mine = <T extends { eq: (c: string, v: string) => T }>(q: T): T =>
    effectiveScope === "me" ? q.eq("owner_id", userId) : q;

  // 2) Negócios do pipeline selecionado
  let dealsQ = supabase
    .from("deals")
    .select(
      "id, name, value, stage, stage_id, pipeline_id, owner_id, assigned_to, company_id, expected_close_date, closed_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(3000);
  if (selected) dealsQ = dealsQ.eq("pipeline_id", selected.id);
  dealsQ = mine(dealsQ);

  // Consultas secundárias não podem derrubar o painel inteiro: em caso de
  // falha, o bloco correspondente fica vazio.
  const safe = <T>(p: PromiseLike<{ data: T | null; error?: unknown }>) =>
    Promise.resolve(p).then(
      (r) => r,
      () => ({ data: null }) as { data: T | null; error?: unknown },
    );

  // 3) Demais consultas em paralelo
  const [dealsRes, acts14Res, acts30Res, meetingsRes, bookingsRes, tasksRes, goalsRes, leadsRes] =
    await Promise.all([
      dealsQ,
      mine(
        supabase
          .from("activities")
          .select("id, type, created_at")
          .eq("workspace_id", workspaceId)
          .gte("created_at", d14.toISOString())
          .limit(5000),
      ),
      mine(
        supabase
          .from("activities")
          .select("related_deal_id, created_at")
          .eq("workspace_id", workspaceId)
          .not("related_deal_id", "is", null)
          .gte("created_at", d30.toISOString())
          .limit(10000),
      ),
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
      supabase
        .from("activities")
        .select("id, subject, due_date, type, completed")
        .eq("workspace_id", workspaceId)
        .eq("owner_id", userId)
        .eq("completed", false)
        .not("due_date", "is", null)
        .order("due_date", { ascending: true })
        .limit(12),
      mine(
        supabase
          .from("goals")
          .select("id, metric, target_value, period_start, period_end, pipeline_id, target_user_id")
          .eq("workspace_id", workspaceId)
          .eq("metric", "deals_won_value")
          .lte("period_start", isoDay(monthEnd))
          .gte("period_end", isoDay(monthStart)),
      ),
      mine(
        supabase
          .from("leads")
          .select("id, first_name, last_name, company_name, status, updated_at")
          .eq("workspace_id", workspaceId)
          .in("status", ["new", "contacted", "nurturing"])
          .order("updated_at", { ascending: true })
          .limit(500),
      ),
    ]);

  if (dealsRes.error) throw new Error(dealsRes.error.message);

  const deals = (dealsRes.data ?? []) as unknown as DealRow[];
  const openDeals = deals.filter((d) => !isClosed(d, stages));
  const closed = deals.filter((d) => isClosed(d, stages) && d.closed_at);

  const inRange = (iso: string | null, a: Date, b: Date) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= a.getTime() && t <= b.getTime();
  };

  const wonPeriod = closed.filter(
    (d) => isWon(d, stages) && inRange(d.closed_at, periodStart, now),
  );
  const lostPeriod = closed.filter(
    (d) => !isWon(d, stages) && inRange(d.closed_at, periodStart, now),
  );
  const wonPrev = closed.filter(
    (d) => isWon(d, stages) && inRange(d.closed_at, prevPeriodStart, prevPeriodEnd),
  );
  const lostPrev = closed.filter(
    (d) => !isWon(d, stages) && inRange(d.closed_at, prevPeriodStart, prevPeriodEnd),
  );
  const wonMonth = closed.filter(
    (d) => isWon(d, stages) && inRange(d.closed_at, monthStart, monthEnd),
  );

  const sum = (rows: DealRow[]) => rows.reduce((acc, d) => acc + (d.value ?? 0), 0);
  const conv = (w: DealRow[], l: DealRow[]) =>
    w.length + l.length > 0 ? (w.length / (w.length + l.length)) * 100 : 0;

  const forecastDeals = openDeals.filter(
    (d) => d.expected_close_date && inRange(d.expected_close_date, monthStart, monthEnd),
  );
  const forecastValue = forecastDeals.reduce(
    (acc, d) => acc + (d.value ?? 0) * (probabilityOf(d, stages) / 100),
    0,
  );

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

  // Última atividade por negócio (janela de 30 dias)
  const lastActivityByDeal = new Map<string, number>();
  for (const a of (acts30Res.data ?? []) as Array<{
    related_deal_id: string | null;
    created_at: string | null;
  }>) {
    if (!a.related_deal_id || !a.created_at) continue;
    const t = new Date(a.created_at).getTime();
    const prev = lastActivityByDeal.get(a.related_deal_id) ?? 0;
    if (t > prev) lastActivityByDeal.set(a.related_deal_id, t);
  }

  const riskOf = (d: DealRow): DealListItem["risk"] => {
    if (d.expected_close_date && new Date(d.expected_close_date).getTime() < today.getTime()) {
      return "overdue_close";
    }
    const last = lastActivityByDeal.get(d.id);
    if (!last || now.getTime() - last > 7 * DAY_MS) return "no_recent_activity";
    return null;
  };

  const toItem = (d: DealRow): DealListItem => {
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
  const advancedDeals = openDeals
    .filter((d) => probabilityOf(d, stages) >= 60)
    .map(toItem)
    .sort((a, b) => b.hotScore - a.hotScore)
    .slice(0, 8);
  const advancedIds = new Set(advancedDeals.map((d) => d.id));

  // Negócios que precisam de atenção
  const attentionDeals = openDeals
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
    const day = isoDay(d);
    const row: ContactsByDay = {
      day,
      label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
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
  for (const a of (acts14Res.data ?? []) as Array<{
    type: string;
    created_at: string | null;
  }>) {
    if (!a.created_at) continue;
    const row = byDay.get(a.created_at.slice(0, 10));
    if (!row) continue;
    const key =
      a.type === "call"
        ? "calls"
        : a.type === "email"
          ? "emails"
          : a.type === "whatsapp"
            ? "whatsapp"
            : a.type === "meeting"
              ? "meetings"
              : "other";
    row[key] += 1;
    row.total += 1;
    void bucketKeys;
  }

  // Funil do pipeline selecionado (apenas etapas abertas)
  const funnel: FunnelStageRow[] = stages
    .filter((s) => s.type === "open")
    .map((s) => {
      const rows = openDeals.filter(
        (d) => (d.stage_id || d.stage) === s.value || d.stage === s.value,
      );
      return {
        value: s.value,
        label: s.label,
        color: s.color ?? null,
        probability: s.probability ?? 0,
        count: rows.length,
        valueSum: sum(rows),
      };
    });

  // Leads a trabalhar
  const leadsRows = (leadsRes.data ?? []) as Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    status: string;
  }>;

  return {
    pipelines: pipelines.map((p) => ({ id: p.id, name: p.name, isDefault: p.is_default })),
    selectedPipelineId: selected?.id ?? null,
    selectedPipelineName: selected?.name ?? null,
    canViewTeam,
    effectiveScope,
    kpis: {
      pipelineValue: sum(openDeals),
      openDeals: openDeals.length,
      forecastValue,
      forecastDeals: forecastDeals.length,
      wonValue: sum(wonMonth),
      wonCount: wonMonth.length,
      goalValue,
      conversionRate: conv(wonPeriod, lostPeriod),
      conversionDelta:
        wonPrev.length + lostPrev.length > 0
          ? conv(wonPeriod, lostPeriod) - conv(wonPrev, lostPrev)
          : null,
      wonDeltaPct: sum(wonPrev) > 0 ? ((sum(wonPeriod) - sum(wonPrev)) / sum(wonPrev)) * 100 : null,
      avgTicket: wonPeriod.length > 0 ? sum(wonPeriod) / wonPeriod.length : null,
    },
    advancedDeals,
    attentionDeals,
    meetings,
    tasks,
    contactsByDay,
    funnel,
    leadsToWork: {
      count: leadsRows.length,
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
