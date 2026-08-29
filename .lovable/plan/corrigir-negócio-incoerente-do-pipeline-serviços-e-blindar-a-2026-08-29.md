# Corrigir negócio incoerente do pipeline Serviços e blindar a edição em massa

## Diagnóstico (verificado no banco)

Negócio: `Negócio - Leandro Borges` (pipeline **Serviços**).

- `stage_id = 1047216245`, que **existe** no pipeline Serviços e é a etapa
  `(NP) Negócio Perdido`, tipo `lost`.
- `stage = won`, ou seja, o enum legado ficou desatualizado.
- Histórico: em 24/06 `stage` foi para `won`; em 07/08 `stage_id` mudou de
  `1017586011` (Direcionamento de Oportunidade, tipo `won`) para `1047216245`
  (Negócio Perdido) **sem** atualizar `stage`.
- `closed_at` já está preenchido (07/08), coerente com um negócio fechado.

Ou seja: a etapa real do quadro é "Negócio Perdido"; o valor correto de `stage`
é `lost`.

## O que será feito

1. **Correção do registro**: definir `stage = 'lost'` no negócio
   `Negócio - Leandro Borges`, mantendo `stage_id = 1047216245` (etapa válida do
   pipeline) e `closed_at` como está. Nenhum outro registro é alterado.
2. **Validação de coerência na edição em massa**: quando `stage_id` e `stage`
   forem enviados juntos, verificar se o tipo da etapa (`won`/`lost`/`open`) é
   compatível com o `stage` legado. Se houver conflito, a operação é **recusada**
   com mensagem clara, em vez de gravar um par contraditório.
3. **Derivação automática quando só um lado é informado**:
   - `stage_id` informado e `stage` não → `stage` é derivado da etapa (regra
     atual de `legacyStageFor`), inclusive quando o pipeline não muda;
   - `stage` informado (`won`/`lost`) e `stage_id` não, sem troca de pipeline →
     `stage_id` é ajustado para a etapa do mesmo tipo no pipeline atual do
     registro, agrupando por pipeline; quando o pipeline não tiver etapa desse
     tipo, o registro é ignorado nesse ajuste e apenas `stage` é gravado.
4. **Varredura final**: reexecutar a consulta de incoerências
   (`stage` vs. tipo da etapa em `pipelines.stages`) e reportar o resultado.
   Nada além do item 1 é corrigido sem aprovação.

## Fora do escopo

- Nenhuma migration, schema, RLS, GRANT ou permissão.
- Nenhuma mudança em regras de probabilidade, `closed_at` ou workflows de
  ganho/perda.
- Nenhuma alteração visual no quadro ou nas telas de Negócios.

## Detalhes técnicos

- `src/lib/pipelines/stage-resolve.ts`: novas funções puras
  `stageTypeOf(stages, stageValue)` e
  `checkStageCoherence(stages, { stage, stage_id })`, retornando erro descritivo
  quando o par é contraditório.
- `src/lib/grid/bulk-edit.functions.ts`: aplicar a checagem para as entidades de
  `PIPELINE_ENTITIES` **antes** do update, tanto com troca de pipeline quanto
  sem; e resolver `stage_id` a partir de `stage` quando só `stage` vier, lendo o
  `pipeline_id` atual dos registros e agrupando os updates por pipeline.
- Correção de dados via `UPDATE` condicionado
  (`id = '7c1a5ca9-…' and stage_id = '1047216245'`), com `SELECT` de conferência.

## Validações previstas

`bunx tsgo --noEmit`, ESLint dos arquivos alterados, `bun run test` e a consulta
de varredura de incoerências.

## Como validar manualmente

1. Abrir Negócios no pipeline Serviços: o negócio aparece em "(NP) Negócio
   Perdido" e é contado como perdido, não como ganho.
2. Editar em massa enviando etapa "Negócio Perdido" junto com estágio "Ganho":
   a operação é recusada com mensagem explicativa.
3. Editar em massa apenas o estágio para "Perdido": a etapa passa para a etapa
   de perda do pipeline do registro.
