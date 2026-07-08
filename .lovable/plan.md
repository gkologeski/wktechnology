## Objetivo
Permitir escolher entre desconto por percentual (%) ou por valor absoluto (moeda) em cada item de linha do modal de negócios.

## Mudanças

### 1. Banco (`deal_line_items`)
Migration aditiva:
- Nova coluna `discount_amount numeric NOT NULL DEFAULT 0` (valor absoluto por unidade, na moeda do negócio).
- Nova coluna `discount_type text NOT NULL DEFAULT 'pct'` com CHECK `IN ('pct','amount')`.
- Mantém `discount_pct` para retrocompatibilidade (não remove nada). Registros existentes ficam como `discount_type='pct'` usando `discount_pct` atual.
- Sem alterações em RLS/GRANT (colunas herdam da tabela).

### 2. Cálculo (`src/components/deals/deal-line-items.tsx`)
`lineTotal` e agregados (`subtotal`, `discount`, `total`) passam a considerar o tipo:
- `pct`: subtotal * (1 − discount_pct/100)
- `amount`: (unit_price − discount_amount) * quantity, com clamp em 0
- Imposto continua aplicado sobre o subtotal com desconto.

### 3. UI do item
Substituir o campo único "Desc %" por dois controles lado a lado:
- Um toggle compacto `%` / `R$` (`ToggleGroup` ou dois botões pequenos) que altera `discount_type`.
- Um input numérico cujo rótulo e formato mudam conforme o tipo:
  - `pct`: `LabeledNumber` (0–100).
  - `amount`: `CurrencyInput` na moeda do negócio.
- Ao trocar o tipo, mantém o outro valor zerado (não converte automaticamente).
- Layout do grid ajustado para caber Qtd / Preço / Desconto (tipo+valor) / Imposto sem quebrar em telas menores.

### 4. Persistência
`update()` aceita e envia `discount_type`, `discount_amount`, `discount_pct` conforme edição. Inserts novos (produto e em branco) definem `discount_type: 'pct'`, `discount_amount: 0`, `discount_pct: 0`.

## Fora do escopo
- Desconto no cabeçalho da proposta (permanece apenas por item).
- Alterar tela de propostas/impressão (será feito em tarefa dedicada se necessário).
- Migrar dados históricos entre pct/amount.

## Validação
- `bunx tsgo --noEmit`.
- Manual: adicionar item, alternar entre % e R$, verificar total, subtotal e "Descontos" agregando corretamente; recarregar modal e conferir persistência.