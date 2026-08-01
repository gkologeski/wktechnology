import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Plugin } from "vite";

/**
 * lucide-react expõe `export * as index from './icons/index.js'` no barril
 * principal, que reexporta ~3.900 arquivos de ícone. Em cada passe de build
 * (client, ssr e nitro) o Rollup precisa carregar e analisar esse grafo inteiro
 * mesmo usando poucas dezenas de ícones — é a maior fonte de módulos
 * transformados do projeto.
 *
 * Este plugin reescreve, apenas no build, `import { A, B } from "lucide-react"`
 * para imports profundos por ícone (`lucide-react/dist/esm/icons/a.js`),
 * eliminando o barril do grafo. Se algum nome importado não for um ícone
 * conhecido (ex.: `createLucideIcon`, `icons`), o import original é preservado
 * para aquele nome — o comportamento nunca muda, só o caminho do módulo.
 */
function buildIconMap(): Map<string, string> {
  const require = createRequire(import.meta.url);
  const entry = require.resolve("lucide-react");
  // dist/cjs/lucide-react.js → dist/esm/lucide-react.js
  const esmEntry = join(dirname(dirname(entry)), "esm", "lucide-react.js");
  const source = readFileSync(esmEntry, "utf8");
  const map = new Map<string, string>();
  const re =
    /export\s*\{([^}]*)\}\s*from\s*["']\.\/(icons\/[^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    const specifiers = match[1] ?? "";
    const file = match[2] ?? "";
    for (const raw of specifiers.split(",")) {
      const asMatch = raw.trim().match(/default\s+as\s+([A-Za-z0-9_$]+)/);
      if (asMatch?.[1]) map.set(asMatch[1], file);
    }
  }
  return map;
}

const IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*(["'])lucide-react\2;?/g;

export function lucideSlim(): Plugin {
  let icons: Map<string, string> = new Map();

  return {
    name: "lucide-slim",
    apply: "build",
    enforce: "pre",
    buildStart() {
      if (icons.size === 0) icons = buildIconMap();
    },
    transform(code, id) {
      if (!id.includes("/src/") || !code.includes("lucide-react")) return null;
      if (/\.(css|json)$/.test(id)) return null;

      let changed = false;
      const output = code.replace(IMPORT_RE, (full, body: string) => {
        const parts = body
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
        if (parts.length === 0) return full;

        const deep: string[] = [];
        const keep: string[] = [];

        for (const part of parts) {
          const isType = /^type\s+/.test(part);
          const clean = part.replace(/^type\s+/, "");
          const [name, alias] = clean.split(/\s+as\s+/).map((s) => s.trim());
          const file = name ? icons.get(name) : undefined;
          if (isType || !name || !file) {
            keep.push(part);
            continue;
          }
          deep.push(
            `import ${alias || name} from "lucide-react/dist/esm/${file}";`,
          );
        }

        if (deep.length === 0) return full;
        changed = true;
        const residual =
          keep.length > 0
            ? `import { ${keep.join(", ")} } from "lucide-react";`
            : "";
        return [...deep, residual].filter(Boolean).join("\n");
      });

      if (!changed) return null;
      return { code: output, map: null };
    },
  };
}
