// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    optimizeDeps: {
      include: ["events", "@twilio/voice-sdk"],
    },
    build: {
      commonjsOptions: {
        // The `events` npm polyfill is CJS (`module.exports = EventEmitter`).
        // Rollup needs help to recognize `EventEmitter` as a named export used by
        // @twilio/voice-sdk's ESM modules.
        defaultIsModuleExports: "auto",
        transformMixedEsModules: true,
      },
    },
  },
});
