import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

// Quality gates do toolkit (regras copiadas byte a byte em ./eslint-rules).
import quality from "./eslint-rules/index.cjs";

export default tseslint.config(
  {
    ignores: [
      "dist",
      ".output",
      ".vinxi",
      ".tscache",
      "coverage",
      // Arquivos gerados automaticamente (não devem ser editados nem formatados).
      "src/integrations/supabase/types.ts",
      "src/integrations/supabase/previewAuthStorage.ts",
      "src/routeTree.gen.ts",
      // Regras do toolkit: copiadas byte a byte, não reformatar.
      "eslint-rules/**",
      // Skills do workspace são somente leitura e recriadas a cada mensagem.
      ".workspace/**",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: ["tests/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "no-empty-pattern": "off",
    },
  },
  // ---------------------------------------------------------------------
  // Quality gates: teto de tamanho por arquivo, console direto e acesso
  // direto ao banco a partir da camada de apresentação.
  // ---------------------------------------------------------------------
  {
    files: ["src/**/*.{js,jsx,ts,tsx,mjs,cjs}"],
    plugins: { quality },
    rules: {
      // Baseline medida em 05/09/2026: 250 arquivos acima de 350 linhas.
      // Volta para "error" quando a contagem chegar a zero.
      "quality/max-lines": ["warn", { max: 350 }],
      // Baseline medida em 05/09/2026: 137 ocorrências de console.* fora de
      // testes. Volta para "error" quando a contagem chegar a zero.
      "quality/no-direct-console": ["warn", { logger: "o adaptador de log do projeto" }],
      // Baseline medida em 05/09/2026: 157 imports diretos do cliente do
      // banco em rotas/componentes. Volta para "error" quando chegar a zero.
      "quality/no-direct-data-access": [
        "warn",
        {
          modules: ["@/integrations/supabase/client", "@/integrations/supabase/client.server"],
          bindings: ["supabase", "supabaseAdmin"],
          layers: ["/src/routes/", "/src/components/"],
          extensions: [".tsx"],
        },
      ],
    },
  },
  {
    // Infra que precisa escrever no console antes de qualquer adaptador:
    // service worker, handlers de cron/webhook e o middleware de erro.
    // Este bloco vem DEPOIS do que liga a regra, senão o "off" é ignorado.
    files: ["src/routes/api/public/**/*.ts", "src/server.ts", "src/start.ts"],
    rules: {
      "quality/no-direct-console": "off",
    },
  },
  {
    // Mesmo orçamento de tamanho para testes, sempre em "warn".
    files: [
      "**/*.test.{ts,tsx}",
      "**/{__tests__,__mocks__,fixtures,mocks}/**/*.{ts,tsx}",
      "tests/**/*.{ts,tsx}",
    ],
    plugins: { quality },
    rules: {
      "quality/max-lines": ["warn", { max: 350, includeTests: true }],
    },
  },
  {
    files: ["eslint-rules/**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { module: "readonly", require: "readonly" },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  eslintPluginPrettier,
);
