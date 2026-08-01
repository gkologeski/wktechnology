# Reduzir o tempo de publicação

Hoje a publicação leva ~5 minutos. O objetivo é cortar isso substancialmente atacando o que realmente pesa no build.

## O que foi verificado no projeto

- 349 arquivos de rota em `src/routes` e 9,5 MB de código em `src/`.
- 222 declarações `createServerFn` distribuídas em ~220 módulos `*.functions.ts`. Cada um é processado duas vezes (stub de cliente + split de servidor).
- Code splitting por rota está ligado com `defaultBehavior: [["component"]]` — isso gera centenas de chunks separados no Rollup, e cada chunk tem custo de render/minify/gravação/upload.
- Bibliotecas pesadas (pdfjs-dist, mammoth, jspdf/html2canvas, fflate, twilio) já estão em import dinâmico — não são a causa principal.
- `src/integrations/supabase/types.ts` (557 KB) e `src/routeTree.gen.ts` (356 KB) são os maiores arquivos e são reprocessados em todos os passes de build.
- O build roda com `--max-old-space-size=8192`, sinal de que já esteve perto do limite de memória (pressão de GC também custa tempo).

Ainda não medi a divisão de tempo entre os três passes (cliente, SSR e bundle do Worker). Essa medição é o primeiro passo do plano, para que as otimizações sejam escolhidas por dado e não por suposição.

## Fase 0 — Medir (obrigatório antes de mexer)

- Rodar o build de produção uma vez com timing por fase e registrar: tempo do cliente, tempo do SSR/Worker, número de chunks e tamanho total do output.
- Com isso definimos a linha de base e sabemos onde estão os minutos.

## Fase 1 — Ganhos rápidos e de baixo risco

1. **Agrupar os chunks de rota.** Trocar o split por rota individual por agrupamento por área (TechSales, TechHire, ERP, Settings, Admin) usando `manualChunks`. Reduz centenas de chunks para algumas dezenas, cortando tempo de Rollup, de minify e de upload, sem perder lazy-loading real por módulo.
2. **Desligar sourcemaps de produção** (se estiverem ligados no build atual) e confirmar `minify: 'esbuild'`.
3. **Limpar dependências que entram no scan/prebundle sem uso real** — `jspdf`, `html2canvas`, `nitro`, `react-email` (só `@react-email/*` é usado), `@vitest/ui` para devDependencies. Cada remoção reduz resolução, scan e transform.
4. **Excluir testes e arquivos auxiliares do escopo de build/geração de rotas**, para o gerador do routeTree e o scanner não visitarem arquivos irrelevantes.

## Fase 2 — Reduzir o volume que o compilador precisa atravessar

5. **Consolidar módulos de server functions por domínio.** Passar de ~220 módulos para um conjunto menor por área (mantendo a regra de módulo fino: só imports e declarações de server fn, helpers em `.server.ts`). Menos módulos = menos duplo processamento pelo plugin de split.
6. **Enxugar o grafo de tipos do Supabase.** Garantir que `integrations/supabase/types.ts` seja sempre consumido via `import type`, para o arquivo não puxar carga desnecessária em cada módulo que o referencia.
7. **Isolar telas muito grandes** (`workflow-builder`, `activity-timeline`, `associations-panel`, dashboards com recharts) em chunks próprios, evitando que arquivos gigantes sejam reprocessados dentro de bundles grandes.

## Fase 3 — Validar

- Rodar build novamente e comparar com a linha de base da Fase 0: tempo total, tempo por passe, nº de chunks, tamanho do output.
- Rodar typecheck, lint e testes, e validar navegação nas áreas afetadas pelo reagrupamento de chunks (risco conhecido: chunk lazy puxando cópia paralela do React — o `dedupe` atual cobre, mas precisa checagem manual).
- Publicar e medir o tempo real de publicação ponta a ponta.

## Detalhes técnicos

- Ajustes concentrados em `vite.config.ts` (`build.rollupOptions.output.manualChunks`, `build.sourcemap`, `tanstackStart.router.codeSplittingOptions`) e `package.json` (dependências).
- Nenhuma alteração de schema, RLS, autenticação ou regra de negócio.
- O reagrupamento de chunks é a mudança com maior risco de regressão de runtime; será feita e validada isoladamente, com rollback simples para o comportamento atual.

## Expectativa honesta

O tempo de publicação tem uma parte fixa de infraestrutura (deploy/propagação) que não dá para eliminar. As Fases 1 e 2 atacam a parte de build, que é onde está a maior fatia dos ~5 minutos. Só após a medição da Fase 0 é possível prometer um número — antes disso, qualquer percentual seria chute.
