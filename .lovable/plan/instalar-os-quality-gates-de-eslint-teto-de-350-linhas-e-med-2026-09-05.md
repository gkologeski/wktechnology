# Instalar os quality gates de ESLint (teto de 350 linhas) e medir

Objetivo: instalar as três regras do toolkit (`quality/max-lines`, `quality/no-direct-console`, `quality/no-direct-data-access`) copiando os arquivos prontos, rodar o linter e **medir**. Nenhuma violação será corrigida nesta etapa.

## O que já foi verificado no projeto

- Gerenciador: **bun**; script atual `lint: eslint .`
- ESLint **9.39.4** (compatível com `defineConfig`/`globalIgnores`), `@eslint/js ^9`, `typescript-eslint ^8` já instalados
- TypeScript com alias `@/* -> ./src/*`; raiz de código: `src/`
- Camada de apresentação: `src/routes/` e `src/components/`
- Módulo de dados: `@/integrations/supabase/client` (export `supabase`), `client.server` (`supabaseAdmin`)
- Não existe adaptador de log próprio — há **167 usos de `console.`** em `src/`
- **253 arquivos** acima de 350 linhas (maiores: `step-config-panel.tsx` 2.013, `activity-timeline.tsx` 1.838, `workflows/engine.server.ts` 1.782)

## Um desvio necessário em relação ao prompt

O prompt manda criar `eslint.config.mjs`. Este projeto já tem `eslint.config.js` em flat config, com Prettier, react-hooks, react-refresh, `no-restricted-imports` e ignores dos arquivos gerados. Ter dois arquivos de config faz o ESLint 9 falhar. Então: os três `.cjs` de regras são copiados **byte a byte**, e o bloco de configuração do `eslint.config.mjs.example` é **integrado ao `eslint.config.js` existente**, preservando tudo que já está lá. Nada de regra reescrita à mão.

## Passos

1. Baixar de `raw.githubusercontent.com/soumatheusgomes/vibe-coding-toolkit/main/templates/eslint`: `eslint-rules/utils.cjs`, `core-rules.cjs`, `index.cjs`, `eslint.config.mjs.example`, `eslint.typed.config.mjs.example`, `verify.mjs`. Os `.cjs` vão para `./eslint-rules/` sem qualquer edição.
2. Adaptar a configuração no `eslint.config.js`:
   - `quality/max-lines` com `max: 350`
   - `quality/no-direct-data-access` apontando para `@/integrations/supabase/client` (e `client.server`), bindings `supabase`/`supabaseAdmin`, layers `/src/routes/` e `/src/components/`, extensão `.tsx`
   - `quality/no-direct-console`: sem adaptador de log no projeto, a regra é instalada e o bloco de exceção fica só para os arquivos de infraestrutura que legitimamente escrevem no console (cron/handlers de servidor) — ou é removida se a medição mostrar que ela só produziria ruído
   - Bloco `import-x`: removido (o projeto ainda não tem camadas formalizadas), junto com seus imports e entradas correspondentes, para não quebrar o lint com regra desconhecida
   - `globalIgnores` recebe `dist`, `.output`, `.vinxi`, `.tscache`, `.workspace`, `src/integrations/supabase/types.ts`, `src/routeTree.gen.ts`
3. Instalar apenas o que faltar (`eslint@^9`, `@eslint/js@^9`, `typescript-eslint` já presentes; `eslint.typed.config.mjs` opcional, fora do script rápido).
4. Scripts: manter `lint`/`lint:fix` e adicionar `lint:types` usando a config type-aware, fora do caminho rápido e de qualquer hook.
5. Rodar `node verify.mjs` — esperado três linhas `: ok`. Depois remover o arquivo.
6. Rodar `bun run lint` e contar violações por regra.
7. Definir severidade pela contagem: regra com zero violações fica em `error`; regra com violações cai para `warn` com a contagem anotada como linha de base. Como `max-lines` já tem 253 infratores conhecidos, ela nasce em `warn` com baseline (lista explícita de `ignore` é inviável nesse volume).

## Relatório final

Regras instaladas e puladas (com motivo), contagem por regra, severidades e baselines, lista dos arquivos acima de 350 linhas ordenada por tamanho, e os comandos exatos de lint.

## Fora de escopo

Corrigir violações, quebrar arquivos grandes, mexer em RLS/schema/UI, mudar `MAX_LINES`. A refatoração dos arquivos grandes é trabalho separado (prompt 09 do toolkit).
