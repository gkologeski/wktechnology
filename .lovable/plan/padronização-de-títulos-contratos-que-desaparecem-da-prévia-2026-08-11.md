# Padronização de títulos: contratos que desaparecem da prévia

## O que está acontecendo (verificado no banco)

Nos 13 contratos ativos, a prévia mostra 7 com alteração e simplesmente **omite os outros 6**, sem dizer o motivo. Dois deles precisavam de padronização e ficaram invisíveis:

- `CONTRATO DE PRESTAÇÃO DE SERVIÇOS N.: 20251030-161424615 - OUTSOURCING` — é de prestação, mas o nome da CONTRATANTE extraído é a nossa própria empresa (GM Kologeski), então CONTRATANTE e CONTRATADA saem iguais e o cálculo devolve "sem título".
- `TERMO DE ADITIVO CONTRATUAL` — é aditivo de compra, mas não tem nenhum nome de CONTRATANTE gravado (sem entidade legal vinculada e sem nome extraído), então também devolve "sem título".

Os outros 4 omitidos já estão com o título correto — é esperado que não apareçam, mas hoje não há como o usuário saber a diferença entre "já está certo" e "não consegui calcular".

A lista da prévia também rola dentro do modal (por isso o print mostra 4 dos 7); vamos deixar a rolagem e a contagem mais evidentes.

## O que será feito

1. **Melhorar a resolução das partes** (sem mudar o padrão de nomenclatura):
   - Reconhecer os nomes das nossas entidades legais do workspace: o lado que é nosso vira CONTRATADA em prestação e CONTRATANTE em compra, mesmo quando a extração inverteu os nomes.
   - Quando falta um dos lados, herdar as partes do contrato principal (caso dos aditivos) e, em último caso, usar a entidade legal padrão do workspace.
   - Nunca mais cair no caso "CONTRATANTE igual à CONTRATADA" por causa de nome repetido nos metadados.

2. **Nada mais é omitido em silêncio**: a prévia passa a devolver também os contratos analisados sem alteração, separados em dois grupos visíveis no modal:
   - "Já padronizados" (contagem, expansível);
   - "Não foi possível calcular" — com o título atual, o motivo (ex.: "faltam as partes do contrato", "sem contrato principal vinculado") e link para abrir o contrato e corrigir.
     Só o grupo com alteração continua selecionável para gravar.

3. **Contagem e rolagem mais claras**: resumo "X analisados · Y com alteração · Z já padronizados · W sem cálculo" e a lista com altura/rolagem própria, deixando explícito quando há mais itens abaixo.

## Detalhes técnicos

- `src/lib/contracts/title.ts`: em `resolveContractParties`, adicionar reconhecimento de nomes próprios (lista de entidades legais recebida via `ownNames`), desempate por papel e correção do caso `contracting === contracted`; `buildContractTitle` passa a poder retornar o motivo do `null` (novo helper `buildContractTitleResult` retornando `{ title, reason }`, mantendo a assinatura atual para os chamadores existentes).
- `src/lib/contracts/title.server.ts`: `previewContractTitles` retorna `{ changes, unchanged, skipped }`; carregar as entidades legais do workspace uma vez e, para `document_kind = 'amendment'`, buscar as partes do `parent_contract_id`. `applyContractTitles` segue gravando apenas `changes`.
- `src/lib/contracts.functions.ts`: `standardizeContractTitles` e `standardizeContractTitlesByStatus` repassam `unchanged`/`skipped` na prévia (retorno aditivo, sem quebrar chamadores).
- `src/components/contracts/contract-titles-standardize-dialog.tsx`: novos blocos de "Já padronizados" e "Não foi possível calcular" (tokens semânticos, `EmptyState`/badges existentes, foco visível, aria-labels), resumo de contagens e ajuste da `ScrollArea`.
- Testes em `src/lib/contracts/__tests__`: casos de nome próprio invertido, aditivo herdando partes do principal, e motivo retornado quando faltam partes.
- Sem migration, sem mudança de RLS/permissões: continua exigindo permissão de update de contrato no servidor.
- Validações: `bunx vitest run`, typecheck e lint.
