// Contratos estáticos entre módulos (conservadores: refletem o estado atual e barram regressão).
// 1) Domínios verticais em src/lib não importam internos uns dos outros; compartilhado vai para o Core.
// 2) Arquivos que entram no pacote do navegador (componentes, hooks, rotas fora de /api) não
//    importam módulos *.server nem o cliente admin no topo — só `import type` ou import dinâmico
//    dentro do handler do servidor.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const VERTICAL_DIRS = ["ats", "people", "contracts", "projects", "prospecting"];

describe("contratos de módulos", () => {
  it("domínios verticais não importam internos de outro domínio vertical", () => {
    const violations: string[] = [];
    for (const a of VERTICAL_DIRS) {
      for (const file of walk(join("src/lib", a))) {
        const src = readFileSync(file, "utf8");
        for (const b of VERTICAL_DIRS) {
          if (a !== b && src.includes(`from "@/lib/${b}/`)) violations.push(`${file} -> ${b}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("código do navegador não importa módulos de servidor no topo", () => {
    const files = [
      ...walk("src/components"),
      ...walk("src/hooks"),
      ...walk("src/routes").filter((f) => !f.includes(join("src", "routes", "api"))),
    ];
    const violations = files.filter((file) =>
      /^import (?!type )[^;]*from "[^"]*(\.server|client\.server)"/m.test(
        readFileSync(file, "utf8"),
      ),
    );
    expect(violations).toEqual([]);
  });
});
