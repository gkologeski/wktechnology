# Os 3 negócios movidos para "Perdido"

## O que aconteceu (verificado no banco)

Às 22:06:36 de 29/08, três negócios saíram do pipeline antigo
(`b790630e-…`) para **Novos Negócios** (`33399bd1-…`) com `stage = lost`:

| Negócio | stage | stage_id gravado |
| --- | --- | --- |
| AN/LRB Solutions/Leandro/Projeto de Aprovações | lost | `lost` (correto) |
| CT/NEXID/Gustavo/Pacote 20h Consultoria | lost | `scope/solution` (errado) |
| CT/KRYON/Paulo Marinho/Avaliação de APPs | lost | `scope/solution` (errado) |

O histórico (`property_history`) confirma: nos dois errados o `stage` foi de
`new` → `lost`, mas o `stage_id` foi de `1018009926` → `scope/solution`.

Causa: na edição em massa, quando o pipeline muda, a resolução automática de
etapa olha apenas o `stage_id`/`stage` **atual** do registro. Como o antigo
`stage_id` (`1018009926`) não existe no pipeline destino e o `stage` atual era
`new`, ela caiu na primeira etapa (`scope/solution`) e **ignorou o `stage = lost`
que o próprio usuário estava enviando no mesmo lote**. O terceiro negócio já
estava como `lost` antes, por isso resolveu corretamente.

Resultado prático: os dois negócios aparecem em "Escopo/Solução" no quadro,
mesmo estando marcados como perdidos na tabela. Nada foi excluído.

## O que será feito

1. **Corrigir os dois registros**: `stage_id = 'lost'`, coerente com `stage = lost`
   e com as etapas de Novos Negócios (`.../won`, `lost`).
2. **Corrigir a causa**: na resolução automática de etapa, priorizar o valor de
   `stage` enviado no próprio payload (quando houver) antes do valor atual do
   registro — mapeando `won`/`lost` para a etapa de mesmo `type` no pipeline
   destino. Sem `stage` no payload, o comportamento atual permanece.
3. **Varredura**: reconferir se restam negócios com `stage` e `stage_id`
   incoerentes (perdido/ganho em coluna aberta) e reportar a lista, sem corrigir
   nada além do que for aprovado.

## Fora do escopo

- Nenhuma migration, schema, RLS, GRANT ou permissão.
- Nenhuma mudança em regras de ganho/perda, probabilidade ou `closed_at`.
- Nenhum redesenho do quadro ou da tabela de Negócios.

## Detalhes técnicos

- `src/lib/pipelines/stage-resolve.ts`: `resolveStageForPipeline` passa a aceitar
  o `stage` desejado (payload) com precedência sobre o `stage` atual.
- `src/lib/grid/bulk-edit.functions.ts`: repassa `payload["stage"]` na resolução
  quando o pipeline muda e a etapa não foi escolhida explicitamente.
- Correção de dados via `UPDATE` nos dois ids, condicionada a
  `stage = 'lost' and stage_id = 'scope/solution'`, com `SELECT` de conferência.

## Validações previstas

`bunx tsgo --noEmit`, ESLint nos arquivos alterados, `bun run test` e conferência
no quadro de Negócios.

## Como validar manualmente

1. Negócios → Quadro (Novos Negócios): os três aparecem em "Perdido".
2. Editar em massa trocando pipeline **e** definindo etapa perdida: os cards vão
   para "Perdido", não para a primeira etapa.
