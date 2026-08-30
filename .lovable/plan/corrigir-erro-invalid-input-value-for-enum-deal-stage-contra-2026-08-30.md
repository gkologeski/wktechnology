# Corrigir erro "invalid input value for enum deal_stage: contract" na edição em massa

## O que está acontecendo

Negócios têm duas colunas de etapa: `stage_id` (etapa real do pipeline, texto livre, ex. `contract`) e `stage` (coluna legada com enum fixo `new/qualified/proposal/negotiation/won/lost`).

No catálogo de campos (`src/lib/entity-fields.functions.ts`, linhas 265-270) **as duas colunas recebem as mesmas opções de etapa do pipeline**. Então a propriedade "Etapa" apresentada no diálogo pode ser a coluna legada `stage`, e o valor escolhido (`Contratação` → slug `contract`) é gravado direto no enum, que rejeita o valor. Daí o erro do anexo.

## Correção proposta

1. **Não oferecer a coluna legada como propriedade editável quando existir `stage_id`**
   - Em `src/lib/entity-fields.functions.ts`: quando a entidade tiver `stage_id`, marcar `stage` como campo de sistema/oculto para edição em massa, de modo que só a etapa canônica apareça no combo. Assim o usuário nunca escolhe a coluna do enum.

2. **Normalizar no servidor (defesa em profundidade)**
   - Em `src/lib/grid/bulk-edit.functions.ts`: se o payload trouxer `stage` com um valor que **não** pertence ao enum legado, tratá-lo como etapa de pipeline: mover o valor para `stage_id` e derivar `stage` via `legacyStageFor` (grava `won`/`lost` ou omite a coluna quando a etapa é aberta), em vez de enviar o slug ao Postgres.
   - Reaproveitar os helpers já existentes em `src/lib/pipelines/stage-resolve.ts` (`legacyStageFor`, `stageTypeOf`, `checkStageCoherence`); nenhum novo conceito.

3. **Mensagem de erro clara**
   - Caso a etapa escolhida não exista no pipeline de destino, retornar mensagem em PT-BR indicando pipeline e etapa, em vez do erro cru do banco.

## Fora do escopo

- Nenhuma alteração de schema, migration, RLS, GRANT ou permissões.
- Nenhuma remoção da coluna legada `stage` (segue mantida em sincronia).
- Nenhuma mudança de layout do diálogo além de deixar de listar a propriedade duplicada.

## Validação

- `bunx tsgo --noEmit`, ESLint dos arquivos alterados, `bun run test`.
- Teste manual: selecionar 1 negócio em Hunting → (AC) Assinatura de Contrato, editar em massa para pipeline "Novos Negócios" / etapa "Contratação" e confirmar que grava `stage_id = contract` sem erro e que o card aparece na etapa correta.
