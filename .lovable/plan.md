# Reduzir tempo de implementação — o que falta (Fases 2 a 4)

## Estado atual (verificado agora)

Concluído:
- Fase 0 (baseline medida) e Fase 1 — `typecheck` já usa `tsgo --noEmit`; build de produção em ~69s; lint com 0 erros.
- Bibliotecas pesadas praticamente todas em import dinâmico (restam 2 arquivos com `recharts` estático e 1 com `@tiptap`).
- `client.server` removido do escopo de módulo em todos os `*.functions.ts`.
- `activity-timeline.tsx` quebrado (arquivo monolítico não existe mais); `leads.tsx` reduzido de 1.637 para 685 linhas.

Pendente:
- `workflow-builder.tsx` (1.910 linhas) e `hubspot-steps.server.ts` (2.088 linhas) continuam monolíticos.
- `candidates.index.tsx` (1.517) e `jobs.$id.tsx` (1.467) ainda não foram quebrados.
- 105 rotas ainda importam `*.functions.ts` estaticamente no topo.
- Fase 3 (auditoria de `workspace_id`/RLS em lote + testes por papel) não iniciada.
- Fase 4 (processo: sprints de polimento, regra de escopo, templates de plano) não iniciada.

## Correção bloqueante primeiro

`src/routes/_authenticated/leads.tsx` perdeu o import de `useAutoCreateParam` na refatoração e o build está quebrado (TS2304 na linha 108). Restaurar `import { useAutoCreateParam } from "@/hooks/use-auto-create-param";` antes de qualquer outra coisa e rodar `bun run typecheck`.

## Fase 2 — concluir a redução do grafo de módulos

1. Quebrar `hubspot-steps.server.ts`: extrair o `runStep` em módulos por grupo de passos (`hubspot-sync-steps.server.ts`, `hubspot-discovery.server.ts`), mantendo o arquivo original como dispatcher fino.
2. Quebrar `workflow-builder.tsx`: extrair painel de passos, painel de condições e editor de campos para `src/components/workflows/builder/*`.
3. Quebrar `candidates.index.tsx` e `jobs.$id.tsx` em componentes sob `src/components/ats/candidates/` e `src/components/ats/jobs/` (grid, barra de ações em massa, abas, cabeçalho).
4. Converter os 2 usos estáticos restantes de `recharts` e o 1 de `@tiptap` em import dinâmico.
5. Passar as rotas de maior peso (top 20 por tamanho) a chamar server functions via `useServerFn` dentro de handlers, reduzindo imports estáticos.

Sem mudança de comportamento nesta fase.

## Fase 3 — estabilizar dados e permissões

1. Inventário SQL das tabelas em `public` sem `workspace_id` e das que têm RLS incompleta (sem policy por comando ou sem GRANT).
2. Migration única por lote corrigindo GRANT/RLS faltantes — sem alterar regra de negócio.
3. Testes E2E de visibilidade por papel (admin, manager, member) cobrindo Leads, Contatos, Negócios, Contratos e People.
4. Aplicar `deleteRowGuarded` e `handle-permission-error` nos fluxos restantes de exclusão/edição.

## Fase 4 — processo de entrega

1. Templates de plano por tipo (bug, feature, refactor) em `docs/`.
2. Regra escrita: plano de correção simples não expande para schema/RLS sem nova aprovação.
3. Consolidar bugs de UI em um único plano semanal de polimento.
4. Repriorizar `docs/backlog-pendencias.md` marcando o que está congelado até a Fase 3 terminar.

## Como validar

- `bun run typecheck`, `bun run lint`, `bun run test` e `bun run build` após cada item da Fase 2, comparando com a baseline (~69s de build, ~31s de typecheck).
- Smoke manual em Workflows, HubSpot sync, Candidatos, Vaga e Leads após as quebras.
- Fase 3: rodar o linter de banco e os novos testes E2E por papel.
