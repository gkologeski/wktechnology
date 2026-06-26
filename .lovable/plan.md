## Objetivo

Manter `deals.value` sincronizado automaticamente com a soma dos totais dos itens de linha do negócio.

## Comportamento

Total da linha = `quantity * unit_price * (1 - discount_pct/100) * (1 + tax_rate/100)` — mesma fórmula já usada no front (`lineTotal`).

`deals.value` é recalculado quando um item é inserido, atualizado ou removido:

- Há ≥1 item → `value = SUM(line_total)`.
- Não há itens → mantém o valor manual atual (não zera, evita apagar valor preenchido antes de cadastrar itens). Sem alteração quando o usuário edita `deals.value` diretamente.

`currency` do negócio não é alterado.

## Implementação (mínima e centralizada)

### 1. Migration — trigger no banco

`supabase/migrations/<timestamp>_deal_value_from_line_items.sql`:

- Função `public.recalc_deal_value(_deal_id uuid)` (`SECURITY DEFINER`, `search_path = public`):
  - Calcula `SUM(quantity * unit_price * (1 - coalesce(discount_pct,0)/100) * (1 + coalesce(tax_rate,0)/100))` da tabela `deal_line_items` para o `_deal_id`.
  - Se a soma for `NULL` (sem itens), retorna sem alterar `deals.value`.
  - Caso contrário, faz `UPDATE deals SET value = soma WHERE id = _deal_id` (apenas quando o valor mudou, para não disparar updates desnecessários).
- Trigger `trg_deal_line_items_recalc_value` em `deal_line_items` `AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW`:
  - Em INSERT/UPDATE → chama `recalc_deal_value(NEW.deal_id)`.
  - Em DELETE → chama `recalc_deal_value(OLD.deal_id)`.
  - Em UPDATE com mudança de `deal_id` → recalcula ambos.
- `GRANT EXECUTE ON FUNCTION public.recalc_deal_value(uuid) TO authenticated, service_role`.
- Backfill único ao final da migration: para todo deal com itens, aplicar o recálculo.

### 2. Front-end — refresh imediato

`src/components/deals/deal-line-items.tsx`: nos handlers `addBlank`, `addFromProduct`, `update`, `remove`, além das invalidações existentes, invalidar também o registro do deal para refletir o novo `value` sem reload:

- `qc.invalidateQueries({ queryKey: ["deal", dealId] })` (se a chave for outra, descobrir e usar a real do `deals.$id.tsx`).

Sem alterar UI/UX, sem mexer em RLS de `deals` (trigger é `SECURITY DEFINER`), sem alterar `currency`, server functions ou regras de cotação.

## Fora do escopo

- Não alterar fórmula de impostos/descontos.
- Não recalcular ao zerar itens (preserva valor manual).
- Não tocar em quotes / line_items de cotação.
- Não criar UI extra (somente refletir o valor).

## Validação manual

1. Deal com `value` manual = R$ 1.000 e sem itens → adicionar item R$ 500 → `value` exibido no header e cards passa a R$ 500.
2. Editar quantidade/preço/desconto/imposto do item → `value` recalcula automaticamente.
3. Excluir todos os itens → `value` permanece no último calculado (não zera).
4. Conferir backfill: deals existentes com itens passaram a refletir a soma.

## Risco

Baixo. Trigger isolado em `deal_line_items`; nenhuma mudança em RLS, schema de cotações ou regras de negócio existentes. Sobrescreve `deals.value` quando há itens — comportamento solicitado pelo usuário.
