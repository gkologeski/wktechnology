# Aditivos direto na Importação em Massa de contratos

Hoje o diálogo de importação em lote só permite escolher o tipo (Prestação / Compra / Detectar com IA). Todo arquivo entra como documento principal, e o vínculo de aditivo precisa ser feito depois, na tela de detalhes do contrato ou em `/contracts/links`.

A proposta é permitir marcar um arquivo como **Aditivo** e escolher o **contrato principal** na própria tela de importação.

## O que muda para o usuário

- Nova coluna "Documento" na grade de revisão, com duas opções: `Principal` (padrão) e `Aditivo`.
- Quando o arquivo é marcado como Aditivo, aparece na mesma linha:
  - busca do contrato principal (mesmo seletor já usado no painel de aditivos, com busca por número/título);
  - campos opcionais de número do aditivo e data de vigência (a IA preenche a data quando encontrar, sem sobrescrever o que o usuário digitou).
- O contrato principal pode ser um contrato já existente **ou** outro arquivo do mesmo lote marcado como Principal (aparece no seletor como "Neste lote"), sendo o vínculo feito depois que os dois rascunhos forem criados.
- Botão "Processar" fica bloqueado enquanto existir linha marcada como Aditivo sem contrato principal escolhido, com aviso claro na linha.
- Na conclusão, o status da linha informa "Aditivo vinculado a <contrato>" ou o erro de vinculação, sem invalidar a criação do rascunho.
- Linhas marcadas como Aditivo ficam fora da tentativa de vínculo automático compra ↔ prestação (esse pareamento só faz sentido entre documentos principais), e não entram na contagem de pendências dessa etapa.

## Detalhes técnicos

- `src/components/contracts/batch-import-contracts-dialog.tsx`
  - `QueueItem` recebe `docKind: "main" | "amendment"`, `mainContract: MainContractOption | null`, `mainFromKey?: string` (referência a outro item do lote), `amendmentNumber?: string`, `amendmentEffectiveAt?: string`, `linkMessage?: string`.
  - Grade ganha coluna "Documento" (Select) e bloco condicional com `MainContractPicker` + inputs (todos com `aria-label`, desabilitados durante processamento).
  - No `process()`: cria os rascunhos na ordem atual, resolve `mainFromKey` para o `contractId` já criado e, para cada item aditivo, chama `linkContractAmendment` com `amendmentId`, `mainContractId`, `amendmentNumber` e `effectiveAt`. Itens principais processam primeiro para que a referência interna ao lote já exista.
  - `linkImportedContracts` passa a receber apenas os ids dos itens principais.
- Reutiliza `MainContractPicker` (`src/components/contracts/main-contract-picker.tsx`) e `linkContractAmendment` / `searchMainContracts` (`src/lib/contracts.functions.ts`) — sem migration, sem mudança de schema, sem alteração de RLS ou de regras de permissão.
- `linkContractAmendment` já grava `document_kind`, `amendment_of_id`, `amendment_number`, `amendment_effective_at` e registra o evento de auditoria, então nenhuma nova server function é necessária.

## Fora do escopo

- Detecção automática por IA de que um documento é aditivo (o `metadata.referenced_contract_numbers` já extraído continua sendo usado apenas pelo vínculo manual em `/contracts/links`).
- Alterações na tela `/contracts/links` e no painel de aditivos da tela de detalhes.
