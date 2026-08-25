# Regras de aninhamento: prestação x compra

Verificado no código: hoje a UI já direciona o comportamento (contrato de prestação mostra "Contratos de compra aninhados"; contrato de compra mostra o pai de prestação; o painel de aditivos aparece para os dois papéis), mas o servidor não valida nada disso. `linkContractParent` só impede aninhar em si mesmo — aceitaria vincular compra sob compra, prestação sob prestação, ou usar um aditivo como pai. `linkContractAmendment` também não valida papel nem se o "principal" é ele mesmo um aditivo.

## Regra a aplicar

- Contrato de **prestação** (`role = provider`): pode ter contratos de **compra** aninhados e **aditivos** vinculados.
- Contrato de **compra** (`role = client`): pode ter apenas **aditivos** vinculados; nunca outro contrato de compra nem um contrato de prestação aninhado sob ele.
- Aditivo (`document_kind = amendment`) nunca é pai de aninhamento nem principal de outro aditivo.
- Aditivo é sempre do **mesmo papel** do contrato principal.

## Reforço no servidor (fonte da verdade)

`linkContractParent`: ao vincular, ler papel/tipo de documento do filho e do pai e recusar com mensagens em PT-BR quando:

- o pai não for contrato de prestação → "Somente contratos de prestação podem receber contratos de compra aninhados.";
- o filho não for contrato de compra → "Apenas contratos de compra podem ser aninhados sob um contrato de prestação.";
- pai ou filho for aditivo → "Aditivos não participam do aninhamento prestação/compra; use o vínculo de aditivo.";
- o pai já tiver um pai (evita cadeia) → mensagem explicando que o aninhamento é de um nível.

`linkContractAmendment`: recusar quando o contrato principal informado for um aditivo ("Um aditivo não pode ser o contrato principal de outro aditivo.") ou tiver papel diferente do aditivo ("O aditivo deve ter o mesmo papel do contrato principal.").

Desvincular (parentId/mainContractId nulos) continua sempre permitido.

## O que muda na tela

- Contrato de compra: o card de vínculo passa a deixar explícito que ele só aninha **aditivos**, e que contratos de compra são aninhados sob um contrato de prestação (ajuste de texto de apoio, sem mudar controles).
- Contrato de prestação: subtítulo do card de compras aninhadas menciona também que aditivos ficam no card de aditivos.
- Seletores: `listLinkableContracts` (usado ao escolher o pai/filho) passa a excluir aditivos e contratos que já sejam pai/filho inválido; `MainContractPicker` filtra pelo mesmo papel do aditivo e exclui aditivos.

Nada é removido: vínculos já existentes que violem a regra continuam visíveis (com o botão de desaninhar disponível) — apenas novas gravações passam a ser bloqueadas.

## Detalhes técnicos

- `src/lib/contracts.functions.ts`: validações em `linkContractParent` e `linkContractAmendment` (uma leitura extra dos dois contratos antes do update); filtros `document_kind = main` / papel em `listLinkableContracts`.
- `src/components/contracts/contract-parent-link.tsx`: textos de apoio (`ProviderView` e `ClientView`) e passagem do filtro ao `LinkPickerDialog`.
- `src/components/contracts/main-contract-picker.tsx` / `contract-amendments-panel.tsx`: repassar papel do contrato atual para o filtro do seletor.
- Sem alteração de schema, RLS, grants ou dados.
- Validação: `tsgo`, lint e testes existentes de contratos; teste manual em `/contracts/{id}` nos dois papéis.
