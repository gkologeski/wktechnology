import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const ROOT = join(process.cwd(), "src/routes/_authenticated");
const LEGACY_PATTERNS = [
  /@\/components\/page-header/,
  /\b(?:bg|text)-(?:white|black|gray-|slate-)/,
  /--hs-(?:surface|divider|text-muted)/,
];
const PRODUCT_PATTERN = /Product(?:Canvas|PageHeader|ToolbarBand|TabsBand|Content|Panel)/;
const OFFICIAL_HEADER_PATTERN = /(?:Ats)?PageHeader/;

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? filesUnder(path) : Promise.resolve([path]);
    }),
  );
  return files.flat();
}

const routeFiles = (await filesUnder(ROOT))
  .filter((path) => [".ts", ".tsx"].includes(extname(path)))
  .sort();

const rows = await Promise.all(
  routeFiles.map(async (path) => {
    const source = await readFile(path, "utf8");
    const rel = relative(process.cwd(), path);
    const route = rel
      .replace(/^src\/routes\/_authenticated\/?/, "/")
      .replace(/\.index(?=\.)/, "")
      .replace(/\.(?:tsx?|jsx?)$/, "")
      .replaceAll(".", "/");
    const module = route.split("/").filter(Boolean)[0] ?? "core";
    return {
      module,
      route,
      file: rel,
      product: PRODUCT_PATTERN.test(source),
      header: OFFICIAL_HEADER_PATTERN.test(source),
      legacy: LEGACY_PATTERNS.some((pattern) => pattern.test(source)),
    };
  }),
);

const modules = new Map<string, typeof rows>();
for (const row of rows) modules.set(row.module, [...(modules.get(row.module) ?? []), row]);

console.log("# Inventário do Design System — área autenticada\n");
console.log(
  `Gerado automaticamente por \`bun run audit:design-system\`. Total: **${rows.length} arquivos de rota**.\n`,
);
console.log(
  "Todas as rotas recebem o canvas, a tipografia, os controles e as superfícies globais pelo layout autenticado. Os indicadores abaixo identificam adoção explícita e pendências locais.\n",
);
console.log(
  "| Área | Rotas | Product shell explícito | Cabeçalho oficial | Legado local a revisar |",
);
console.log("| --- | ---: | ---: | ---: | ---: |");
for (const [module, moduleRows] of [...modules].sort(([a], [b]) => a.localeCompare(b))) {
  console.log(
    `| ${module} | ${moduleRows.length} | ${moduleRows.filter((row) => row.product).length} | ${moduleRows.filter((row) => row.header).length} | ${moduleRows.filter((row) => row.legacy).length} |`,
  );
}
console.log("\n## Rotas com legado local\n");
for (const row of rows.filter((item) => item.legacy))
  console.log(`- \`${row.route}\` — \`${row.file}\``);
