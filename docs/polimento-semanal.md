# Polimento semanal — fila única de ajustes de UI

> Fila única para ajustes pequenos de interface que **não** justificam um plano
> próprio. Regra: se o ajuste exigir mudança de schema, RLS, permissões,
> autenticação ou regra de negócio, ele **sai daqui** e vira um plano
> `feature`/`refactor` (ver `docs/plan-templates.md` e a seção 10 de
> `docs/operations-runbook.md`).

Última atualização: 2026-08-31

## Como usar

1. Registre o item na tabela abaixo assim que for observado (não acumule em chat).
2. Prioridade: `alta` (bloqueia leitura/uso), `média` (atrito visível),
   `baixa` (cosmético).
3. Estado: `aberto`, `em andamento`, `feito`, `descartado`.
4. A cada ciclo semanal, puxe os itens de prioridade alta e média; itens `feito`
   podem ser removidos após o ciclo seguinte.
5. Todo item entregue precisa manter loading/empty/error, foco visível, dark mode
   e responsividade — sem exceção, mesmo em ajuste cosmético.

## Fila

| # | Item | Tela / rota | Sintoma | Prioridade | Estado |
| - | ---- | ----------- | ------- | ---------- | ------ |
| 1 | Densidade dos cards de Kanban | `/deals`, `/leads` | Cards ainda altos em telas menores após a compactação de datas | média | aberto |
| 2 | Barra de seleção em massa em telas estreitas | grids e quadros com `BulkActionBar` | Em <768px a barra pode cobrir a ação primária do rodapé | média | aberto |
| 3 | Rótulos longos em combos de etapa/substatus | `/settings/pipelines`, quadros | Texto truncado sem tooltip com o valor completo | baixa | aberto |
| 4 | Skeletons pouco fiéis | telas de detalhe (contratos, pessoas) | Skeleton não reflete o layout final, causando salto visual | baixa | aberto |
| 5 | Estados vazios sem próxima ação | telas secundárias de configurações | `EmptyState` sem CTA claro | baixa | aberto |

## Fora desta fila

- Redesign de tela inteira.
- Mudança de fluxo, campo obrigatório ou regra de negócio.
- Qualquer alteração de banco, RLS ou permissão.
