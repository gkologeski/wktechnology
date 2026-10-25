import { assertSalesWorker } from "@/lib/access-control/sales-worker.server";
import { assertSalesRecord } from "@/lib/access-control/sales-core.server";
import { workRpc } from "@/lib/access-control/work-core.server";
// Scoring engine: avalia regras de pontuação contra eventos da fila
// workflow_events (reaproveitando a infraestrutura) e aplica pontos
// idempotentemente em leads/contacts/companies.
import type { SupabaseClient } from "@supabase/supabase-js";

type AnyRow = Record<string, unknown>;
type ScoringEntity = "leads" | "contacts" | "companies";

const ENTITY_TO_RULE: Record<ScoringEntity, "lead" | "contact" | "company"> = {
  leads: "lead",
  contacts: "contact",
  companies: "company",
};

interface Condition {
  field?: string;
  op?: string;
  value?: unknown;
}

function getField(obj: AnyRow | null | undefined, path: string): unknown {
  if (!obj || !path) return undefined;
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object") return (acc as AnyRow)[k];
    return undefined;
  }, obj);
}

export function evalScoringCondition(
  c: Condition,
  after: AnyRow | null,
  before: AnyRow | null,
): boolean {
  if (!c?.field || !c?.op) return false;
  const v = getField(after, c.field);
  switch (c.op) {
    case "eq":
      return v === c.value;
    case "neq":
      return v !== c.value;
    case "in": {
      const list = Array.isArray(c.value)
        ? c.value
        : String(c.value ?? "")
            .split(",")
            .map((s) => s.trim());
      return list.includes(v as never);
    }
    case "contains": {
      if (typeof v !== "string") return false;
      const hay = v.toLowerCase();
      const raw = String(c.value ?? "");
      // Se o valor tem vírgulas, tratar como "contém qualquer" dos termos.
      const terms = raw.includes(",")
        ? raw
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
        : [raw.toLowerCase()];
      return terms.some((t) => t && hay.includes(t));
    }
    case "gt":
      return typeof v === "number" && typeof c.value === "number" && v > c.value;
    case "lt":
      return typeof v === "number" && typeof c.value === "number" && v < c.value;
    case "changed_to": {
      const prev = getField(before, c.field);
      return v === c.value && prev !== c.value;
    }
    case "is_empty":
      return v == null || v === "";
    case "is_not_empty":
      return v != null && v !== "";
    default:
      return false;
  }
}

interface TickResult {
  owners: number;
  events: number;
  applied: number;
}

