# Corrigir campos duplicados no modal de edição em massa (Contatos)

## Diagnóstico confirmado

O modal lista os campos vindos do catálogo dinâmico (`src/lib/entity-fields.functions.ts`).
A tabela `public.contacts` tem, de fato, quatro colunas envolvidas:

- `company_id` (uuid) e `company_name` (text) — ambas rotuladas hoje como **"Empresa"**
- `assigned_to` (uuid) e `assigned_user_id` (uuid) — ambas rotuladas hoje como **"Responsável"**

Não há duplicação de renderização: são colunas distintas com rótulos idênticos no mapa
`LABELS`, o que faz parecer que o campo aparece 2x. `assigned_user_id` ainda é usada por
código legado (rotação/round-robin, HubSpot, convites), então não deve ser removida.

## O que muda

Apenas os rótulos e a classificação de campos no catálogo — nenhuma alteração de schema,
RLS, server function ou regra de negócio.

1. `company_id` → "Empresa" (permanece o campo principal, com seletor por nome).
2. `company_name` → "Empresa (texto livre)" e marcada como campo de sistema, para cair no
   bloco recolhido de campos avançados em vez de competir com a associação real.
3. `assigned_to` → "Responsável" (permanece o campo oficial de atribuição).
4. `assigned_user_id` → "Responsável (legado)" e marcada como campo de sistema.

Com isso, o usuário vê no topo apenas "Empresa" e "Responsável"; os equivalentes legados
continuam acessíveis em "Mostrar campos de sistema", sem perda de funcionalidade.

## Detalhes técnicos

- Arquivo: `src/lib/entity-fields.functions.ts`
  - Ajustar `LABELS` para `company_name` e `assigned_user_id`.
  - Incluir `company_name` e `assigned_user_id` na lista de campos marcados como
    `system: true` (mesma lista usada para colapsar colunas técnicas).
- O modal (`src/components/grid/bulk-edit-fields-dialog.tsx`) já separa `system` em bloco
  recolhido — nenhuma mudança necessária lá.
- Efeito colateral desejado: os mesmos rótulos passam a ficar distintos também no seletor
  de colunas, filtros e construtor de workflows, que consomem o mesmo catálogo.

## Validação

- `bun run typecheck` e `bun run test`.
- Manual: /contacts → selecionar registros → "Editar em massa" → confirmar que "Empresa" e
  "Responsável" aparecem uma única vez e que os legados aparecem apenas no bloco de
  campos de sistema.
