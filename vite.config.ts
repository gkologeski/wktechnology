// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const eventsPolyfillPath = require.resolve("events/events.js");

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      {
        // @twilio/voice-sdk imports `node:events` / `events`. Vite's default
        // browser externalization replaces these with a stub that has no
        // `EventEmitter` export, breaking the production build. Resolve them
        // to the `events` npm polyfill before Vite's resolver externalizes.
        name: "polyfill-node-events",
        enforce: "pre",
        resolveId(source) {
          if (source === "events" || source === "node:events") {
            return eventsPolyfillPath;
          }
          return null;
        },
      },
    ],
    optimizeDeps: {
      // Disable dev dependency pre-bundling in the preview sandbox. The remote
      // proxy was intermittently serving `/node_modules/.vite/deps/*` chunks as
      // 502/504 after route lazy-loads, leaving every screen stuck on loading.
      disabled: "dev",
      // The preview dev server can briefly serve stale optimized dependency
      // URLs while Vite is re-crawling lazy route chunks. Treat those as
      // recoverable so dynamic route imports do not fail with 502/504.
      ignoreOutdatedRequests: true,
      // Exclude @twilio/voice-sdk from esbuild pre-bundling so Vite/Rollup
      // resolves its `node:events` imports through our `polyfill-node-events`
      // plugin (esbuild's prebundler does not run that plugin).
      exclude: ["@twilio/voice-sdk"],
      include: ["events"],
    },
  },
});
