// Camada type-aware do lint, deliberadamente fora do eslint.config.js.
// projectService monta o programa completo do TypeScript: lento demais para
// o script rápido e para qualquer hook de pre-commit. Rode com:
//   bun run lint:types
import defaultConfig from "./eslint.config.js";

export default [
  ...defaultConfig,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Todas em "warn": nenhuma tem contagem conhecida neste código ainda.
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-misused-promises": "warn",
      "@typescript-eslint/await-thenable": "warn",
      "@typescript-eslint/require-await": "warn",
    },
  },
];
