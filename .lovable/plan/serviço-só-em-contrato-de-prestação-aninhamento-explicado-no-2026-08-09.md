# Serviço só em contrato de prestação; aninhamento explicado no contrato de compra

Verificado no código: em `/contracts/{id}` o card "Serviços" é renderizado para qualquer contrato, inclusive os de Compra, e o botão "Associar serviço" fica ativo. No card de vínculos, contrato de Compra só mostra "contrato de venda vinculado" (escolher o pai) — não existe, por design, aninhar compra sob compra, mas a tela não explica isso.

## Regra a aplicar

Serviço pertence ao contrato de **prestação** (papel Prestação, ou seja, um dos nossos CNPJs é a CONTRATADA). Contrato de **compra** (nós somos CONTRATANTE do profissional) não recebe serviço: ele só é aninhado sob o contrato de prestação.

## O que muda na tela

Contrato de Compra:

- Card "Serviços" fica em modo somente leitura: continua listando serviços já existentes (nada é removido), sem o botão "Associar serviço", com nota explicando que serviços são associados ao contrato de prestação e link para o contrato pai quando existir.
- Card de vínculo ganha texto claro: um contrato de compra é aninhado **sob** um contrato de prestação e não aninha outros contratos de compra; o botão continua sendo "Aninhar sob contrato de prestação".

Contrato de Prestação: nada muda (associa serviço e aninha compras como hoje).

## Reforço no servidor

`linkCatalogServiceToContract` passa a rejeitar contrato com papel diferente de prestação, com mensagem em PT-BR ("Serviços só podem ser associados a contratos de prestação de serviços…"), para a regra não depender da UI.

## Detalhes técnicos

- `src/components/services/contract-services.tsx`: nova prop `canLink` (default `true`); quando falso, esconde o botão e mostra a nota/estado vazio explicativo.
- `src/routes/_authenticated/contracts.$id.tsx`: passa `canLink={role === "provider"}` e o pai (`parent`) para o texto do card.
- `src/components/contracts/contract-parent-link.tsx`: ajuste dos textos de apoio no `ClientView` (apresentação apenas).
- `src/lib/services.functions.ts`: validação de papel em `linkCatalogServiceToContract`.
- Sem alteração de schema, RLS, grants ou dados. Validações: `tsgo`, lint e testes existentes de serviços.
