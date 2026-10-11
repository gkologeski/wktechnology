import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import type { Plugin } from "vite";
export function buildMetricsPlugin(): Plugin {
  const started = Date.now();
  const phases: Record<
    string,
    {
      duration_ms: number;
      modules: number;
      js_bytes: number;
      entry_gzip_bytes: number;
      complete: boolean;
    }
  > = {};
  const starts = new Map<string, number>();
  const save = () => {
    mkdirSync(".verification", { recursive: true });
    writeFileSync(
      ".verification/build.json",
      JSON.stringify(
        {
          started_at: new Date(started).toISOString(),
          duration_ms: Date.now() - started,
          phases,
          complete: false,
          phases_complete: ["client", "ssr", "nitro"].every((k) => phases[k]?.complete),
        },
        null,
        2,
      ),
    );
  };
  return {
    name: "techerp-build-metrics",
    apply: "build",
    sharedDuringBuild: true,
    buildStart() {
      const name = this.environment.name;
      starts.set(name, Date.now());
      phases[name] = {
        duration_ms: 0,
        modules: 0,
        js_bytes: 0,
        entry_gzip_bytes: 0,
        complete: false,
      };
      save();
    },
    generateBundle(_options, bundle) {
      // Emit before Nitro assembles its static asset manifest. Adding a file after
      // the build leaves it absent from the worker's static route inventory.
      if (this.environment.name === "client" && process.env.TECHERP_BUILD_SOURCE_HASH)
        this.emitFile({
          type: "asset",
          fileName: "build-info.json",
          source: JSON.stringify({
            source_hash: process.env.TECHERP_BUILD_SOURCE_HASH,
            built_at: new Date().toISOString(),
          }),
        });
      const phase = phases[this.environment.name];
      if (!phase) return;
      for (const item of Object.values(bundle))
        if (item.type === "chunk") {
          phase.modules += Object.keys(item.modules).length;
          phase.js_bytes += Buffer.byteLength(item.code);
          if (item.isEntry) phase.entry_gzip_bytes += gzipSync(item.code).length;
        }
    },
    writeBundle() {
      const name = this.environment.name;
      const phase = phases[name];
      if (!phase) return;
      phase.duration_ms = Date.now() - (starts.get(name) ?? started);
      phase.complete = true;
      save();
    },
    buildEnd(error) {
      if (error) save();
    },
  };
}
