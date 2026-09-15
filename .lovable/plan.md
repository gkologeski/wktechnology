# Itens de linha: salvar/desfazer + modelo de cobrança que casa com o contrato

## Parte 1 — Botões de Salvar e Desfazer (mantendo o autosave)

O modal de itens de linha continua salvando automaticamente ao sair de cada campo. Além disso:

- **Salvar**: grava imediatamente qualquer alteração ainda pendente e mostra confirmação. Fica desabilitado quando não há nada pendente.
- **Desfazer última ação**: reverte a última alteração feita no modal (edição de campo, inclusão ou exclusão de item), com aviso do que foi revertido. Podem ser desfeitas as últimas 20 ações da sessão do modal.
- **Indicador de estado** ao lado dos botões: "Salvando…", "Salvo" ou "Alterações não salvas", para o usuário nunca ficar em dúvida.

## Parte 2 — Modelo de cobrança único para negócio e contrato

Hoje o negócio e o contrato guardam informação diferente: o item do negócio tem unidade, preço, cargo e senioridade; o serviço do contrato tem quantidade, preço, cadência e cargo, **mas não tem unidade nem forma de cobrança**. Por isso os dados não "casam" ao virar contrato.

A proposta é criar um **modelo de cobrança** compartilhado, com os mesmos campos nos três lugares (catálogo, item do negócio, serviço do contrato):

| Campo             | Significado                                    | Exemplos                                                     |
| ----------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| Forma de cobrança | Como o serviço é cobrado                       | Por unidade, Por hora, Por headcount/mês, % do salário, Fixo |
| Unidade           | O que é contado                                | hora, unidade, vaga, headcount, mês                          |
| Valor por unidade | Preço unitário                                 | R$ 250/hora                                                  |
| Quantidade        | Quantas unidades                               | 160 horas, 2 vagas, 3 headcount                              |
| Base de cálculo   | Só quando a cobrança é percentual              | Salário alvo da vaga                                         |
| Percentual        | Só quando a cobrança é percentual              | 100% do salário alvo                                         |
| Recorrência       | Único, mensal, trimestral, anual, na entrega   | Outsourcing = mensal; Hunting = único                        |

Cada serviço do catálogo passa a ter uma **forma de cobrança padrão**, que se aplica sozinha ao escolher o serviço:

- **Hunting de TI** — por vaga contratada; valor fixo por vaga **ou** percentual do salário alvo (o usuário escolhe). Recorrência: único.
- **Fábrica de Software** — por hora prestada, com valor/hora e horas estimadas. Recorrência: mensal por medição.
- **Outsourcing de TI** — unidade escolhível (hora ou headcount/mês), valor por unidade e quantidade. Recorrência: mensal.
- **Consultoria** — por hora. **BPO/RH** — fixo mensal.

Os presets de contratação existentes continuam funcionando e passam a carregar também a forma de cobrança, unidade e recorrência.

## Parte 3 — Ligação negócio → contrato

- Ao gerar o contrato a partir do negócio ganho, cada item de linha vira um serviço do contrato **com todos os campos de cobrança já preenchidos** (forma, unidade, valor, quantidade, percentual, recorrência) — sem redigitar nada.
- No contrato, a tela de serviços passa a mostrar a cobrança de forma legível ("R$ 250/hora × 160h/mês", "100% do salário alvo por vaga") e permite ajuste antes de ativar.
- Divergências entre o negócio e o contrato (valor alterado, quantidade diferente) ficam visíveis no contrato como aviso, sem bloquear.
- A cobrança percentual do Hunting alimenta o faturamento pelo valor calculado (salário alvo × percentual), não por um valor digitado solto.

## Detalhes técnicos

- Nova enum `billing_model` (`per_unit`, `per_hour`, `per_headcount_month`, `percent_of_base`, `fixed`) e módulo compartilhado `src/lib/catalog/billing-model.ts` com rótulos pt-BR, campos exigidos por modelo e cálculo do valor da linha (`computeBillingAmount`), usado por negócio, cotação e contrato.
- Migration aditiva (nada removido, tudo nullable ou com default):
  - `service_catalog`: `billing_model`, `default_cadence`, `default_percent`, `percent_base_label`, `allowed_units text[]`.
  - `deal_line_items`: `billing_model`, `percent`, `percent_base_amount`, `cadence`.
  - `services`: `unit`, `billing_model`, `percent`, `percent_base_amount`.
  - `quote_line_items`: mesmos campos do item de negócio, para o PDF refletir a cobrança.
- `src/components/deals/deal-line-items.tsx` (já em 667 linhas) é dividido: cálculo/estado em `use-line-items.ts`, histórico de desfazer em `line-items-history.ts`, campos de cobrança em `line-item-billing-fields.tsx`, mantendo o componente abaixo do limite de 350 linhas.
- Desfazer usa uma pilha em memória com o valor anterior de cada campo/linha; exclusão guarda a linha completa e recria com o mesmo `position`. Sem tabela nova.
- `linkCatalogServiceToContract` e a conversão negócio→contrato passam a copiar os campos de cobrança; `recalc_deal_value` e o cálculo de faturamento passam a considerar cobrança percentual.
- Backfill no mesmo migration: preenche `billing_model`/`unit` dos registros existentes a partir da unidade atual do catálogo, mantendo valores já lançados intactos.
- Validação: `bun run typecheck`, `bun run lint`, `bun run test` (com novos testes de `computeBillingAmount` e do histórico de desfazer) e conferência manual em um negócio real e no contrato gerado.

## Fases sugeridas

1. Salvar/Desfazer/indicador no modal de itens de linha (entrega isolada, sem banco).
2. Modelo de cobrança no catálogo + campos no item de linha, com aplicação automática por serviço.
3. Espelhamento no serviço do contrato e na conversão negócio→contrato.
4. Cotações e faturamento percentual.
