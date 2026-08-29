# O que aconteceu com os 2 negócios editados em massa

## Diagnóstico (verificado no banco)

Os dois negócios são:

- `FS/Brooks/Sérgio/Pacote de 100h Manutenção Desktop`
- `FS/Grupo ATTO/Marco`

O histórico de propriedades (`property_history`, 29/08 21:24) registra **apenas uma alteração** em cada um:

```text
pipeline_id: "Fábrica de Software" -> "Novos Negócios"
```

Não houve nenhuma alteração de etapa. Os dois continuam com `stage_id = 31485763`
(identificador legado vindo do HubSpot) e `stage = won`.

O problema: o pipeline "Novos Negócios" só tem as etapas
`scope/solution`, `proposal`, `negotiation`, `contract`, `won`, `lost`.
Como o quadro agrupa os cards por `stage_id`, um valor que não existe em nenhuma
coluna faz o negócio **desaparecer do quadro** — ele não foi excluído, só ficou
sem coluna correspondente. Na tabela ele continua visível.

Ou seja: nada foi perdido; a troca de pipeline foi aplicada e a troca de etapa não.

## O que será feito

1. **Corrigir os dois registros**: definir `stage_id = "won"` (coerente com
   `stage = won` e com as etapas do pipeline destino), para voltarem a aparecer
   na coluna "Ganho" do quadro de Novos Negócios.
2. **Corrigir a causa na edição em massa**: quando `pipeline_id` for alterado,
   validar a etapa contra as etapas do pipeline destino:
   - se a etapa selecionada não pertencer ao pipeline destino, bloquear com
     mensagem clara em vez de gravar valor inválido;
   - se apenas o pipeline for alterado e a etapa atual não existir no destino,
     mover para a primeira etapa do pipeline destino (ou para a etapa de mesmo
     `type`, quando houver — caso de `won`/`lost`), mantendo `stage` e `stage_id`
     coerentes.
3. **Rede de segurança no quadro**: cards com etapa desconhecida passam a cair
   numa coluna "Sem etapa" (rótulo em PT-BR, mesmo padrão visual das demais),
   para que nunca fiquem invisíveis.
4. **Varredura**: verificar se existem outros negócios com `stage_id` fora das
   etapas do próprio pipeline e reportar a lista antes de qualquer correção em
   lote (sem corrigir automaticamente além dos dois relatados).

## Fora do escopo

- Nenhuma migration, alteração de schema, RLS, GRANT ou permissão.
- Nenhuma mudança nas regras de ganho/perda, probabilidade ou `closed_at`.
- Nenhum redesenho do quadro ou da tabela de Negócios.

## Detalhes técnicos

- Correção de dados via `UPDATE` nos dois ids (`385b882f-…`, `ff9d68d6-…`).
- Validação de etapa/pipeline em `src/lib/grid/bulk-edit.functions.ts` +
  helper novo em `src/lib/pipelines/` (lendo `pipelines.stages` jsonb),
  aproveitado também pelo diálogo de edição em massa.
- Coluna de fallback em `src/components/deals/deals-board.tsx`
  (agrupamento atual: `d.stage_id || d.stage`).

## Validações previstas

`bunx tsgo --noEmit`, ESLint nos arquivos alterados, `bun run test` e conferência
no quadro/tabela de Negócios.

## Como validar manualmente

1. Abrir Negócios em modo Quadro no pipeline "Novos Negócios": os dois negócios
   aparecem na coluna "Ganho".
2. Selecionar negócios e editar em massa trocando só o pipeline: a etapa é
   ajustada automaticamente para uma etapa válida do destino.
3. Tentar combinar pipeline A com etapa de pipeline B: a operação é recusada com
   mensagem explicativa.
