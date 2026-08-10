# Aditivos identificados como contrato comum na importação

## O que está acontecendo

O contrato `C-202608-4885` ("CC CMK KOLOGESKI X ANDRE LUIS DA SILVEIRA") está gravado com **tipo de documento = Principal**, mesmo sendo um termo aditivo. Confirmado no banco: `document_kind = 'main'`, `parent_contract_id = null`, e o próprio aviso da importação registra "O contrato original não foi fornecido, apenas o termo aditivo".

Causa: a extração por IA na importação **não retorna o tipo de documento**. Hoje "Aditivo" só é definido manualmente no seletor da importação em massa; quem não marca, entra como Principal. A tela de padronização de títulos está correta — ela usa `document_kind`, então um aditivo salvo como principal vira `[COMPRA]` em vez de `[ADITIVO N] [COMPRA]`.

Levantamento atual: 157 contratos, apenas 1 marcado como aditivo e **58 com sinais de aditivo** no título ou nos metadados.

## O que será feito

1. **Detecção na importação (IA)**
   - A extração passa a retornar tipo do documento (principal ou aditivo), número do aditivo e o contrato/número que ele altera, com o prompt orientado a reconhecer "termo aditivo", "primeiro/segundo aditivo", "ADT", etc.
   - Ao criar o contrato, o `document_kind`, `amendment_number` e a data de vigência do aditivo são gravados, e o título já sai como `[ADITIVO N] [PRESTAÇÃO/COMPRA] ...`.
   - Na importação em massa, o seletor de tipo já vem pré-selecionado com o que a IA detectou (o usuário continua podendo trocar), e o campo de contrato principal aparece automaticamente para os detectados como aditivo.

2. **Correção retroativa, com revisão humana**
   - Nova ação em `/contracts` (junto de "Padronizar títulos" e "Recalcular papéis"): **"Revisar tipo de documento"**.
   - Lista os contratos que parecem aditivo mas estão como Principal, mostrando a evidência (título, avisos da importação, número citado) e uma sugestão de contrato principal (mesma contraparte e mesmo papel).
   - Item a item o usuário confirma; ao aplicar, o contrato vira aditivo, é vinculado ao principal escolhido e o título é regravado. Nada muda sem confirmação, e todo aditivo continua obrigado a ter contrato principal.
   - Cada correção fica registrada no histórico do contrato (quem fez e quando).

3. **Padronização de títulos**
   - No diálogo de padronização, contratos suspeitos de serem aditivo ganham um aviso ("Parece aditivo — revisar tipo") com atalho para a revisão acima, para o usuário não gravar `[COMPRA]` num aditivo.

4. **Este contrato específico** ficará corrigido pela revisão em lote (ou manualmente no detalhe, no campo Tipo de documento + contrato principal, que já existe).

## Detalhes técnicos

- `src/lib/contracts/import-schemas.ts`: adicionar `document_kind` (`main` | `amendment`), `amendment_number`, `amends_contract_number` ao `ExtractedContractSchema`.
- `src/lib/contracts/import.functions.ts`: incluir os campos no prompt de extração; em `createContractFromImport`, gravar `document_kind`/`amendment_number` e passar `documentKind`/`amendmentNumber` para `buildContractTitle`.
- `src/components/contracts/batch-import-contracts-dialog.tsx`: inicializar `docKind`/`amendmentNumber` a partir do extraído.
- Novo `src/lib/contracts/doc-kind-review.server.ts` + server fn em `src/lib/contracts/role-recalc.functions.ts` (ou arquivo irmão `doc-kind.functions.ts`): diagnóstico (heurística sobre `title`, `metadata.import_warnings`, `metadata.referenced_contract_numbers`) e aplicação usando o fluxo de vínculo de aditivo já existente (`linkAmendment`), com evento em `contract_events` (`document_kind_corrected`).
- Novo `src/components/contracts/contract-doc-kind-review-dialog.tsx` seguindo o padrão do `contract-roles-recalc-dialog.tsx` (loading/empty/error, seleção item a item, tokens semânticos).
- `src/routes/_authenticated/contracts.index.tsx`: botão da nova revisão; `contract-titles-standardize-dialog.tsx`: badge de aviso.
- Sem mudanças de schema, RLS ou permissões: reaproveita as permissões de update de contrato já validadas no servidor.
- Validações: `vitest run` (títulos + nova heurística), typecheck, lint e build.
