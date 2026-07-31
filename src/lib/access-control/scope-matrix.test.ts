import { describe, it, expect } from "vitest";
import {
  buildScopeMatrixRows,
  effectiveScope,
  keysForSelection,
  selectValue,
  prettyResource,
  NONE_VALUE,
  type ScopePermissionRow,
} from "./scope-matrix";

function perm(
  module: string,
  resource: string,
  action: string,
  scope: string,
  label_pt = `${action} ${resource}`,
): ScopePermissionRow {
  return {
    key: `${module}.${resource}.${action}.${scope}`,
    module,
    resource,
    action,
    scope,
    label_pt,
  };
}

const catalog: ScopePermissionRow[] = [
  perm("techsales", "activities", "view", "own"),
  perm("techsales", "activities", "view", "team"),
  perm("techsales", "activities", "view", "workspace"),
  perm("techsales", "activities", "create", "own"),
  perm("techsales", "activities", "create", "workspace"),
  perm("techsales", "activities", "export", "workspace"),
  perm("techsales", "deals", "approve", "team"),
  perm("techsales", "deals", "approve", "workspace"),
];

describe("buildScopeMatrixRows", () => {
  const rows = buildScopeMatrixRows(catalog);
  const byId = new Map(rows.map((r) => [r.id, r]));

  it("cria uma linha por módulo/recurso/ação", () => {
    expect(rows).toHaveLength(4);
    expect(byId.has("techsales.activities.view")).toBe(true);
  });

  it("expõe os três escopos em ações escopáveis", () => {
    expect(byId.get("techsales.activities.view")!.options).toEqual(["workspace", "team", "own"]);
    expect(byId.get("techsales.activities.view")!.lockedScope).toBeNull();
  });

  it("trava Criar em Meu(s)/Minha(s)", () => {
    const row = byId.get("techsales.activities.create")!;
    expect(row.options).toEqual(["own"]);
    expect(row.lockedScope).toBe("own");
  });

  it("trava Exportar em Todos", () => {
    const row = byId.get("techsales.activities.export")!;
    expect(row.options).toEqual(["workspace"]);
    expect(row.lockedScope).toBe("workspace");
  });

  it("mantém escolha quando só há team/workspace", () => {
    const row = byId.get("techsales.deals.approve")!;
    expect(row.options).toEqual(["workspace", "team"]);
    expect(row.lockedScope).toBeNull();
  });

  it("ordena ações na ordem canônica", () => {
    const acts = rows.filter((r) => r.resource === "activities").map((r) => r.action);
    expect(acts).toEqual(["view", "create", "export"]);
  });
});

describe("escopo efetivo e diff de chaves", () => {
  const rows = buildScopeMatrixRows(catalog);
  const view = rows.find((r) => r.id === "techsales.activities.view")!;

  it("retorna o escopo mais amplo concedido", () => {
    expect(effectiveScope(view, new Set(["techsales.activities.view.own"]))).toBe("own");
    expect(
      effectiveScope(
        view,
        new Set(["techsales.activities.view.own", "techsales.activities.view.workspace"]),
      ),
    ).toBe("workspace");
  });

  it("sem chaves concedidas → sem acesso", () => {
    expect(effectiveScope(view, new Set())).toBeNull();
    expect(selectValue(view, new Set())).toBe(NONE_VALUE);
  });

  it("selecionar um escopo concede uma chave e revoga as demais", () => {
    expect(keysForSelection(view, "team")).toEqual({
      grant: ["techsales.activities.view.team"],
      revoke: ["techsales.activities.view.own", "techsales.activities.view.workspace"],
    });
  });

  it("selecionar Nenhuma revoga tudo", () => {
    const res = keysForSelection(view, null);
    expect(res.grant).toEqual([]);
    expect(res.revoke).toHaveLength(3);
  });
});

describe("prettyResource", () => {
  it("formata slugs", () => {
    expect(prettyResource("task_queues")).toBe("Task queues");
    expect(prettyResource("marketing.landing_pages")).toBe("Landing pages");
  });
});
