// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { createRequire } from "node:module";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

const require = createRequire(import.meta.url);
const eventsPolyfillPath = require.resolve("events/events.js");

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    router: {
      codeSplittingOptions: {
        // Divide apenas o `component` de cada rota. Mantém loaders, contexto e
        // validações no bundle principal (evita waterfall) e reduz bastante o
        // chunk inicial, que antes carregava as ~347 rotas de uma vez.
        // Histórico: já esteve desativado (`[]`) por causa de chunks lazy que
        // puxavam cópias diferentes do React/Router; o dedupe + optimizeDeps
        // abaixo cobrem esse caso. Se voltar `Cannot read properties of null
        // (reading 'useContext')`, reverter para `defaultBehavior: []`.
        defaultBehavior: [["component"]],
      },
    },
  },
  vite: {
    plugins: [
      // Servidor MCP (integrações de agentes) gerado a partir de src/lib/mcp.
      mcpPlugin(),
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
    build: {
      // O relatório de tamanho comprimido roda gzip em CADA chunk emitido
      // (~580 no cliente + servidor + worker). Com o volume deste projeto isso
      // custa dezenas de segundos por publicação e não muda o resultado final.
      reportCompressedSize: false,
      // Menos lowering de sintaxe no esbuild/rollup. Os navegadores-alvo já
      // suportam ESNext e o Worker do Cloudflare também.
      target: "esnext",
      // Sourcemaps de produção custam tempo e memória em um grafo de ~5.3k
      // módulos e não são consumidos por nada no runtime publicado.
      sourcemap: false,
      // Sem polyfill de modulepreload: os navegadores-alvo suportam nativo.
      modulePreload: { polyfill: false },
      rollupOptions: {
        // A sandbox de build tem muitos núcleos; o padrão (20) subutiliza I/O.
        maxParallelFileOps: 48,
        treeshake: {
          // `moduleSideEffects` fica no padrão de propósito: desligar removeria
          // imports com efeito colateral (CSS, polyfill de `events`).
          // Estas duas são seguras e cortam bastante análise do Rollup.
          propertyReadSideEffects: false,
          tryCatchDeoptimization: false,
        },
      },
    },

    // Garante uma única cópia de React/JSX-runtime no bundle do cliente.
    // Sem dedupe explícito, dependências aninhadas (radix, tiptap, etc.)
    // podem puxar instâncias paralelas e o Vite gera dois prebundles com
    // hashes "?v=" diferentes, derrubando o contexto de Router/Query com
    // "Cannot read properties of null (reading 'useContext')".
    resolve: {
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "scheduler",
        "@tanstack/react-router",
        "@tanstack/react-start",
        "@tanstack/react-query",
      ],
    },
    optimizeDeps: {
      // The preview dev server can briefly serve stale optimized dependency
      // URLs while Vite is re-crawling lazy route chunks. Treat those as
      // recoverable so dynamic route imports do not fail with 502/504.
      ignoreOutdatedRequests: true,
      // Força React e runtimes a entrarem num único chunk pré-bundlado
      // logo no cold start, evitando que o Vite gere um segundo bundle
      // com outro hash "?v=" quando uma rota lazy (ex.: /admin) é
      // carregada depois.
      include: [
        "events",
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "scheduler",
        // Fase 3 (HMR): dependências de UI presentes em quase toda tela.
        // Pré-bundlá-las no cold start evita a descoberta tardia ("new
        // dependencies optimized → reloading") a cada rota nova, que é o
        // que hoje deixa a edição lenta. Nenhuma delas é TanStack, então
        // não interfere nas exclusões que evitam React duplicado.
        "lucide-react",
        "date-fns",
        "cmdk",
        "clsx",
        "tailwind-merge",
        "class-variance-authority",
        "zod",
        "sonner",
        "react-hook-form",
        "@hookform/resolvers/zod",
        "@supabase/supabase-js",
        "@radix-ui/react-dialog",
        "@radix-ui/react-dropdown-menu",
        "@radix-ui/react-popover",
        "@radix-ui/react-select",
        "@radix-ui/react-tabs",
        "@radix-ui/react-tooltip",
        "@radix-ui/react-checkbox",
        "@radix-ui/react-label",
        "@radix-ui/react-scroll-area",
        "@radix-ui/react-slot",
      ],
      // Exclude @twilio/voice-sdk from esbuild pre-bundling so Vite/Rollup
      // resolves its `node:events` imports through our `polyfill-node-events`
      // plugin (esbuild's prebundler does not run that plugin). Re-state the
      // TanStack Start plugin exclusions so this local optimizeDeps block never
      // weakens them during config merging.
      exclude: [
        "@twilio/voice-sdk",
        "@tanstack/react-start",
        "@tanstack/react-router",
        "@tanstack/react-router-devtools",
        "@tanstack/start-static-server-functions",
        // Crítico: subpaths do router-core são descobertos tarde (quando
        // uma rota lazy hidrata) e disparam "new dependencies optimized
        // → reloading", criando um segundo prebundle do React com outro
        // hash "?v=". Excluindo-os, o Vite serve o ESM original sem
        // re-otimizar e o React permanece único.
        "@tanstack/router-core",
        "@tanstack/router-core/ssr/client",
        "@tanstack/router-core/ssr/server",
        "@tanstack/history",
        "seroval",
        "h3-v2",
      ],
    },
  },
});
