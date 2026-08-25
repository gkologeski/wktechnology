# Exclusão em massa nos grids — auditoria e ajuste pontual

## O que já existe (verificado no código)

- `src/components/grid/grid-bulk-bar.tsx` (barra padrão dos grids) já tem botão **Excluir**, com:
  - confirmação por contagem (`ConfirmCountDialog`);
  - detecção de bloqueio silencioso por permissão (`deniedIfUnaffected`);
  - aviso parcial ("X de Y excluído(s). Verifique suas permissões.").
    Usada em: Candidatos, Vagas, Ofertas, Pessoas, Documentos, Benefícios, Incidentes, Projetos, Tarefas, Propostas, Serviços, Lançamentos financeiros, além das visões Quadro/Kanban (`entity-board.tsx`, `kanban-board.tsx`, `deals-board.tsx`, `tickets-board.tsx`).
- `src/components/entity-list.tsx` (lista genérica usada pelos demais módulos) tem exclusão em massa com o mesmo padrão (confirmação por contagem + `deniedIfUnaffected`).
- `src/components/contracts/contracts-bulk-bar.tsx` tem exclusão em massa própria, com bloqueio por regra de hierarquia e tooltip explicando quando não é permitido.

Conclusão: sim, existe exclusão em massa em praticamente todos os grids do sistema.

## Única lacuna encontrada

O grid de **Negócios** (`src/components/deals/deals-hubspot-table.tsx`) tem exclusão em massa, mas fora do padrão:

- usa `confirmDialog` simples em vez de `ConfirmCountDialog`;
- não usa `.select("id")` + `deniedIfUnaffected`, então quando a RLS bloqueia a exclusão o toast diz "excluído(s)" mesmo sem nada ter sido apagado (exclusão silenciosa);
- a exclusão individual da linha tem o mesmo problema.

## Ajuste proposto (escopo mínimo)

Alinhar `deals-hubspot-table.tsx` ao padrão dos outros grids:

1. Trocar a confirmação da exclusão em massa por `ConfirmCountDialog` (contagem + entidade "negócio").
2. Nas exclusões (individual e em massa), usar `.delete().in/eq(...).select("id")` e tratar o retorno com `deniedIfUnaffected` de `@/lib/access-control/rls-denied`.
3. Mensagem de resultado parcial quando o número removido for menor que o selecionado.
4. Manter invalidação de cache já existente (`queryKey: ["deals"]`).

Sem mudanças de schema, RLS, permissões ou regra de negócio.

## Validação

- `bun run typecheck` e `bun run lint`.
- Manual: selecionar vários negócios, confirmar contagem no diálogo, verificar atualização do grid; e verificar que um usuário sem permissão recebe aviso de bloqueio em vez de "excluído".
