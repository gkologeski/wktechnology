import { describe, it, expect } from "vitest";
import {
  buildActionMatrix,
  resolveResources,
  scopeLabel,
  type PermissionCatalogRow,
} from "./action-matrix";

const catalog: PermissionCatalogRow[] = [
  {
    key: "techsales.deals.view.own",
    module: "techsales",
    resource: "deals",
    action: "view",
    scope: "own",
    label_pt: "Ver próprios negócios",
  },
  {
    key: "techsales.deals.view.team",
    module: "techsales",
    resource: "deals",
    action: "view",
    scope: "team",
    label_pt: "Ver negócios da equipe",
  },
  {
    key: "techsales.deals.view.workspace",
    module: "techsales",
    resource: "deals",
    action: "view",
    scope: "workspace",
    label_pt: "Ver todos os negócios",
  },
  {
    key: "techsales.deals.create.own",
    module: "techsales",
    resource: "deals",
    action: "create",
    scope: "own",
    label_pt: "Criar negócios",
  },
  {
    key: "techsales.deals.approve.team",
    module: "techsales",
    resource: "deals",
    action: "approve",
    scope: "team",
    label_pt: "Aprovar descontos",
  },
];

describe("resolveResources", () => {
  it("usa o catálogo quando a chave existe", () => {
    expect(resolveResources(["techsales.deals.view.workspace"], catalog)).toEqual([
      "techsales.deals",
    ]);
  });

  it("faz parse tolerante de chaves sem escopo", () => {
    expect(resolveResources(["techsales.prospecting.search.view"], catalog)).toEqual([
      "techsales.prospecting.search",
    ]);
  });
});

describe("buildActionMatrix", () => {
  it("retorna vazio quando o recurso não existe no catálogo", () => {
    expect(buildActionMatrix(["techsales.unknown"], catalog, new Set())).toEqual([]);
  });

  it("marca sem acesso quando nenhuma chave foi concedida", () => {
    const rows = buildActionMatrix(["techsales.deals"], catalog, new Set());
    expect(rows.map((r) => r.label)).toEqual(["Exibir", "Criar", "Aprovar"]);
    expect(rows.every((r) => r.effectiveScope === null)).toBe(true);
    expect(scopeLabel(rows[0].effectiveScope)).toBe("Sem acesso");
  });

  it("prevalece o escopo mais amplo concedido", () => {
    const rows = buildActionMatrix(
      ["techsales.deals"],
      catalog,
      new Set(["techsales.deals.view.own", "techsales.deals.view.workspace"]),
    );
    const view = rows.find((r) => r.action === "view")!;
    expect(view.effectiveScope).toBe("workspace");
    expect(scopeLabel(view.effectiveScope)).toBe("Todos os registros");
  });

  it("oculta ações inexistentes no catálogo do recurso", () => {
    const rows = buildActionMatrix(["techsales.deals"], catalog, new Set());
    expect(rows.some((r) => r.action === "delete")).toBe(false);
  });
});
