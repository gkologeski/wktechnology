# Reduzir o tempo de build e de edição (HMR)

## O que foi medido (fatos confirmados agora)

- O app tem **1.140 arquivos** em `src` (~11 MB, **287.419 linhas**) e **360 arquivos de rota** — é um monolito grande, e boa parte do tempo é volume puro.
- **227 arquivos `*.functions.ts(x)`** e **65 `*.server.ts`**. Cada arquivo de server function é processado pelo compilador do TanStack Start em múltiplas passagens (client / server / split), então o custo cresce por arquivo, não por linha.
- **192 arquivos de rota importam `*.functions`** diretamente no topo. Isso amarra grafos grandes ao bundle e faz qualquer edição invalidar muitos módulos.
- **8 rotas exportam componentes de página** (`SurveysPage`, `ScoringPage`, `ProspectingPage`, `VoiceAgentPage`, `FormsPage`, `ScriptsPage`, `PlaybooksPage`, `EnrichmentHistoryPage`). O próprio plugin avisa nos logs: esses componentes **não são code-splitted** e vão para o bundle principal.
- `src/integrations/supabase/types.ts` tem **19.441 linhas** e `src/routeTree.gen.ts` **8.145** — os dois são reavaliados/regravados com frequência (o log mostra `page reload src/routeTree.gen.ts` + `program reload`, ou seja, recarga total do ambiente SSR a cada mudança de rota).
- Arquivos monolíticos que dominam o transform: `workflow-builder.tsx` (4.622 linhas), `hubspot-steps.server.ts` (2.533), `activity-timeline.tsx` (2.352), `hubspot.functions.ts` (1.972), `associations-panel.tsx` (1.895).
- `recharts` é importado **estaticamente em 6 arquivos** e `@twilio/voice-sdk` em 1 — bibliotecas grandes dentro do grafo síncrono. `pdfjs-dist`, `jspdf`, `html2canvas`, `mammoth` já não aparecem como import estático (bom).
- `optimizeDeps.exclude` hoje mantém vários pacotes TanStack fora do pré-bundle (necessário para evitar o bug do React duplicado), o que aumenta o número de requisições de módulo em dev.
- `node_modules` = **973 MB**; `reportCompressedSize: false` e `target: "esnext"` já estão aplicados (otimizações anteriores).

Ainda **não confirmado** (primeiro passo do plano): quanto do tempo é transform, quanto é o bundle do Worker/Cloudflare e quanto é a etapa de prerender. Sem essa medição, qualquer ajuste é chute.

## Plano

### Fase 0 — Medir antes de mexer (obrigatória)

- Rodar o build com timings por etapa e com `DEBUG` do Vite, registrando: tempo de transform, tempo de bundling client, bundling SSR/Worker, prerender e número de chunks emitidos.
- Guardar a linha de base num arquivo curto de referência para comparar depois de cada fase.
- Verificar se a etapa de prerender está ativa e quantas páginas ela gera (rotas públicas como `careers`, `kb`, `lp`, `sitemap` podem estar puxando dados no build).

### Fase 1 — Ganhos rápidos e seguros (sem mudar comportamento)

1. Remover os 8 `export` de componentes de página nas rotas (mantendo o componente no arquivo, sem export) — devolve essas telas ao code-splitting e reduz o chunk principal.
2. Tornar `recharts` lazy (`React.lazy` + `Suspense`) nos 6 pontos de uso, e confirmar que `@twilio/voice-sdk` só entra via import dinâmico.
3. Ajustes de build no `vite.config.ts`: desativar sourcemaps de produção se estiverem ligados, `modulePreload.polyfill: false`, e aumentar `rollupOptions.maxParallelFileOps` para usar melhor a CPU.
4. Se o prerender estiver percorrendo rotas dinâmicas/de dados, limitar a lista de páginas prerenderizadas às realmente estáticas.

### Fase 2 — Reduzir o grafo de módulos (maior impacto no build)

1. Quebrar os monolitos que dominam o transform em módulos menores e focados: `workflow-builder.tsx`, `activity-timeline.tsx`, `associations-panel.tsx`, `hubspot.functions.ts`/`hubspot-steps.server.ts`. Puramente estrutural, sem mudança funcional.
2. Nas rotas, trocar imports estáticos de `*.functions` por import dentro do handler/`useServerFn` onde a função só é usada em ação do usuário — corta dezenas de arestas do grafo por rota.
3. Consolidar server functions muito fragmentadas por domínio (menos arquivos = menos passagens do compilador), sem mudar assinaturas nem rotas.

### Fase 3 — Velocidade de edição (HMR / “codificação lenta”)

1. Revisar `optimizeDeps.include` para pré-bundlar os pacotes de UI usados em quase toda tela (`lucide-react`, `date-fns`, `cmdk`, Radix, `react-hook-form`), mantendo intactas as exclusões TanStack que existem para evitar React duplicado.
2. Reduzir o efeito do `routeTree.gen.ts`: evitar imports de rota que forcem `program reload` do ambiente SSR a cada salvamento.
3. Padronizar o typecheck rápido (`tsgo`) em vez de `tsc` completo durante o desenvolvimento; `skipLibCheck` já está ativo.
4. Corrigir o erro recorrente nos logs `Invalid server function ID: ... project-timer.functions.ts` — server fn órfã que faz o dev server recompilar/errar em loop.

### Fase 4 — Validar e comparar

- Rodar `build` e `build:dev`, comparar com a linha de base da Fase 0 e reportar ganho real por fase.
- Rodar `vitest run` e `lint` para garantir zero regressão.
- Smoke test manual das telas tocadas (settings.\*, prospecting, workflows, timeline, associações) em light/dark e com estados de loading/empty/error.

## Expectativa realista

Fases 1 e 3 costumam dar melhora perceptível rápido (chunk inicial menor, HMR mais leve). O ganho grande e duradouro vem da Fase 2, porque o custo atual é dominado por quantidade de arquivos/arestas do grafo, não por configuração. Não vou prometer percentual antes da medição da Fase 0.

## Detalhes técnicos

- Nada de RLS, schema, autenticação ou regra de negócio muda neste trabalho.
- As exclusões de `optimizeDeps` referentes a `@tanstack/*`, `seroval` e `h3-v2` permanecem — já existe histórico de `Cannot read properties of null (reading 'useContext')` quando removidas.
- `codeSplittingOptions.defaultBehavior: [["component"]]` permanece; o comentário no config documenta o motivo.
- Cada fase é aplicada e validada isoladamente, com rollback simples caso o build quebre.
