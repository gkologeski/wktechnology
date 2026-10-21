# TechProjects — Tarifas, Medições, Financeiro e Rentabilidade (Ciclo 4)

Migrações: `drizzle/migrations/0175_techprojects_cycle4_billing.sql` (aditiva) e `0176_techprojects_cycle4_profitability_safeupdate.sql` (o banco gerenciado recusa UPDATE sem WHERE nas chamadas da API). Prova isolada:
`tests/sql/project-billing-isolated.sh` (dados sintéticos, banco descartável).

## Tabelas

| Tabela                                | Papel                                                                                                                                           |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `project_rates`                       | Preço/custo com vigência `[valid_from, valid_to)`, moeda, unidade (`hour`/`month`), versão e `supersedes_id`. Valor e escopo imutáveis.         |
| `project_billing_configs`             | Modelo de cobrança por contrato ou serviço, versionado por mês, sem retroatividade. É o **dono da cobrança** do serviço no período.             |
| `project_measurements`                | Competência mensal: situação, revisão, `auto_hash`/`lines_hash`, totais, pendências e snapshot de regras.                                       |
| `project_measurement_lines`           | Composição: cada fonte (apontamento, marco, mensalidade, franquia, evento de sucesso, ajuste) com segundos, tarifa, valor e motivo de exclusão. |
| `project_measurement_financial_links` | Medição ↔ `financial_entries` (gerado ou legado vinculado).                                                                                     |
| `project_package_balances`            | Saldo de franquia por competência (FIFO com validade em meses).                                                                                 |
| `project_billing_events`              | Trilha de tudo acima.                                                                                                                           |

Todas: `GRANT SELECT` a `authenticated`, RLS por workspace + permissão, escrita só pelas funções
(flag transacional `app.project_billing_flow`).

## Permissões (`techprojects.*`)

`rates.view/manage`, `billing_config.manage`, `measurements.view/manage/approve`,
`measurement_finance.create` (exige também `techfinance.entries.create.own`), `measurement_reverse.manage`,
`profitability.view`. Nenhum pacote foi concedido pela migração. Custos por pessoa só aparecem com
`rates.view`; valores do título só com leitura do Financeiro.

## Precedência de tarifa (`project_rate_pick`)

Por data do apontamento: custo mensal de alocação/pessoa (não convertido em hora) → exceção confirmada
(projeto+pessoa) → alocação → serviço → pessoa → catálogo. Mais de uma vigência no mesmo nível =
`ambiguous`; nenhuma = `missing` (valor desconhecido). Zero só se cadastrado.

## Fluxo da medição

`draft → in_review → approved|ready → generated → reversed` (ou `cancelled`; `failed` mantém a aprovação).

- Envio e aprovação conferem o hash da prévia e recalculam as fontes (`PREVIEW_STALE`).
- Quem preparou ou enviou não aprova.
- `approved` = pendência para o Financeiro (ex.: título legado do serviço, aceite exigido); `ready` = pode gerar.
- Gerar cria um `financial_entries` `receivable/open` com `origin_type='project_measurement'` e
  `external_ref` único — idempotente. Não emite NF, boleto nem envia cobrança; `invoiced_at/invoice_id`
  dos apontamentos não são tocados.
- Estorno cancela o título só sem pagamento/cobrança bancária/baixa; título legado vinculado é apenas desvinculado.

## Elegibilidade de horas

Aprovadas, faturáveis, não importadas/bloqueadas (`locked_import` fora por padrão), sem cobrança anterior,
não presentes em outra medição ativa (índice único) e, por padrão, de competência fechada.

## Coexistência com mecanismos antigos

- `tickServicesBilling` / `runServicesBillingNow` / `activateService`: pulam serviço cuja cobrança pertence às
  Medições (`project_billing_service_owned`); gatilho em `financial_entries` recusa por segurança.
- `generateFinancialFromBillable` (consolidador antigo de horas): desativado; cobrança de horas é pela medição.
- Marcos: título de marco já medido é recusado; marco já cobrado fica fora da medição.
- Título legado na competência vira pendência: vincular (mesmo valor/moeda) ou resolver no Financeiro.
- Reabrir competência de horas ou editar apontamento/marco em medição não-rascunho é bloqueado por gatilho.

## Rentabilidade (`project_profitability`)

Receita prevista, aprovada, lançada, recebida e estornada separadas; custo estimado (horas × tarifa + custo
mensal alocado) separado do custo real (títulos a pagar). Margem estimada só com 100% de cobertura de custo;
senão `unknown` + margem parcial das horas cobertas. Receita zero → percentual nulo. Moedas não são somadas.

## Limites conhecidos

- Complemento só para por hora/marcos; pacote, mensalidade e percentual exigem estorno e nova medição.
- Pró-rata por dias úteis não suportado (sem calendário); serviço com cadência não mensal fica bloqueado.
- Serviço com dono "Medições" e cursor legado vencido continua sendo pulado pelo tick a cada execução.
