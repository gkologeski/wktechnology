import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Modelo da regra de leitura do TechSales (sales_context_access, migration 0222) e do atalho
// por workspace (sales_full_grants, migration 0276). O atalho só pode liberar o que a regra
// original já libera; quando não casa, a regra original continua decidindo linha a linha.
type Ctx = {
  workspace?: string;
  actor?: string;
  keys?: Record<string, true>;
  team?: Record<string, true>;
  read_only?: boolean;
};

function salesContextAccess(c: Ctx, w: string, r: string, a: string, responsibles: string[]) {
  if (!c.workspace || c.workspace !== w || !c.actor) return false;
  if (a !== "view" && (c.read_only ?? true)) return false;
  const keys = c.keys ?? {};
  if (keys[`${r}.${a}.workspace`]) return true;
  if (keys[`${r}.${a}.own`] && responsibles.includes(c.actor)) return true;
  if (
    keys[`${r}.${a}.team`] &&
    (responsibles.includes(c.actor) || responsibles.some((x) => c.team?.[x]))
  )
    return true;
  return false;
}

function salesFullGrants(c: Ctx, resources: string[], a: string) {
  if (!c.workspace) return [];
  return resources
    .filter((r) => salesContextAccess(c, c.workspace!, r, a, []))
    .map((r) => `${c.workspace}:${r}`);
}

type Row = { workspace: string; responsible: string };
const R = "techsales.contacts";
function originalPolicy(c: Ctx, row: Row) {
  return salesContextAccess(c, row.workspace, R, "view", [row.responsible]);
}
function fastPathPolicy(c: Ctx, row: Row) {
  return (
    salesFullGrants(c, [R], "view").includes(`${row.workspace}:${R}`) ||
    salesContextAccess(c, row.workspace, R, "view", [row.responsible])
  );
}

const A = "workspace-a",
  B = "workspace-b",
  ME = "actor-me",
  MATE = "actor-mate",
  OTHER = "actor-other";
const rows: Row[] = [
  { workspace: A, responsible: ME },
  { workspace: A, responsible: MATE },
  { workspace: A, responsible: OTHER },
  { workspace: B, responsible: ME },
];

describe("atalho por workspace nas regras de leitura do TechSales", () => {
  it("sales fast path allows an active member with the workspace view key", () => {
    const c: Ctx = { workspace: A, actor: ME, keys: { [`${R}.view.workspace`]: true } };
    expect(salesFullGrants(c, [R], "view")).toEqual([`${A}:${R}`]);
    expect(fastPathPolicy(c, { workspace: A, responsible: OTHER })).toBe(true);
    for (const row of rows) expect(fastPathPolicy(c, row)).toBe(originalPolicy(c, row));
  });

  it("sales fast path refuses a member without the view key", () => {
    const c: Ctx = { workspace: A, actor: ME, keys: {} };
    expect(salesFullGrants(c, [R], "view")).toEqual([]);
    for (const row of rows) expect(fastPathPolicy(c, row)).toBe(false);
  });

  it("sales fast path keeps an explicit deny of the workspace key", () => {
    // O deny é resolvido antes, em user_effective_permissions: a chave negada não chega ao contexto.
    const c: Ctx = { workspace: A, actor: ME, keys: { [`${R}.view.own`]: true } };
    expect(salesFullGrants(c, [R], "view")).toEqual([]);
    expect(fastPathPolicy(c, { workspace: A, responsible: OTHER })).toBe(false);
    expect(fastPathPolicy(c, { workspace: A, responsible: ME })).toBe(true);
    for (const row of rows) expect(fastPathPolicy(c, row)).toBe(originalPolicy(c, row));
  });

  it("sales fast path refuses rows from a foreign workspace", () => {
    const c: Ctx = { workspace: A, actor: ME, keys: { [`${R}.view.workspace`]: true } };
    expect(fastPathPolicy(c, { workspace: B, responsible: ME })).toBe(false);
    expect(fastPathPolicy(c, { workspace: B, responsible: OTHER })).toBe(false);
  });

  it("sales fast path refuses an inactive member", () => {
    // work_access_context devolve {} quando is_workspace_member falha (membro inativo).
    const c: Ctx = {};
    expect(salesFullGrants(c, [R], "view")).toEqual([]);
    for (const row of rows) expect(fastPathPolicy(c, row)).toBe(false);
  });

  it("sales fast path never differs from the original rule", () => {
    const keySets: Record<string, true>[] = [
      {},
      { [`${R}.view.own`]: true },
      { [`${R}.view.team`]: true },
      { [`${R}.view.workspace`]: true },
      { [`${R}.view.own`]: true, [`${R}.view.workspace`]: true },
    ];
    for (const keys of keySets)
      for (const workspace of [A, B, undefined])
        for (const actor of [ME, undefined]) {
          const c: Ctx = { workspace, actor, keys, team: { [MATE]: true } };
          for (const row of rows) expect(fastPathPolicy(c, row)).toBe(originalPolicy(c, row));
        }
  });

  it("migration keeps the original per-row rule as fallback on every table", () => {
    const sql = readFileSync("drizzle/migrations/0276_sales_rls_workspace_fast_path.sql", "utf8");
    for (const t of ["contacts", "companies", "leads", "deals", "activities"]) {
      const start = sql.indexOf(`ALTER POLICY sales_view ON public.${t}`);
      expect(start).toBeGreaterThan(-1);
      const block = sql.slice(start, sql.indexOf(";", start));
      expect(block).toContain("IN (SELECT public.sales_full_grants(");
      expect(block).toContain("OR public.sales_context_access((SELECT public.sales_policy_context(");
      expect(block).toContain("ARRAY[COALESCE(assigned_to, owner_id)]");
    }
    expect(sql).toContain("ARRAY[]::uuid[]");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.sales_full_grants(text[], text) FROM PUBLIC, anon;");
  });
});
