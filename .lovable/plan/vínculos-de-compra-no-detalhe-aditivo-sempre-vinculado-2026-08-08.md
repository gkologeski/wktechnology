# Vínculos de compra no detalhe + aditivo sempre vinculado

Três ajustes no módulo de Contratos, todos na camada de apresentação e nas regras de vínculo já existentes.

## 1. Controle de aninhar/desaninhar no detalhe do contrato principal

No detalhe do contrato de prestação já existe o card "Outsourcing — contratos de compra vinculados", com métricas de margem, lista dos contratos de compra e ação de remover vínculo. O que muda:

- O botão de vincular passa a se chamar **Aninhar contrato de compra** e a ação por linha passa a **Desaninhar** (hoje "Remover vínculo"), com a confirmação reescrita no mesmo vocabulário.
- Cada linha ganha o badge **Aninhado** (mesmo badge "Compra" usado na grid), deixando explícito que aquele contrato aparece indentado sob este em `/contracts`.
- Texto de apoio do card e o estado vazio passam a explicar que contratos aninhados aparecem indentados sob o contrato de prestação na listagem.
- No detalhe do contrato de compra, o card do contrato principal usa os mesmos rótulos (Aninhar sob outro contrato / Desaninhar).

Nada muda no dado: continua sendo o mesmo vínculo (`parent_contract_id`) usado pela grid.

## 2. Card com os contratos de compra aninhados

O card acima é exatamente esse card e já lista os contratos de compra. Complementos:

- Mostrar também **vigência** (início/fim) e a **empresa** de cada contrato de compra na linha, além de número, status e valor.
- Ordenar por vigência e mostrar contador ("3 contratos aninhados") no cabeçalho.
- Manter loading/empty/error e o botão de desaninhar desabilitado com tooltip quando o usuário não tem permissão de atualizar contrato.

## 3. Aditivo obrigatoriamente vinculado

Situação atual verificada no banco: o aditivo `ADT 2 CPS CITEL ... X WK TECHNOLOGY` já tem contrato principal (`amendment_of_id` preenchido), mas aparece em `/contracts/links` porque a fila só considera o vínculo de compra (`parent_contract_id`) e cobra "sem contrato de compra vinculado" de qualquer contrato de prestação — inclusive de aditivos, que não têm contrato de compra próprio.

Mudanças:

- **Correção da fila**: aditivos (tipo de documento = Aditivo) deixam de ser cobrados pela pendência de contrato de compra. O aditivo herda o vínculo do contrato principal.
- **Nova pendência própria**: aditivo **sem** contrato principal entra na fila com o motivo "Aditivo sem contrato principal", com ação de escolher o contrato principal ali mesmo (mesmo seletor usado na importação em massa). A badge de pendências passa a contar esses casos.
- **Bloqueio no formulário**: ao criar ou editar um contrato marcado como Aditivo, o contrato principal passa a ser obrigatório — validação na tela (campo obrigatório, botão de salvar bloqueado com mensagem) e também no servidor, para não depender só da UI.
- Filtro da fila ganha a opção "Aditivos" ao lado de Prestação/Compra.

## Detalhes técnicos

- `src/lib/contracts/pending-link.ts`: `PendingLinkSource` passa a incluir `document_kind` e `amendment_of_id`; regra nova — `document_kind === 'amendment' && !amendment_of_id` → pendência de aditivo; aditivos com pai são ignorados na regra de `provider`/`client`. Testes unitários do módulo cobrindo os três casos.
- `src/lib/contracts/import.functions.ts`: `listContractsPendingLink` e `countContractsPendingLink` passam a selecionar as duas colunas novas; filtro `role` aceita `amendment`.
- `src/routes/_authenticated/contracts.links.tsx`: chip de filtro "Aditivos", coluna de motivo já existente, e ação de vínculo usando `linkContractAmendment` quando a linha é aditivo (em vez de `setContractLink`).
- `src/lib/contracts.functions.ts`: `updateContract`/criação validam `document_kind === 'amendment' → amendment_of_id` obrigatório (erro claro em PT-BR). Sem alteração de RLS, grants ou schema.
- `src/components/contracts/contract-parent-link.tsx`: rótulos, badge "Aninhado", colunas extras na linha e `useCanDelete`/permissão de update para desabilitar a ação.
- `src/components/contracts/quick-create-contract-dialog.tsx` e o formulário de detalhe: contrato principal obrigatório quando o tipo é Aditivo.
- Validação: `tsgo`, lint e os testes de `pending-link`; conferência manual em `/contracts/links` (o aditivo atual deve sair da fila).
