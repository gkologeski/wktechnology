// Diagnóstico de build (só com PERF_GRAPH=1): para o chunk de entrada do cliente,
// grava cada módulo com o caminho de imports estáticos mais curto até a entrada.
import { writeFileSync } from "node:fs";
import type { Plugin } from "vite";

export function perfGraphPlugin(): Plugin {
  return {
    name: "perf-graph",
    apply: "build",
    generateBundle(_o, bundle) {
      if (this.environment?.name !== "client") return;
      const out: Record<string, unknown> = {};
      for (const c of Object.values(bundle)) {
        if (c.type !== "chunk" || !c.isEntry) continue;
        const inChunk = new Set(Object.keys(c.modules));
        const parent = new Map<string, string | null>();
        const roots = c.facadeModuleId ? [c.facadeModuleId] : [];
        const q = [...roots];
        roots.forEach((r) => parent.set(r, null));
        while (q.length) {
          const id = q.shift()!;
          for (const dep of this.getModuleInfo(id)?.importedIds ?? []) {
            if (parent.has(dep)) continue;
            parent.set(dep, id);
            q.push(dep);
          }
        }
        const chains: Record<string, { bytes: number; chain: string[] }> = {};
        for (const [id, m] of Object.entries(c.modules)) {
          const chain: string[] = [];
          let cur: string | null | undefined = id;
          while (cur && chain.length < 30) {
            chain.push(cur.replace(/^.*?(node_modules|src)\//, "$1/"));
            cur = parent.get(cur);
          }
          chains[id] = { bytes: m.renderedLength, chain };
        }
        out[c.fileName] = { modules: inChunk.size, chains };
      }
      writeFileSync("/tmp/perf-graph.json", JSON.stringify(out));
    },
  };
}
