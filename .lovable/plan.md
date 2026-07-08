## Contexto

Bug em `src/components/deals/deal-line-items.tsx` (dialog "Itens de linha" da proposta/negócio):

- Ao adicionar o **primeiro** item pelo catálogo, os campos (nome, preço, imposto) aparecem vazios/zerados.
- Ao editar imposto ou desconto do item recém-criado, o total continua 0.
- Fechar e reabrir o modal exibe os dados corretamente.

## Causa

Os inputs da linha usam estado local que só é inicializado uma vez:

- `LabeledNumber` (Qtd, Desc %, Imp %) usa `useState(String(value))` e nunca ressincroniza quando `value` muda vindo do React Query.
- O `Input` de nome usa `defaultValue={li.name}` (uncontrolled), então também congela o valor inicial.

Depois do `invalidateQueries`, o item já vem com `unit_price`/`tax_rate` do produto e o array `items` é substituído — mas como o `key={li.id}` é estável, o React reaproveita o mesmo `LabeledNumber`/`Input`, cujo estado interno guarda o valor "zero" original renderizado no primeiro paint (antes do refetch completar). O `CurrencyInput` sincroniza via `useEffect` no `value`, por isso ele até atualiza — mas Qtd/Desc/Imp/nome não. Como Qtd fica travado em `1` e imposto/desconto travam no valor antigo, o total derivado usa os valores errados. Reabrir o modal remonta tudo com o estado do servidor, o que explica por que o dado só aparece após sair e entrar.

## Escopo

- Somente `src/components/deals/deal-line-items.tsx` (UI/frontend).
- Não altera schema, RLS, server functions, catálogo de produtos, `deal_line_items` insert/update ou o fluxo de invalidação.

## Plano

1. **`LabeledNumber` — sincronizar com prop `value`.**
   - Manter estado local `v` apenas enquanto o input estiver focado.
   - Adicionar `useEffect` que, quando `!focused`, faz `setV(String(value))` sempre que `value` mudar.
   - Ajustar `onFocus`/`onBlur` para controlar `focused` e continuar chamando `onCommit` só quando o valor mudou.

2. **Campo "Nome do item" — trocar `defaultValue` por controlled com o mesmo padrão de `LabeledNumber`.**
   - Estado local sincronizado com `li.name` quando não estiver focado.
   - Commit no `onBlur` só se diferente do valor atual.

3. **Manter comportamento existente:**
   - `key={li.id}` continua no wrapper (não em cada input).
   - `CurrencyInput` já é controlado — sem mudanças.
   - Totais (subtotal/descontos/impostos/total) continuam derivados de `items` da query — passarão a refletir imediatamente os valores corretos do produto após o refetch.

4. **Validação:**
   - `bunx tsgo --noEmit`.
   - Teste manual: abrir dialog de itens de linha em um deal, adicionar produto do catálogo, verificar que nome/preço/imposto aparecem imediatamente e que o total é recalculado ao editar Desc %/Imp %.

## Fora do escopo

- Migrar `deal-line-items.tsx` para server functions ou tipos gerados (mantém `(supabase as any)` atual).
- Alterar `EntityCombobox`, `CurrencyInput` ou o layout do dialog.
- Ajustes em quotes/propostas assinadas (`ats_offers`, `esign_documents`) ou no `settings.quotes`.
