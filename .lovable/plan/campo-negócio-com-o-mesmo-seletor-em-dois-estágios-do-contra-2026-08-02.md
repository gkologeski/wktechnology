# Campo "Negócio" com o mesmo seletor em dois estágios do "Contrato principal"

## Situação atual

No construtor de workflows, `deal_id` ("Negócio") não é tratado como campo de referência: ele cai no input de texto/token, então o usuário precisa digitar ou colar um ID. O `parent_contract_id` já usa o seletor em duas colunas (empresa → contratos, com card de detalhe após 2s).

## O que será feito

O campo "Negócio" passa a funcionar igual ao "Contrato principal":

1. Coluna esquerda: busca de empresa por nome.
2. Coluna direita: negócios daquela empresa, mostrando nome e etapa.
3. Ao manter o mouse (ou foco) 2s sobre um negócio, abre abaixo do nome um card translúcido (80% + desfoque) com valor, etapa e previsão de fechamento.
4. Clicar no negócio grava o ID e o botão passa a exibir o nome — nunca o hash.
5. A alternativa "Usar token…" continua disponível, como nos outros campos de referência.

## Detalhes técnicos

- `src/lib/entity-fields-refs.ts`: novo `RefKind` `"deal"`, com `deal_id` mapeado para ele.
- `src/lib/workflow-refs.functions.ts`: nova server function `searchDeals` (autenticada, RLS do usuário), aceitando `q`, `ids` e `company_id`, retornando `id`, `name`, `stage`, `value`, `currency`, `expected_close_date`.
- `src/components/workflows/contract-parent-picker.tsx`: generalizar o componente para receber o tipo (`contract` | `deal`), a função de busca e o formato do card de detalhe, mantendo o layout de duas colunas, o atraso de 2s e o card em fluxo abaixo do item.
- `src/components/workflows/extra-fields-editor.tsx`: `kind === "deal"` usa o mesmo popover largo e o mesmo seletor; hidratar o rótulo pelo ID selecionado (como já é feito para contrato e empresa contratante).
- Etapas do negócio exibidas em PT-BR reaproveitando os rótulos já existentes do domínio de negócios; sem inventar valores novos.
- Sem alteração de schema, RLS, autenticação ou regra de negócio.

## Validação manual

1. `/settings/workflows` → passo "Criar registro" → tabela Contratos.
2. No campo "Negócio", buscar uma empresa e clicar nela.
3. Conferir a lista de negócios daquela empresa com etapa em PT-BR.
4. Parar o mouse 2s sobre um negócio e conferir o card com valor, etapa e previsão.
5. Selecionar e conferir que o botão mostra o nome do negócio.
6. Testar "Usar token…" e o retorno para a lista; conferir light/dark mode e navegação por teclado.