export async function tickScoring(
  supabase: SupabaseClient,
  batchPerOwner = 200,
): Promise<TickResult> {
  const result: TickResult = { owners: 0, events: 0, applied: 0 };

  // Donos que têm pelo menos uma regra ativa.
  const { data: ownersRows, error: oErr } = await supabase
    .from("scoring_rules")
    .select("owner_id, workspace_id")
    .eq("enabled", true);
  if (oErr) throw new Error(oErr.message);
  const scopes = Array.from(
    new Map(
      (ownersRows ?? []).map((r) => [
        JSON.stringify([r.workspace_id, r.owner_id]),
        { ownerId: r.owner_id as string, workspaceId: r.workspace_id as string },
      ]),
    ).values(),
  );
  result.owners = new Set(scopes.map((s) => s.ownerId)).size;

  for (const { ownerId, workspaceId } of scopes) {
    if (!workspaceId) throw new Error("Regra de pontuação sem empresa de origem.");
    // cursor
    const { data: cur } = await supabase
      .from("scoring_cursors")
      .select("last_event_at")
      .eq("workspace_id", workspaceId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    const since = (cur?.last_event_at as string) ?? "1970-01-01T00:00:00Z";

    const { data: events, error: eErr } = await supabase
      .from("workflow_events")
      .select("id, entity, entity_id, event_type, before, after, created_at")
      .eq("workspace_id", workspaceId)
      .eq("owner_id", ownerId)
      .gt("created_at", since)
      .in("entity", ["leads", "contacts", "companies"])
      .order("created_at", { ascending: true })
      .limit(batchPerOwner);
    if (eErr) {
      console.error("[scoring] events", eErr);
      continue;
    }
    if (!events?.length) continue;

    const { data: rules, error: rErr } = await supabase
      .from("scoring_rules")
      .select("id, name, entity, condition, points, enabled, updated_at")
      .eq("workspace_id", workspaceId)
      .eq("owner_id", ownerId)
      .eq("enabled", true);
    if (rErr) {
      console.error("[scoring] rules", rErr);
      continue;
    }

    let maxAt = since;
    for (const ev of events) {
      result.events += 1;
      const evEntity = ev.entity as ScoringEntity;
      if (ev.created_at && (ev.created_at as string) > maxAt) maxAt = ev.created_at as string;

      const ruleEntity = ENTITY_TO_RULE[evEntity];
      const matching = (rules ?? []).filter((r) => r.entity === ruleEntity);
      for (const rule of matching) {
        const ok = evalScoringCondition(
          (rule.condition as Condition) ?? {},
          (ev.after as AnyRow) ?? null,
          (ev.before as AnyRow) ?? null,
        );
        if (!ok) continue;
        const points = Number(rule.points ?? 0);
        if (!points) continue;

        try {
          await assertSalesWorker(supabase, "scoring_rules", rule.id, [
            { table: evEntity, id: ev.entity_id, action: "update" },
          ]);
          if (
            await workRpc<boolean>(supabase, "sales_scoring_apply", {
              p_rule: rule.id,
              p_table: evEntity,
              p_record: ev.entity_id,
              p_expected: rule,
            })
          )
            result.applied += 1;
        } catch (error) {
          console.error(
            "[scoring] current permission/version check",
            error instanceof Error ? error.message : "blocked",
          );
        }
      }
    }

    await supabase.from("scoring_cursors").upsert(
      {
        workspace_id: workspaceId,
        owner_id: ownerId,
        last_event_at: maxAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,owner_id" },
    );
  }

  return result;
}

const RULE_ENTITY_TO_TABLE: Record<"lead" | "contact" | "company", ScoringEntity> = {
  lead: "leads",
  contact: "contacts",
  company: "companies",
};

export interface FullScanResult {
  rules: number;
  scanned: number;
  applied: number;
  skipped: number;
}

/**
 * Executa cada regra de scoring do caller sobre a base inteira visível por RLS,
 * avaliando a condição contra o estado atual do registro. Idempotente via
 * unique constraint em score_events (rule_id, entity, entity_id).
 */
export async function runScoringFullScan(
  supabase: SupabaseClient,
  opts: { pageSize?: number } = {},
): Promise<FullScanResult> {
  const pageSize = opts.pageSize ?? 500;
  const result: FullScanResult = { rules: 0, scanned: 0, applied: 0, skipped: 0 };

  const { data: rules, error: rErr } = await supabase
    .from("scoring_rules")
    .select("id, workspace_id, owner_id, name, entity, condition, points, enabled, updated_at")
    .eq("enabled", true);
  if (rErr) throw new Error(rErr.message);
  if (!rules?.length) return result;
  result.rules = rules.length;

  for (const rule of rules) {
    if (!rule.workspace_id) throw new Error("Regra de pontuação sem empresa de origem.");
    const ruleEntity = rule.entity as "lead" | "contact" | "company";
    const table = RULE_ENTITY_TO_TABLE[ruleEntity];
    if (!table) continue;
    const points = Number(rule.points ?? 0);
    if (!points) continue;
    const condition = (rule.condition as Condition) ?? {};

    let lastId: string | null = null;
    // paginação keyset por id

    while (true) {
      let q = supabase
        .from(table)
        .select("*")
        .eq("workspace_id", rule.workspace_id)
        .order("id", { ascending: true })
        .limit(pageSize);
      if (lastId) q = q.gt("id", lastId);
      const { data: rows, error: eErr } = await q;
      if (eErr) {
        console.error(`[scoring:full-scan] ${table}`, eErr);
        break;
      }
      if (!rows?.length) break;

      for (const row of rows as AnyRow[]) {
        result.scanned += 1;
        lastId = (row.id as string) ?? lastId;
        if (!evalScoringCondition(condition, row, null)) continue;

        await assertSalesRecord(supabase, "scoring_rules", rule.id, "manage");
        await assertSalesRecord(supabase, table, String(row.id), "update");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (
          await workRpc<boolean>(supabaseAdmin, "sales_scoring_apply", {
            p_rule: rule.id,
            p_table: table,
            p_record: row.id,
            p_expected: rule,
          })
        )
          result.applied += 1;
        else result.skipped += 1;
      }

      if (rows.length < pageSize) break;
    }
  }

  return result;
}
