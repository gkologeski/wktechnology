import { describe, expect, it } from "vitest";

// Modelo da regra de leitura do TechProjects (work_context_access) e do atalho por workspace
// (work_view_full_workspace, migration 0277). O atalho só libera o que a regra original já libera.
type Ctx = { workspace?: string; actor?: string; keys?: Record<string, true>; team?: Record<string, true> };

function workContextAccess(c: Ctx, w: string, r: string, responsibles: string[]) {
  if (!c.workspace || c.workspace !== w || !c.actor) return false;
  const k = c.keys ?? {};
  if (k[`${r}.view.workspace`]) return true;
  if (k[`${r}.view.own`] && responsibles.includes(c.actor)) return true;
  if (k[`${r}.view.team`] && responsibles.some((x) => c.team?.[x])) return true;
  return false;
}
function fullWorkspace(c: Ctx, r: string) {
  return c.actor && c.workspace && c.keys?.[`${r}.view.workspace`] ? c.workspace : null;
}
const R = "techprojects.tasks";
type Row = { workspace: string; responsible: string };
const fast = (c: Ctx, row: Row) =>
  row.workspace === fullWorkspace(c, R) || workContextAccess(c, row.workspace, R, [row.responsible]);
const orig = (c: Ctx, row: Row) => workContextAccess(c, row.workspace, R, [row.responsible]);

const A = "ws-a", B = "ws-b", ME = "me", OTHER = "other";
const rows: Row[] = [
  { workspace: A, responsible: ME },
  { workspace: A, responsible: OTHER },
  { workspace: B, responsible: ME },
];
const same = (c: Ctx) => rows.forEach((row) => expect(fast(c, row)).toBe(orig(c, row)));

describe("atalho por workspace nas regras de leitura do TechProjects", () => {
  it("work fast path allows an active member with the workspace view key", () => {
    const c: Ctx = { workspace: A, actor: ME, keys: { [`${R}.view.workspace`]: true } };
    expect(fullWorkspace(c, R)).toBe(A);
    expect(fast(c, { workspace: A, responsible: OTHER })).toBe(true);
    same(c);
  });
  it("work fast path refuses a member without the view key", () => {
    const c: Ctx = { workspace: A, actor: ME, keys: {} };
    expect(fullWorkspace(c, R)).toBeNull();
    rows.forEach((row) => expect(fast(c, row)).toBe(false));
  });
  it("work fast path keeps an explicit deny of the workspace key", () => {
    const c: Ctx = { workspace: A, actor: ME, keys: { [`${R}.view.own`]: true } };
    expect(fullWorkspace(c, R)).toBeNull();
    expect(fast(c, { workspace: A, responsible: OTHER })).toBe(false);
    same(c);
  });
  it("work fast path refuses rows from a foreign workspace", () => {
    const c: Ctx = { workspace: A, actor: ME, keys: { [`${R}.view.workspace`]: true } };
    expect(fast(c, { workspace: B, responsible: ME })).toBe(false);
  });
  it("work fast path refuses an inactive member", () => {
    const c: Ctx = {}; // contexto vazio quando o membership não está ativo
    expect(fullWorkspace(c, R)).toBeNull();
    rows.forEach((row) => expect(fast(c, row)).toBe(false));
  });
});
