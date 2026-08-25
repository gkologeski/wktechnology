/**
 * ICP (Perfil de Cliente Ideal) como pontuação + contribuições de score.
 *
 * Uma "contribuição" é uma parcela do score de um registro com origem
 * identificada (`rules`, `qualification`, `icp`). O par
 * (entity, entity_id, source, source_key) é único, então reaplicar a mesma
 * parcela ajusta o valor em vez de somar de novo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { evalScoringCondition } from "@/lib/scoring/engine.server";

type AnyRow = Record<string, unknown>;

export type IcpCriterion = {
  id: string;
  name: string;
  entity: "lead" | "company";
  field: string;
  op: string;
  value: unknown;
  points: number;
  enabled: boolean;
};

export type ScoreSource = "rules" | "qualification" | "icp";

export interface ContributionInput {
  ownerId: string;
  workspaceId: string;
  entity: "leads" | "contacts" | "companies";
  entityId: string;
  source: ScoreSource;
  sourceKey?: string;
  points: number;
  reason?: string | null;
}

/**
 * Grava/atualiza a parcela e aplica no score do registro apenas a diferença,
 * garantindo idempotência mesmo quando a qualificação é reeditada.
 */
export async function applyScoreContribution(
  supabase: SupabaseClient,
  input: ContributionInput,
): Promise<{ delta: number }> {
  const sourceKey = input.sourceKey ?? "";
  const { data: existing } = await supabase
    .from("score_contributions")
    .select("id, points")
    .eq("entity", input.entity)
    .eq("entity_id", input.entityId)
    .eq("source", input.source)
    .eq("source_key", sourceKey)
    .maybeSingle();

  const previous = Number((existing as { points?: number } | null)?.points ?? 0);
  const delta = input.points - previous;

  if (existing) {
    const { error } = await supabase
      .from("score_contributions")
      .update({ points: input.points, reason: input.reason ?? null } as never)
      .eq("id", (existing as { id: string }).id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("score_contributions").insert({
      owner_id: input.ownerId,
      workspace_id: input.workspaceId,
      entity: input.entity,
      entity_id: input.entityId,
      source: input.source,
      source_key: sourceKey,
      points: input.points,
      reason: input.reason ?? null,
    } as never);
    if (error) throw new Error(error.message);
  }

  if (delta !== 0) {
    const { data: row } = await supabase
      .from(input.entity)
      .select("score")
      .eq("id", input.entityId)
      .maybeSingle();
    const current = Number((row?.score as number | null) ?? 0);
    await supabase
      .from(input.entity)
      .update({ score: current + delta } as never)
      .eq("id", input.entityId);
  }

  return { delta };
}

export interface IcpFit {
  points: number;
  max: number;
  percent: number | null;
  matched: { id: string; name: string; points: number }[];
  level: "high" | "medium" | "low" | "unknown";
}

export function icpLevel(percent: number | null): IcpFit["level"] {
  if (percent == null) return "unknown";
  if (percent >= 70) return "high";
  if (percent >= 40) return "medium";
  return "low";
}

/** Avalia os critérios de ICP contra o lead e a empresa vinculada. */
export function computeIcpFit(
  criteria: IcpCriterion[],
  lead: AnyRow | null,
  company: AnyRow | null,
): IcpFit {
  let points = 0;
  let max = 0;
  const matched: IcpFit["matched"] = [];

  for (const c of criteria) {
    if (!c.enabled) continue;
    const pts = Number(c.points ?? 0);
    if (pts > 0) max += pts;
    const target = c.entity === "company" ? company : lead;
    if (!target) continue;
    const ok = evalScoringCondition({ field: c.field, op: c.op, value: c.value }, target, null);
    if (!ok) continue;
    points += pts;
    matched.push({ id: c.id, name: c.name, points: pts });
  }

  const percent = max > 0 ? Math.max(0, Math.min(100, Math.round((points / max) * 100))) : null;
  return { points, max, percent, matched, level: icpLevel(percent) };
}

export interface IcpScanResult {
  criteria: number;
  scanned: number;
  updated: number;
}

/**
 * Aplica a pontuação de ICP em todos os leads visíveis por RLS.
 * Reexecutar não duplica pontos: a parcela `icp` é ajustada por delta.
 */
export async function runIcpScan(
  supabase: SupabaseClient,
  opts: { ownerId: string; workspaceId: string; pageSize?: number },
): Promise<IcpScanResult> {
  const pageSize = opts.pageSize ?? 300;
  const result: IcpScanResult = { criteria: 0, scanned: 0, updated: 0 };

  const { data: rows, error } = await supabase
    .from("icp_criteria")
    .select("id, name, entity, field, op, value, points, enabled")
    .eq("enabled", true);
  if (error) throw new Error(error.message);
  const criteria = (rows ?? []) as unknown as IcpCriterion[];
  result.criteria = criteria.length;
  if (criteria.length === 0) return result;

  let lastId: string | null = null;
  for (;;) {
    let q = supabase.from("leads").select("*").order("id", { ascending: true }).limit(pageSize);
    if (lastId) q = q.gt("id", lastId);
    const { data: leads, error: lErr } = await q;
    if (lErr) throw new Error(lErr.message);
    if (!leads?.length) break;

    const companyIds = Array.from(
      new Set(
        (leads as AnyRow[])
          .map((l) => l.company_id as string | null)
          .filter((v): v is string => !!v),
      ),
    );
    const companies = new Map<string, AnyRow>();
    if (companyIds.length > 0) {
      const { data: cRows } = await supabase.from("companies").select("*").in("id", companyIds);
      for (const c of (cRows ?? []) as AnyRow[]) companies.set(c.id as string, c);
    }

    for (const lead of leads as AnyRow[]) {
      result.scanned += 1;
      lastId = (lead.id as string) ?? lastId;
      const company = lead.company_id ? (companies.get(lead.company_id as string) ?? null) : null;
      const fit = computeIcpFit(criteria, lead, company);
      const { delta } = await applyScoreContribution(supabase, {
        ownerId: opts.ownerId,
        workspaceId: opts.workspaceId,
        entity: "leads",
        entityId: lead.id as string,
        source: "icp",
        points: fit.points,
        reason: `ICP: ${fit.matched.length} critério(s)`,
      });
      if (delta !== 0) result.updated += 1;
    }

    if (leads.length < pageSize) break;
  }

  return result;
}

/** Fit de ICP de um lead específico (usado no detalhe e na qualificação). */
export async function getLeadIcpFit(
  supabase: SupabaseClient,
  leadId: string,
): Promise<IcpFit & { criteriaCount: number }> {
  const { data: rows } = await supabase
    .from("icp_criteria")
    .select("id, name, entity, field, op, value, points, enabled")
    .eq("enabled", true);
  const criteria = (rows ?? []) as unknown as IcpCriterion[];
  const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
  let company: AnyRow | null = null;
  const companyId = (lead as AnyRow | null)?.company_id as string | null | undefined;
  if (companyId) {
    const { data: c } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .maybeSingle();
    company = (c as AnyRow | null) ?? null;
  }
  const fit = computeIcpFit(criteria, (lead as AnyRow | null) ?? null, company);
  return { ...fit, criteriaCount: criteria.length };
}
