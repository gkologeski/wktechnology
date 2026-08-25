# Por que valores monetários aparecem sem formatação — e como corrigir

## O diagnóstico (verificado no código)

Existem três caminhos diferentes de exibição de campos, e apenas um deles conhece "moeda":

1. `src/components/properties-panel.tsx` **tem** formatação de moeda (`formatCurrency`), mas só quando o tipo é `currency`. Como o tipo é adivinhado por heurística em `inferDisplayType`, ela só reconhece chaves `value`, `amount`, `*_amount` e `*_value`. Colunas como `budget`, `price`, `cost`, `*_rate`, `salary_*`, `mrr`, `annual_revenue`, `fee`, `*_price`, `*_cost` caem em texto puro e aparecem como `1500` em vez de `R$ 1.500,00`.
2. O catálogo genérico de campos (`src/lib/entity-fields.functions.ts`) só possui os tipos `text | number | date | select | boolean` — não existe `currency`. Toda coluna `numeric` do banco vira `number`, então telas que renderizam campos por catálogo (ex.: bloco "Dados do Lead" da qualificação, `qualification-entity-fields.tsx`, editor de campos de workflows) exibem e editam o número cru.
3. Propriedades personalizadas (`custom-properties.functions.ts`) também só têm o tipo `number`, sem opção de moeda, logo nunca formatam.

Ou seja: não é um bug de um campo específico — é falta de um conceito único de "campo monetário" compartilhado pelas três camadas.

## O que será feito

### 1. Uma única fonte de verdade para "é dinheiro"

Novo módulo `src/lib/format/money-fields.ts` com:

- `isMoneyField(key)`: reconhece por convenção de nome (`value`, `amount`, `budget`, `price`, `cost`, `fee`, `salary`, `revenue`, `mrr`, `arr`, `total`, `subtotal`, `discount_value`, `*_amount`, `*_value`, `*_price`, `*_cost`, `*_rate` monetários) com uma lista de exceções explícitas (`late_fee_percent`, `*_percent`, `payment_day`, `hours_per_month`, `notice_days`, `confidence`, `score`, etc.);
- `formatMoney(value, currency)` reaproveitando `formatCurrency` de `src/lib/crm.ts`, respeitando a coluna `currency` do próprio registro quando existir (fallback BRL).

### 2. Painel de propriedades (detalhe de Lead, Negócio, Empresa, Contato, Contrato…)

- `inferDisplayType` passa a usar `isMoneyField`, cobrindo todos os campos monetários hoje sem formatação.
- Na edição, o campo monetário usa o `CurrencyInput` já existente (`src/components/ui/currency-input.tsx`) em vez de `<input type="number">`, mantendo o valor salvo como número (sem mudança de payload).

### 3. Catálogo genérico de campos

- Adicionar `currency` ao `EntityFieldType` e classificar as colunas monetárias em `inferType`/overrides.
- Onde os campos do catálogo são renderizados (qualificação de lead, editor de campos extras de workflows), `currency` exibe formatado e edita com `CurrencyInput`; o payload continua numérico.

### 4. Propriedades personalizadas

- Novo tipo `currency` no cadastro de propriedades, com exibição formatada e input monetário. Propriedades `number` existentes continuam funcionando igual (nenhuma migração de dados).

### 5. Consistência visual

- Alinhamento à direita e `title=` com o valor completo nos campos monetários, seguindo o padrão já usado nas telas financeiras.

## Detalhes técnicos

- Arquivos previstos: novo `src/lib/format/money-fields.ts`; edições em `src/components/properties-panel.tsx`, `src/lib/entity-fields.functions.ts`, `src/components/prospecting/qualification-entity-fields.tsx`, `src/components/workflows/extra-fields-editor.tsx`, `src/lib/custom-properties.functions.ts` e a tela de cadastro de propriedades.
- Sem alteração de schema, RLS, permissões ou regras de negócio; nada muda no que é gravado no banco.
- Testes unitários para `isMoneyField`/`formatMoney` (inclui os casos-armadilha de percentuais, dias e scores) + typecheck, lint e testes existentes.

## Fora de escopo

Telas financeiras, propostas e contratos que já formatam corretamente não serão redesenhadas — apenas herdam o helper quando isso não altera o resultado atual.
