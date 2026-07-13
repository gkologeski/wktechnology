## Diagnóstico

No banco o deal continua com `pipeline_id = NULL` (`stage_id = 1017586011`). Ou seja, apesar do print mostrar "Serviços" no combo, a gravação nunca aconteceu.

Causa em `src/routes/_authenticated/deals.$id.tsx`:

- `dealPipeline` (linhas 50–59) faz fallback: quando `deal.pipeline_id` é nulo, resolve para o `is_default` (Serviços) ou o primeiro pipeline.
- O `<Select value={dealPipeline?.id ?? ""}>` (linha 151) fica com "Serviços" já selecionado visualmente, mesmo o DB estando `NULL`.
- Ao clicar em "Serviços", o Radix Select não dispara `onValueChange` porque o valor não mudou — logo `setPipeline` nunca roda e nada é salvo.

Como o board (`deals.tsx:196`) filtra por `d.pipeline_id !== selected.id`, o deal com `pipeline_id = NULL` continua invisível.

## Correção

`src/routes/_authenticated/deals.$id.tsx`:

- Ler o valor real do combo direto do deal (`deal.pipeline_id ?? ""`), não do `dealPipeline` (que já aplica fallback).
- Manter `dealPipeline` só para calcular os estágios do StageTracker.
- Assim o Select mostra placeholder "Selecione o funil" quando `pipeline_id` é nulo e disparar "Serviços" gera `onValueChange` → `setPipeline` → update no banco.

Sem mudanças em RLS, board, schema ou drawer.

## Validação manual

1. Recarregar `/deals/a3f7fed6-...`; combo de funil deve exibir "Selecione o funil".
2. Escolher "Serviços" e confirmar toast "Funil atualizado".
3. Voltar em `/deals` (aba Quadro, funil Serviços) e conferir que o deal aparece na coluna do primeiro estágio.
4. Ajustar o estágio no StageTracker se necessário.

## Fora de escopo

- Backfill em massa de deals sem `pipeline_id` (fica para tarefa separada).
