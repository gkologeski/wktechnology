## Plano

Corrigir o modal de **Itens de linha** para que selecionar produto, digitar nome, alterar quantidade, desconto, imposto ou preço não “zere” a interface nem perca os dados carregados.

### 1. Atualização otimista dos itens no cache
- Em `src/components/deals/deal-line-items.tsx`, após inserir item do catálogo ou item em branco, atualizar imediatamente o cache `deal_line_items` com o item retornado pelo banco.
- Trocar os inserts para usar `.select("*").single()` para ter o registro completo recém-criado, incluindo nome, preço, imposto e id.
- Evitar depender apenas de `invalidateQueries`, que hoje causa um intervalo onde o modal renderiza estado vazio/zerado.

### 2. Patches otimistas ao editar campos
- Ao editar nome, quantidade, preço, desconto ou imposto, aplicar o patch no cache local antes/junto da persistência.
- Manter o refetch em background para confirmar o estado final, mas sem desmontar/limpar visualmente os campos durante a digitação.
- Em caso de erro, exibir toast e refazer a query para voltar ao dado real.

### 3. Evitar reset desnecessário da combobox do catálogo
- Separar a ação de adicionar produto da renderização do formulário para impedir que a seleção no catálogo reinicialize os campos da linha recém-criada.
- Manter o `EntityCombobox` sem valor selecionado depois da inserção, mas sem interferir nos itens já exibidos.

### 4. Preservar inputs controlados já corrigidos
- Manter `LabeledNumber` e `TextField` sincronizados com `value` quando não estão focados.
- Ajustar `TextField` para só chamar `onCommit` quando o texto realmente mudou, evitando updates/refetchs redundantes.

### 5. Validação
- Rodar verificação TypeScript.
- Teste manual no fluxo atual: abrir negócio, abrir modal de itens, adicionar primeiro produto do catálogo, confirmar que nome/preço/imposto aparecem imediatamente e que editar imposto/desconto recalcula o total sem zerar o modal.

### Fora do escopo
- Não alterar schema, RLS, regras de negócio, catálogo de produtos, propostas/cotações ou layout geral do modal.