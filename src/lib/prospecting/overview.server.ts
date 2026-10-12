// Indicadores reais da Prospecção (Visão geral e Resultados).
// Regras: workspace canônico com membership ativa; leitura com o cliente do
// usuário (RLS aplica own/team/workspace); cada indicador declara origem e
// cobertura — sem permissão, erro ou fonte inexistente nunca vira zero.
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasPermission } from "@/lib/access-control/enforce.server";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

export type Coverage = "ok" | "no_access" | "error" | "truncated" | "not_tracked";
export type Metric = {
  key: string;
  label: string;
  origin: string;
  value: number | null;
  coverage: Coverage;
  note?: string;
};

const ROW_CAP = 5000;
const DAYS = 30;

const PERMS = {
  cadences: ["techsales.prospecting.cadences.view", "techsales.prospecting.cadences.view.own"],
  queue: [
    "techsales.prospecting.queue.view",
    "techsales.prospecting.queue.view.workspace",
    "techsales.prospecting.queue.view.team",
    "techsales.prospecting.queue.view.own",
  ],
  voice: ["techsales.prospecting.voice.view"],
  whatsapp: [
    "techsales.marketing.campaigns.view.workspace",
    "techsales.marketing.campaigns.view.team",
    "techsales.marketing.campaigns.view.own",
  ],
  sdr: [
    "techsales.marketing.sdr_agent.view.workspace",
    "techsales.marketing.sdr_agent.view.team",
    "techsales.marketing.sdr_agent.view.own",
  ],
} as const;
type Domain = keyof typeof PERMS;

/** Resolve workspace canônico e quais domínios o usuário pode ler. */
export async function prospectingAccess(supabase: SupabaseClient, userId: string) {
  const ws = await resolveActiveWorkspace(userId);
  const entries = await Promise.all(
    (Object.keys(PERMS) as Domain[]).map(async (d) => {
      for (const k of PERMS[d]) if (await hasPermission(supabase, userId, ws, k)) return [d, true];
      return [d, false];
    }),
  );
  return { ws, can: Object.fromEntries(entries) as Record<Domain, boolean> };
}

