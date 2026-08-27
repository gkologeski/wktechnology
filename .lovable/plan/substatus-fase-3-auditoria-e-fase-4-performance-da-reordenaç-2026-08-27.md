# Substatus — Fase 3 (Auditoria) e Fase 4 (Performance da reordenação)

Continuação do plano de Substatus. Fases 1 (filtros) e 2 (automações) já concluídas.

## Fase 3 — Histórico de alterações de Substatus

Objetivo: no detalhe do Lead e do Negócio, mostrar quem mudou o substatus, quando, valor anterior e valor novo.

O que já existe (verificado): a tabela `property_history` é alimentada pelos gatilhos `leads_audit` e `deals_audit`, com leitura isolada por workspace. Ela já registra qualquer coluna alterada, inclusive `stage_substatus_id` (hoje sem registros porque o campo é novo).

O que será feito:
- Camada de leitura do histórico filtrando `property in ('stage_substatus_id','stage','status')`, resolvendo o nome do substatus (id → nome/cor) e o nome do usuário que alterou.
- Novo componente de UI "Histórico de substatus" (timeline compacta), com loading, vazio e erro, usando os componentes oficiais do design system.
- Exibição no detalhe do Lead (`leads.$id.tsx`) e do Negócio (`deals.$id.tsx`), na aba/seção de detalhes, sem alterar o layout existente.
- Formato de cada linha: "De <Substatus A> para <Substatus B> — Usuário — data/hora (pt-BR)"; quando não havia valor anterior, mostra "Definido como <Substatus>".

Sem migration nesta fase: o registro já é automático via gatilho.

## Fase 4 — Reordenação rápida de Substatus

Problema atual: `reorderSubstatuses` faz um `UPDATE` por item em série; com muitas opções na etapa isso fica lento e pode ficar parcialmente aplicado.

O que será feito:
- Migration criando uma função no banco que recebe a lista ordenada de ids e grava todas as posições em uma única transação (respeitando RLS/permissões do usuário).
- `reorderSubstatuses` passa a chamar essa função única, mantendo a mesma assinatura para não afetar quem já a usa.
- Reordenação otimista na UI do editor de substatus (a lista reordena na hora e reverte com aviso em caso de erro).

## Detalhes técnicos

- Leitura: `src/lib/pipelines/substatus-history.ts` (query TanStack + join de nomes via `pipeline_stage_substatuses` e perfis).
- UI: `src/components/pipelines/substatus-history.tsx`, tokens semânticos, dark mode, responsivo.
- Escrita em lote: função SQL `public.reorder_pipeline_substatuses(_ids uuid[])` (SECURITY INVOKER, `search_path = public`), com `GRANT EXECUTE` para `authenticated`; RLS da tabela continua decidindo o que pode ser atualizado.
- Ajuste em `src/lib/pipelines/substatuses.ts` e no editor em `settings.pipelines.tsx`.

## Validação

- `bun run lint --fix`, `bun run typecheck`, `bun run test`.
- Manual: mudar substatus de um lead e de um negócio e conferir o histórico; reordenar 10+ substatus e conferir ordem persistida após recarregar.

## Fora de escopo

- Fase 5 (enriquecimento por LinkedIn), que segue registrada para depois.
