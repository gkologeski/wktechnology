# Importação múltipla de contratos + vínculo prestação/compra em pessoas

## Objetivo

1. Em `/contracts`, "Importar contrato" passa a aceitar **vários arquivos** de uma vez.
2. Uma **tela intermediária em grid** lista os arquivos escolhidos, permite adicionar mais arquivos, remover, ajustar tipo (Prestação/Compra) e só então um botão **Processar** dispara toda a extração por IA.
3. O sistema identifica automaticamente se cada contrato é de **prestação** (nossa empresa é a contratada) ou **compra** (nossa empresa é a contratante) e **vincula** contratos entre si quando o contrato de compra citar o número do contrato de prestação.
4. Em TechPeople, a alocação da pessoa passa a permitir vincular **dois contratos**: o de prestação (cliente final) e o de compra (fornecedor/PJ).

## Fase 1 — Wizard de importação em lote

Novo fluxo em 3 etapas dentro do diálogo de importação:

```text
[1] Escolher arquivos (múltiplos, drag & drop)
        ↓
[2] Grid de contratos
    arquivo | tipo detectado/manual | status | progresso | ações
    + Adicionar mais arquivos      [Processar N contratos]
        ↓
[3] Resultado
    N criados como rascunho · M vínculos identificados · falhas listadas
```

Regras da etapa 2:

- Grid com seleção (checkbox), coluna de tipo (Prestação / Compra / Detectar automaticamente), remoção individual e adição incremental de arquivos.
- Nada é processado antes do clique em **Processar**.
- Processamento sequencial com limite de concorrência baixo (2 por vez) para não estourar o limite da IA; cada linha mostra seu próprio estado (na fila, extraindo, criado, erro) e é possível reprocessar só as linhas com erro.
- Limites atuais preservados: `.pdf` até 15 MB, `.docx` até 10 MB.
- Ao final, cada contrato é criado como **rascunho**, como já acontece hoje na importação individual (revisão humana continua obrigatória).

## Fase 2 — Detecção de tipo e vínculo entre contratos

- O prompt de extração passa a devolver, além dos campos atuais, os números de contrato citados no documento (ex.: "em referência ao contrato nº C-2026-0031") e o número do próprio contrato quando presente.
- Depois de criar os contratos do lote, uma etapa de vinculação:
  1. tenta casar o número citado com um contrato de prestação **do mesmo lote**;
  2. se não achar, procura entre os contratos já existentes no workspace;
  3. quando encontra, grava o vínculo no contrato de compra usando o campo já existente `parent_contract_id`.
- Quando o número citado não casar com nenhum contrato, o contrato não é vinculado automaticamente: fica marcado como **pendente de vinculação** e aparece na nova aba manual (abaixo), com o aviso do número citado.
- A classificação prestação/compra segue o campo `role` já existente (`provider` = prestação, `client` = compra); escolha manual no grid sempre vence a detecção da IA.

## Fase 2b — Aba "Vinculação de contratos" (manual)

- Nova aba/visão em `/contracts` listando os contratos **pendentes de vinculação**: contratos de compra sem `parent_contract_id` e contratos de prestação sem contrato de compra associado.
- Cada linha mostra número, título, empresa, CNPJ do contratante extraído, número citado no documento (quando houver) e o motivo da pendência ("nº citado não encontrado", "nenhum número citado").
- Ação por linha: seletor de busca do contrato contraparte (filtrado pelo tipo oposto, com busca por número/título/empresa) e botão para confirmar o vínculo; também é possível marcar como "sem vínculo" para sair da fila.
- Sugestões automáticas na própria linha quando houver candidatos prováveis (mesma empresa/CNPJ ou período compatível), sempre exigindo confirmação humana.
- Contadores no cabeçalho e link direto da tela de resultado da importação para essa aba.

## Fase 3 — Contratos de prestação e compra em pessoas

- A alocação da pessoa hoje guarda **um** contrato. Passa a guardar dois: contrato de prestação e contrato de compra.
- Regra de elegibilidade: o seletor de contrato de compra em TechPeople oferece apenas contratos cujo **CONTRATANTE é um CNPJ cadastrado nas entidades legais do workspace** — são os contratos em que compramos mão de obra de prestadores, que é justamente o que o TechPeople administra. Contratos de compra cujo contratante não é CNPJ do workspace não aparecem.
- A comparação usa o CNPJ do contratante extraído na importação (e o campo de entidade legal contratante do contrato quando já preenchido), normalizado para 14 dígitos, contra os CNPJs das entidades legais do workspace.
- Durante a importação, contratos de compra com contratante = CNPJ do workspace já são marcados como elegíveis para TechPeople, para facilitar a associação.
- No painel de Alocação, dois seletores separados e rotulados (Prestação / Compra), com busca por número/título/empresa.
- A listagem de alocações mostra os dois contratos quando existirem.
- Compatibilidade: alocações existentes continuam funcionando — o contrato atual é tratado como o contrato de prestação e nada é apagado.
- As sugestões de cargo/senioridade já existentes continuam saindo do contrato de prestação.

## Detalhes técnicos

- `src/components/contracts/import-contract-file-dialog.tsx`: refatorado para fila de arquivos (`upload → grid → result`), reaproveitando `import-progress.ts` por item. A revisão campo a campo do fluxo individual é preservada quando o lote tem apenas 1 arquivo.
- `src/lib/contracts/import-schemas.ts`: acrescenta `self_contract_number` e `referenced_contract_numbers: string[]` ao `ExtractedContractSchema` (ambos opcionais/nullable).
- `src/lib/contracts/import.functions.ts`: prompt atualizado; nova server fn `linkImportedContracts` que resolve os números citados e grava `parent_contract_id`, com `assertAnyPermission` de update de contrato e escopo por workspace; nova server fn `listContractsPendingLink` para a aba manual e `setContractLink` para confirmar/limpar vínculo.
- Aba manual: nova rota `/contracts/links` (ou aba na tela de contratos) usando `PageHeader`, `FilterBar`, `DataTable`, `EmptyState`, `LoadingSkeleton` e `ErrorState` do design system.
- Elegibilidade TechPeople: consulta a `public.legal_entities` do workspace para obter os CNPJs próprios; filtro aplicado no servidor (nova opção `contracting_is_own_entity` em `listContracts` ou fn dedicada), nunca só na UI.
- Migration: adiciona `purchase_contract_id uuid references public.contracts(id)` em `public.people_allocations` (aditiva, nullable); `contract_id` continua sendo o contrato de prestação. Índice em `purchase_contract_id`. RLS atual da tabela é mantida.
- `src/lib/people/allocations.functions.ts`: schema e `upsertAllocation` aceitam `purchase_contract_id`; leituras retornam número/título dos dois contratos.

- `src/components/people/allocations-panel.tsx`: dois `ContractSelect` filtrados por `role`.
- Sem alteração de autenticação, RBAC existente, ou regras de negócio fora deste escopo.

## Validação

- `tsgo` + lint nos arquivos alterados.
- Teste manual: importar 3 arquivos (2 prestação + 1 compra citando o número de um deles), conferir grid, processar, verificar rascunhos criados, vínculo em `parent_contract_id` e avisos; em uma pessoa, salvar alocação com os dois contratos e reabrir para conferir persistência.
