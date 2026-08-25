# Diagnosticar e reduzir o tempo de implementação

## Diagnóstico confirmado

O tempo longo de cada implementação vem de dois vetores: **infraestrutura de build muito pesada** e **processo de entrega fragmentado**.

### Vetor técnico

- O projeto tem **1.252 arquivos em `src/`**, **361 rotas**, **239 `*.functions.ts`** e **77 `*.server.ts`**.
- **104 rotas (~28%)** importam server functions estaticamente no topo, amarrando o grafo de build.
- Monolitos dominam o transform: `workflow-builder.tsx` (1.913 linhas), `activity-timeline.tsx` (1.963), `hubspot-steps.server.ts` (2.547).
- Arquivos gerados são grandes: `src/integrations/supabase/types.ts` (20.474 linhas) e `src/routeTree.gen.ts` (8.175 linhas / 369 KB).
- Build exige `NODE_OPTIONS=--max-old-space-size=8192`.
- Typecheck ainda usa `tsc --noEmit`, apesar de `tsgo` estar disponível em `node_modules/.bin`.
- Bibliotecas pesadas ainda entram em import estático: `recharts`, `html2canvas`, `jspdf`, `pdfjs-dist`, `mammoth`, `@twilio/voice-sdk`, `@tiptap/react` com 15+ extensões.
- `vite.config.ts` já tem otimizações agressivas (`maxParallelFileOps: 48`, `reportCompressedSize: false`, `sourcemap: false`, `target: esnext`), o que indica que o problema é volume de código, não configuração.

### Vetor de processo

- Mais de **120 planos** em `.lovable/plan/`, com média de **3 a 5 planos novos por dia** em agosto.
- Planos são **extremamente granulares**: correções de rótulo, ajuste de badge ou bug isolado viram documento próprio.
- Padrão claro de **escopo crescente durante a execução**: uma correção de Apollo vira migration de banco + novos campos + refatoração de helpers.
- Débito técnico recorrente: **RLS, `workspace_id` e permissões** aparecem repetidamente como planos corretivos, indicando base frágil.
- Backlog acumulado em `docs/backlog-pendencias.md`: **49 itens críticos**, 32 deles de paridade HubSpot.

## O que será feito

### Fase 0 — Medir baseline

- Registrar tempo de `bun run build`, `bun run build:dev`, `bun run typecheck` e `bun run lint`.
- Medir tempo de HMR ao salvar um arquivo de rota e um arquivo de componente.
- Contar chunks gerados no build de produção.
- Guardar os números para comparar após cada fase.

### Fase 1 — Ganhos rápidos de build e edição

1. Trocar `typecheck` de `tsc --noEmit` para `tsgo` no `package.json`.
2. Tornar `recharts` e `@tiptap/react` lazy em todos os pontos de uso.
3. Verificar se `@twilio/voice-sdk`, `pdfjs-dist`, `mammoth`, `html2canvas` e `jspdf` já estão em import dinâmico; corrigir os que não estiverem.
4. Reduzir imports estáticos de `*.functions.ts` nas rotas, movendo para dentro de handlers/`useServerFn` quando a função só é usada em ação do usuário.

### Fase 2 — Reduzir o grafo de módulos

1. Quebrar os monolitos dominantes em módulos menores e focados (`workflow-builder.tsx`, `activity-timeline.tsx`, `hubspot-steps.server.ts`).
2. Consolidar server functions muito fragmentadas por domínio, mantendo a regra de módulo fino (só imports e declarações exportadas).
3. Remover exports de componentes de página nas rotas que ainda os tenham, devolvendo-as ao code-splitting.
4. Isolar telas grandes em chunks próprios.

### Fase 3 — Estabilizar a base de dados e permissões

1. Auditar todas as tabelas sem `workspace_id` ou com RLS inconsistente.
2. Aplicar padronização de `workspace_id` e RLS em lote, por schema, em vez de entidade por entidade.
3. Criar testes de integração/E2E que simulem usuários com papéis distintos (admin, manager, member) e validem visibilidade.
4. Implementar `deleteRowGuarded` e `handle-permission-error` em todos os fluxos que ainda não os usem.

### Fase 4 — Otimizar o processo de entrega

1. Criar **Sprints de Polimento** semanais: agrupar bugs de UI, ajustes de rótulo e pequenas correções em um único plano, sem um documento por alteração.
2. Definir regra de escopo: planos de correção simples não podem expandir para schema/RLS sem nova aprovação explícita.
3. Criar templates de plano por tipo (bug, feature, refactor) para reduzir tempo de escrita e revisão.
4. Priorizar o backlog crítico e congelar novas features amplas até que RLS/workspace_id esteja estável.

## Detalhes técnicos

- Foco em `vite.config.ts`, `package.json`, `tsconfig.json` e nos monolitos listados.
- Nenhuma mudança de regra de negócio ou comportamento funcional nas Fases 1 e 2.
- A Fase 3 toca RLS/schema; será feita como esforço concentrado, não por fases micro.
- `routeTree.gen.ts` não será editado manualmente; otimizações nele virão de reorganização de rotas e redução de imports.

## Como validar

1. Rodar `bun run build`, `bun run build:dev`, `bun run typecheck` e `bun run lint` após cada fase.
2. Comparar tempos e tamanho de chunks com a baseline da Fase 0.
3. Smoke test manual nas áreas tocadas: workflows, timeline, associações, grids, contratos.
4. Verificar que nenhuma funcionalidade foi removida ou alterada indevidamente.

## Riscos

- Quebrar monolitos pode introduzir regressões sutis em fluxos complexos (workflows, contratos).
- Padronização massiva de RLS pode bloquear acesso legítimo se policies forem muito restritivas.
- Mudança para `tsgo` pode ocultar erros que `tsc` detecta; precisa de validação cruzada inicial.
- Reduzir granularidade dos planos exige disciplina; sem isso, o padrão de escopo crescente continua.