export function sinceIso(days = DAYS, now = new Date()) {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

/** Monta um indicador a partir de uma contagem, preservando a cobertura. */
export function metric(
  base: Omit<Metric, "value" | "coverage">,
  allowed: boolean,
  res: { count: number | null; error: unknown } | null,
): Metric {
  if (!allowed) return { ...base, value: null, coverage: "no_access" };
  if (!res || res.error || res.count == null) return { ...base, value: null, coverage: "error" };
  return { ...base, value: res.count, coverage: "ok" };
}

const head = { count: "exact" as const, head: true };

export async function loadOverview(supabase: SupabaseClient, userId: string) {
  const { ws, can } = await prospectingAccess(supabase, userId);
  const since = sinceIso();
  const nowIso = new Date().toISOString();
  const none = Promise.resolve(null);
  const [due, drafts, qualified, meetings, callFail, sdrFail, waFail] = await Promise.all([
    can.cadences
      ? supabase
          .from("prospecting_enrollments")
          .select("id", head)
          .eq("workspace_id", ws)
          .eq("status", "active")
          .lte("next_run_at", nowIso)
      : none,
    can.sdr
      ? supabase
          .from("sdr_turn_jobs")
          .select("id", head)
          .eq("workspace_id", ws)
          .eq("status", "drafted")
      : none,
    can.queue
      ? supabase
          .from("prospecting_qualifications")
          .select("id", head)
          .eq("workspace_id", ws)
          .eq("decision", "qualified")
          .gte("qualified_at", since)
      : none,
    can.sdr
      ? supabase
          .from("sdr_enrollments")
          .select("id", head)
          .eq("workspace_id", ws)
          .not("booking_id", "is", null)
          .gte("created_at", since)
      : none,
    can.voice
      ? supabase
          .from("prospecting_call_attempts")
          .select("id", head)
          .eq("workspace_id", ws)
          .eq("status", "failed")
          .gte("created_at", since)
      : none,
    can.sdr
      ? supabase
          .from("sdr_turn_jobs")
          .select("id", head)
          .eq("workspace_id", ws)
          .eq("status", "failed")
          .gte("created_at", since)
      : none,
    can.whatsapp
      ? supabase
          .from("whatsapp_campaigns")
          .select("failed")
          .eq("workspace_id", ws)
          .gte("updated_at", since)
          .limit(ROW_CAP)
      : none,
  ]);
  const waFailSum =
    waFail && !waFail.error
      ? {
          count: (waFail.data ?? []).reduce(
            (s, r) => s + Number((r as { failed: number | null }).failed ?? 0),
            0,
          ),
          error: null,
        }
      : waFail;
  const metrics: Metric[] = [
    metric(
      { key: "due", label: "Próximas ações vencidas", origin: "Cadências · inscrições ativas" },
      can.cadences,
      due,
    ),
    metric(
      { key: "drafts", label: "Respostas aguardando revisão", origin: "Agente SDR · WhatsApp" },
      can.sdr,
      drafts,
    ),
    metric(
      { key: "qualified", label: "Qualificados (30 dias)", origin: "Qualificação da Prospecção" },
      can.queue,
      qualified,
    ),
    metric(
      {
        key: "meetings",
        label: "Reuniões agendadas pelo SDR (30 dias)",
        origin: "Agente SDR · agendamentos vinculados",
        note: "Reuniões marcadas manualmente não entram neste número.",
      },
      can.sdr,
      meetings,
    ),
  ];
  const failures: Metric[] = [
    metric(
      { key: "call_failed", label: "Ligações com falha", origin: "Campanhas de voz" },
      can.voice,
      callFail,
    ),
    metric(
      { key: "sdr_failed", label: "Turnos do SDR com falha", origin: "Agente SDR · WhatsApp" },
      can.sdr,
      sdrFail,
    ),
    metric(
      { key: "wa_failed", label: "Envios de WhatsApp com falha", origin: "Campanhas de WhatsApp" },
      can.whatsapp,
      waFailSum,
    ),
  ];
  if (waFail && !waFail.error && (waFail.data?.length ?? 0) >= ROW_CAP)
    failures[2].coverage = "truncated";
  return { workspaceId: ws, periodDays: DAYS, metrics, failures };
}

type Row = Record<string, unknown>;
export type ResultRow = {
  id: string;
  name: string;
  dimension: "campanha" | "agente" | "canal";
  channel: string;
  origin: string;
  values: Record<string, number | null>;
};

/** Agrupa linhas por chave, contando por um campo de status. */
export function groupCount(rows: Row[], key: string, field: string) {
  const out = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const k = String(r[key] ?? "");
    if (!k) continue;
    const g = out.get(k) ?? {};
    const v = String(r[field] ?? "sem_status");
    g[v] = (g[v] ?? 0) + 1;
    g.total = (g.total ?? 0) + 1;
    out.set(k, g);
  }
  return out;
}

