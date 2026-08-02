# Contrato principal: busca por empresa com lista lateral de contratos

## Objetivo

No passo de workflow que cria/atualiza um contrato, o campo **Contrato principal (aditivo/renovação)** deixa de ser uma lista solta de contratos e passa a funcionar em dois estágios:

1. o usuário digita o nome de uma **empresa** e vê os resultados;
2. ao clicar na empresa, abre-se **lateralmente** a lista de contratos daquela empresa;
3. ao manter o mouse **2 segundos** sobre um contrato, aparece um quadro flutuante com **período de vigência** e **valor**, com fundo em transparência de 80%.

Selecionar o contrato grava o `id` no campo, como hoje.

## Comportamento detalhado

- Painel esquerdo: campo de busca de empresa (mesma busca já usada nos campos de empresa), com carregando/vazio/erro.
- Painel direito: contratos da empresa selecionada (contraparte), ordenados do mais recente para o mais antigo, mostrando número e título, e uma linha secundária com status.
- Sem empresa selecionada, o painel direito mostra a orientação "Selecione uma empresa para ver os contratos".
- Empresa sem contratos: estado vazio próprio.
- Hover de 2s sobre um item de contrato: quadro com "Vigência: dd/mm/aaaa – dd/mm/aaaa" (ou "sem data") e "Valor: R$ ..." (valor mensal quando houver, senão total). Sai do hover, o quadro fecha e o temporizador é cancelado.
- Contrato já selecionado continua exibindo o nome resolvido no botão (nunca UUID).
- A alternativa "Usar token…" continua disponível, sem mudança.
- Teclado: navegação por Tab/setas nas duas listas e foco visível; o quadro de detalhes também aparece ao focar o item (equivalente acessível ao hover).

## Detalhes técnicos

- `src/lib/workflow-refs.functions.ts`: estender `searchContracts` para aceitar `company_id` opcional (filtra `counterparty_company_id`) e retornar, além de `id`/`name`, os campos usados no quadro: `starts_at`, `ends_at`, `monthly_value`, `total_value`, `currency`, `status`. A hidratação por `ids` retorna os mesmos campos.
- `src/components/workflows/extra-fields-editor.tsx`: no `FkPicker`, quando `kind === "contract"`, renderizar um conteúdo de popover em duas colunas (empresa | contratos) em vez da lista única. Demais `kind`s permanecem inalterados.
- Novo componente `src/components/workflows/contract-parent-picker.tsx` com a UI de duas colunas e o card de hover (timer de 2s via `setTimeout`, limpo no unmount/leave). Sem acesso a dados dentro do componente apresentacional: as funções de busca são recebidas por props/hook já existente `useServerFn`.
- Transparência de 80%: fundo do card com token semântico + opacidade (ex.: `bg-popover/80` com `backdrop-blur-sm`), sem cor hardcoded.
- Responsivo: em telas estreitas as duas colunas empilham (busca de empresa acima, contratos abaixo).
- Sem alteração de schema, RLS, permissões ou regras de negócio; a listagem continua limitada pelas policies do usuário.

## Validação manual

1. `/settings/workflows` → passo "Criar registro" com tabela Contratos.
2. No campo Contrato principal, digitar o nome de uma empresa e clicar nela.
3. Conferir a lista lateral de contratos dessa empresa.
4. Parar o mouse 2s sobre um contrato e conferir o quadro com vigência e valor, translúcido.
5. Selecionar o contrato e confirmar que o botão mostra número/título (não UUID) e que o valor salvo é o `id`.
