// Testes de "cobertura estática": garantem que cada handler crítico dos módulos
// services e kb chama assertAnyPermission com as chaves esperadas. Protege contra
// regressão de alguém removendo a checagem de permissão.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadSource(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

// Extrai cada bloco `export const NAME = createServerFn(...)...})` com seu corpo.
function extractHandlers(source: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /export const (\w+)\s*=\s*createServerFn\(/g;
  const starts: Array<{ name: string; from: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) starts.push({ name: m[1]!, from: m.index });
  starts.forEach((s, i) => {
    const end = starts[i + 1]?.from ?? source.length;
    out.set(s.name, source.slice(s.from, end));
  });
  return out;
}

function expectAsserts(body: string | undefined, requiredKeys: string[]): void {
  expect(body, "handler body not found").toBeTruthy();
  expect(body).toMatch(/assertAnyPermission\s*\(/);
  for (const key of requiredKeys) {
    expect(body).toContain(key);
  }
}

describe("services.functions.ts — gate de permissão por handler", () => {
  const src = loadSource("src/lib/services.functions.ts");
  const handlers = extractHandlers(src);

  it("todo handler usa requireSupabaseAuth (rejeita não-autenticado)", () => {
    for (const [name, body] of handlers) {
      expect(body, `${name} sem requireSupabaseAuth`).toMatch(
        /requireSupabaseAuth/,
      );
    }
  });

  it("listServices exige techservice.services.view.*", () => {
    expectAsserts(handlers.get("listServices"), [
      "techservice.services.view.workspace",
      "techservice.services.view.own",
    ]);
  });

  it("getService exige techservice.services.view.*", () => {
    expectAsserts(handlers.get("getService"), [
      "techservice.services.view.workspace",
      "techservice.services.view.own",
    ]);
  });

  it("createService exige techservice.services.create.own", () => {
    expectAsserts(handlers.get("createService"), [
      "techservice.services.create.own",
    ]);
  });

  it("updateService exige techservice.services.update.*", () => {
    expectAsserts(handlers.get("updateService"), [
      "techservice.services.update.workspace",
      "techservice.services.update.own",
    ]);
  });

  it("deleteService exige techservice.services.delete.workspace (não expõe .own)", () => {
    const body = handlers.get("deleteService");
    expectAsserts(body, ["techservice.services.delete.workspace"]);
    // delete jamais pode ser autorizado por .own — apenas workspace/manager.
    expect(body).not.toContain("techservice.services.delete.own");
  });

  it("activateService exige techservice.services.update.*", () => {
    expectAsserts(handlers.get("activateService"), [
      "techservice.services.update.workspace",
    ]);
  });

  it("runServicesBillingNow exige techservice.services.update.workspace", () => {
    expectAsserts(handlers.get("runServicesBillingNow"), [
      "techservice.services.update.workspace",
    ]);
  });
});

describe("kb.functions.ts — gate de permissão por handler", () => {
  const src = loadSource("src/lib/kb.functions.ts");
  const handlers = extractHandlers(src);

  // Endpoints públicos de leitura (sem requireSupabaseAuth) são intencionais.
  const publicByDesign = new Set(["listKbCategoriesPublic", "listKbArticlesPublic", "getKbArticlePublic"]);

  it("todo handler admin usa requireSupabaseAuth", () => {
    for (const [name, body] of handlers) {
      if (publicByDesign.has(name)) continue;
      expect(body, `${name} sem requireSupabaseAuth`).toMatch(/requireSupabaseAuth/);
    }
  });

  it("listKbCategoriesAdmin exige view/manage", () => {
    expectAsserts(handlers.get("listKbCategoriesAdmin"), [
      "techservice.kb.view.workspace",
      "techservice.kb.manage.workspace",
    ]);
  });

  it("listKbArticlesAdmin exige view/manage", () => {
    expectAsserts(handlers.get("listKbArticlesAdmin"), [
      "techservice.kb.view.workspace",
      "techservice.kb.manage.workspace",
    ]);
  });

  it("getKbArticleAdmin exige view/manage", () => {
    expectAsserts(handlers.get("getKbArticleAdmin"), [
      "techservice.kb.view.workspace",
      "techservice.kb.manage.workspace",
    ]);
  });

  it("upsertKbCategory usa a lista KB_CREATE ou KB_UPDATE dependendo do id", () => {
    const body = handlers.get("upsertKbCategory") ?? "";
    expect(body).toMatch(/assertAnyPermission/);
    expect(body).toMatch(/data\.id\s*\?\s*KB_UPDATE\s*:\s*KB_CREATE/);
  });

  it("upsertKbArticle usa a lista KB_CREATE ou KB_UPDATE dependendo do id", () => {
    const body = handlers.get("upsertKbArticle") ?? "";
    expect(body).toMatch(/assertAnyPermission/);
    expect(body).toMatch(/data\.id\s*\?\s*KB_UPDATE\s*:\s*KB_CREATE/);
  });

  it("deleteKbCategory exige delete/manage", () => {
    expectAsserts(handlers.get("deleteKbCategory"), [
      // Nome da lista constante — resolvido em runtime.
      "KB_DELETE",
    ]);
  });

  it("deleteKbArticle exige delete/manage", () => {
    expectAsserts(handlers.get("deleteKbArticle"), ["KB_DELETE"]);
  });

  it("seedStarterKb exige manage.workspace", () => {
    expectAsserts(handlers.get("seedStarterKb"), ["KB_MANAGE"]);
  });

  it("constantes de permissão KB apontam para chaves reais no catálogo", () => {
    expect(src).toContain('"techservice.kb.view.workspace"');
    expect(src).toContain('"techservice.kb.manage.workspace"');
    expect(src).toContain('"techservice.kb.create.own"');
    expect(src).toContain('"techservice.kb.update.workspace"');
    expect(src).toContain('"techservice.kb.delete.workspace"');
  });
});