export async function loadResults(supabase: SupabaseClient, userId: string) {
  const { ws, can } = await prospectingAccess(supabase, userId);
  const since = sinceIso();
  const none = Promise.resolve(null);
  const [vc, va, wa, pb, se, ql] = await Promise.all([
    can.voice
      ? supabase.from("prospecting_campaigns").select("id, name").eq("workspace_id", ws)
      : none,
    can.voice
      ? supabase
          .from("prospecting_call_attempts")
          .select("campaign_id, status, cost_usd")
          .eq("workspace_id", ws)
          .gte("created_at", since)
          .limit(ROW_CAP)
      : none,
    can.whatsapp
      ? supabase
          .from("whatsapp_campaigns")
          .select("id, name, total, sent, failed, sdr_enabled, sdr_playbook_id")
          .eq("workspace_id", ws)
          .gte("updated_at", since)
          .limit(ROW_CAP)
      : none,
    can.sdr ? supabase.from("sdr_playbooks").select("id, name").eq("workspace_id", ws) : none,
    can.sdr
      ? supabase
          .from("sdr_enrollments")
          .select("playbook_id, qualification_id, booking_id, status")
          .eq("workspace_id", ws)
          .gte("created_at", since)
          .limit(ROW_CAP)
      : none,
    can.queue
      ? supabase
          .from("prospecting_qualifications")
          .select("decision, decision_reason")
          .eq("workspace_id", ws)
          .gte("updated_at", since)
          .limit(ROW_CAP)
      : none,
  ]);

  const sections: {
    key: string;
    title: string;
    origin: string;
    coverage: Coverage;
    rows: ResultRow[];
  }[] = [];
  const cov = (allowed: boolean, ...r: ({ error: unknown; data?: unknown } | null)[]): Coverage =>
    !allowed
      ? "no_access"
      : r.some((x) => !x || x.error)
        ? "error"
        : r.some((x) => Array.isArray(x?.data) && (x!.data as unknown[]).length >= ROW_CAP)
          ? "truncated"
          : "ok";

  // Voz
  {
    const c = cov(can.voice, vc, va);
    const names = new Map(((vc?.data ?? []) as Row[]).map((r) => [String(r.id), String(r.name)]));
    const g = groupCount((va?.data ?? []) as Row[], "campaign_id", "status");
    const cost = new Map<string, number>();
    for (const r of (va?.data ?? []) as Row[])
      cost.set(
        String(r.campaign_id),
        (cost.get(String(r.campaign_id)) ?? 0) + Number(r.cost_usd ?? 0),
      );
    sections.push({
      key: "voice",
      title: "Campanhas de voz",
      origin: "Tentativas de ligação dos últimos 30 dias",
      coverage: c,
      rows: [...g.entries()].map(([id, v]) => ({
        id,
        name: names.get(id) ?? "Campanha removida",
        dimension: "campanha",
        channel: "Voz",
        origin: "prospecting_call_attempts",
        values: {
          tentativas: v.total ?? 0,
          concluidas: v.completed ?? 0,
          falhas: v.failed ?? 0,
          custo_usd: Math.round((cost.get(id) ?? 0) * 100) / 100,
        },
      })),
    });
  }
  // WhatsApp
  {
    const pbNames = new Map(((pb?.data ?? []) as Row[]).map((r) => [String(r.id), String(r.name)]));
    sections.push({
      key: "whatsapp",
      title: "Campanhas de WhatsApp",
      origin: "Contadores de envio das campanhas atualizadas nos últimos 30 dias",
      coverage: cov(can.whatsapp, wa),
      rows: ((wa?.data ?? []) as Row[]).map((r) => ({
        id: String(r.id),
        name: `${String(r.name)}${r.sdr_enabled && r.sdr_playbook_id ? ` · agente ${pbNames.get(String(r.sdr_playbook_id)) ?? "sem acesso"}` : ""}`,
        dimension: "campanha",
        channel: "WhatsApp",
        origin: "whatsapp_campaigns",
        values: {
          publico: Number(r.total ?? 0),
          enviados: Number(r.sent ?? 0),
          falhas: Number(r.failed ?? 0),
        },
      })),
    });
  }
  // Agente SDR
  {
    const names = new Map(((pb?.data ?? []) as Row[]).map((r) => [String(r.id), String(r.name)]));
    const rows = new Map<string, { t: number; q: number; m: number }>();
    for (const r of (se?.data ?? []) as Row[]) {
      const k = String(r.playbook_id ?? "");
      if (!k) continue;
      const g = rows.get(k) ?? { t: 0, q: 0, m: 0 };
      g.t++;
      if (r.qualification_id) g.q++;
      if (r.booking_id) g.m++;
      rows.set(k, g);
    }
    sections.push({
      key: "agent",
      title: "Por agente (SDR WhatsApp)",
      origin: "Atendimentos do agente iniciados nos últimos 30 dias",
      coverage: cov(can.sdr, pb, se),
      rows: [...rows.entries()].map(([id, g]) => ({
        id,
        name: names.get(id) ?? "Agente removido",
        dimension: "agente",
        channel: "WhatsApp",
        origin: "sdr_enrollments",
        values: { atendimentos: g.t, qualificados: g.q, reunioes: g.m },
      })),
    });
  }
  // Motivos de perda (qualificação)
  const reasons = new Map<string, number>();
  const decisions = new Map<string, number>();
  for (const r of (ql?.data ?? []) as Row[]) {
    const d = String(r.decision ?? "pending");
    decisions.set(d, (decisions.get(d) ?? 0) + 1);
    if (d === "disqualified") {
      const reason = String(r.decision_reason ?? "").trim() || "Sem motivo registrado";
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }
  }
  return {
    workspaceId: ws,
    periodDays: DAYS,
    sections,
    qualification: {
      coverage: cov(can.queue, ql),
      decisions: Object.fromEntries(decisions),
      lossReasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
    },
    /** Dimensões que o modelo de dados ainda não registra de forma inequívoca. */
    notTracked: [
      {
        key: "service",
        label: "Por serviço do catálogo",
        note: "Campanhas ainda não guardam o serviço do catálogo; o número não é presumido.",
      },
      {
        key: "ai_usage",
        label: "Consumo de IA por campanha",
        note: "O consumo de IA não é registrado por campanha.",
      },
    ],
  };
}
