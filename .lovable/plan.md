# Permitir campos de itens do negócio no passo "Ramificar por valor"

Confirmado: o seletor de campo do passo "Ramificar por valor" lista apenas as propriedades do próprio negócio. O grupo "Itens do negócio" (serviço, cargo/perfil, senioridade, preset, quantidade, valores, contagem) existe hoje só nas condições do gatilho/ramificação, por isso não aparece no switch.

## O que muda na tela

1. No campo "Campo" do passo Ramificar por valor, quando o gatilho é Negócios, passa a existir um segundo grupo "Itens do negócio" com os mesmos campos já disponíveis nas condições.
2. Escolhendo um campo de item (ex.: Serviço), o "Valor" de cada case usa o mesmo editor das condições: busca por nome para Serviço, número para quantidade/valores, texto com variáveis nos demais.
3. Com campo de item selecionado, aparece o seletor "Qualquer item / Todos os itens" (padrão: qualquer item), igual ao das condições, para deixar claro como o case é avaliado.
4. Cases já salvos continuam válidos; nada é apagado ao trocar o campo, apenas o valor incompatível é limpo.

## Detalhes técnicos

- `src/components/workflows/builder/step-forms/pickers.tsx` (`FieldSelect`): aceitar props opcionais para grupos extras de campos e renderizar `SelectGroup`/`SelectLabel` ("Propriedades" + "Itens do negócio"), reutilizando `LINE_ITEM_FIELDS` de `src/lib/workflows/line-items.ts` quando `entity === "deals"`. Sem mudança de comportamento para as outras entidades.
- `src/components/workflows/builder/step-forms/flow-forms.tsx` (`SwitchByValueForm`): resolver o `FieldOpt` do campo escolhido também entre os campos de item de linha (mapeando `label`/`type`/`ref: "service_catalog"` como em `conditions-editor.tsx`), alimentar o `FieldValueEditor` existente e expor o alternador `match` ("any" | "all") apenas para campos `line_items.*`.
- `src/lib/workflows/types.ts`: o `switch_by_value` passa a aceitar `match?: "any" | "all"` (opcional, default "any"), sem quebrar workflows publicados.
- `src/lib/workflows/engine.server.ts`: na avaliação do switch, quando `action.field` começa com `line_items.`, comparar usando os itens hidratados (`lineItemsOf`/`lineItemValue`) com a semântica any/all — mesma função já usada nos filtros; manter a hidratação condicional existente (`workflowUsesLineItems`) reconhecendo também o campo do switch.
- `src/components/workflows/builder/step-tree.ts` (`describeAction`): mostrar o rótulo amigável do campo de item no resumo do cartão.
- Sem alteração de schema, RLS, permissões ou regra de negócio.

## Validação

- `bun run typecheck`, `bun run lint`, `bun run test` (inclui testes de `line-items`), mais um teste novo para o switch com campo de item nos modos qualquer/todos.
- Manual em `/settings/workflows`: gatilho Negócios → passo "Ramificar por valor" → escolher "Serviço" em Itens do negócio → conferir busca por nome no valor do case e o alternador qualquer/todos.
