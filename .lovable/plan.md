# Por que "Receita anual" continua sem R$ na qualificação

## Causa confirmada

O bloco "Dados da Empresa" do questionário está configurado com o campo de chave `annualrevenue` (verificado no `field_layout` do "Questionário Padrão" e na coluna `companies.annualrevenue`, tipo numérico) — sem separador entre "annual" e "revenue".

A heurística de dinheiro (`src/lib/format/money-fields.ts`) só reconhece nomes exatos (`revenue`, `value`, `amount`…) ou com separador (`_revenue`, `_amount`…). Como `annualrevenue` não casa com nenhuma dessas regras, `isMoneyField("annualrevenue")` retorna falso, o campo cai no caminho de número puro e aparece como `1500` em vez de `R$ 1.500,00`.

Ou seja: não é um bug do painel de qualificação (ele já trata `currency` e números com nome de dinheiro), é a heurística que não cobre chaves colapsadas herdadas do HubSpot.

## O que será feito

1. **Reconhecer chaves sem separador** em `isMoneyField`: normalizar a chave (remover `_`/`-`) e comparar também contra os radicais monetários no fim do nome (`revenue`, `amount`, `value`, `price`, `cost`, `fee`, `salary`, `budget`, `mrr`, `arr`, `acv`, `tcv`), cobrindo `annualrevenue`, `totalrevenue`, `dealamount`, `hs_acv`, `hs_arr`, `hs_tcv`.
2. **Blindar os falsos positivos** que a auditoria das colunas numéricas revelou e que não são dinheiro: `total_score`, `total_cycles` e os contadores chamados apenas `total` em `email_broadcasts`, `enrichment_jobs` e `whatsapp_campaigns` continuam como número; percentuais, dias e scores permanecem excluídos como hoje.
3. **Rótulo PT-BR**: garantir `annualrevenue` → "Receita anual" no catálogo de rótulos, para não depender do texto salvo no bloco.
4. **Testes**: acrescentar aos testes de `money-fields` os casos `annualrevenue`, `hs_arr`, `total_score`, `total_cycles` e `total` (contador), além dos casos já cobertos.

Nada muda no que é gravado: o valor continua numérico; a mudança é de exibição/edição (usa o `CurrencyInput` já existente).

## Detalhes técnicos

- Edição principal: `src/lib/format/money-fields.ts` (normalização da chave + lista de exceções); teste unitário correspondente.
- Rótulo: `src/lib/entity-fields.functions.ts` (mapa de labels), sem alterar `inferType` além do que já classifica `currency`.
- Blocos já salvos com `type: "number"` continuam funcionando: `qualification-entity-fields.tsx` já aplica o fallback por convenção de nome, então não é necessário migrar `field_layout`.
- Sem alteração de schema, RLS, permissões ou regras de negócio.

## Como validar

1. Em um Lead, mover a fase para Qualificado.
2. No bloco "Dados da Empresa", o campo "Receita anual" deve exibir e aceitar máscara `R$` alinhada à direita.
3. Salvar e reabrir: o valor persiste como número e volta formatado.
