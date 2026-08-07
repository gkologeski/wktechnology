# Contratos: grid editável, importação sem limite e aditivos

Três ajustes no módulo de Contratos.

## 1. Grid de /contracts com seleção e alteração

Hoje `ContractsTable` só mostra dados e links — não há checkbox nem edição. Vamos alinhar com o padrão já usado na grid de Empresas:

- Coluna de seleção (checkbox no cabeçalho + por linha), com contador "N selecionado(s)".
- Barra de ações em lote para os selecionados: alterar **status**, alterar **responsável** e **excluir** (respeitando as permissões atuais de exclusão; botão desabilitado com tooltip quando não permitido).
- Edição inline direto na linha para os campos seguros: **status**, **responsável**, **vigência (início/fim)** e **valor total**. Salvamento imediato com feedback (toast) e atualização da lista.
- A seleção funciona igual na visão plana e nas visões agrupadas (empresa/serviço/cargo/senioridade), compartilhando o mesmo estado.

Nada de mudança em regras de negócio: as gravações usam a função de atualização de contrato já existente, que continua validando permissão e workspace.

## 2. Importação em massa sem limite de arquivos

- Remover o limite de 20 arquivos por lote no diálogo de Importação em Massa.
- Manter os limites por arquivo (PDF até 15 MB, DOCX até 10 MB) e processar em fila com concorrência controlada, para não sobrecarregar a IA nem o navegador.
- Barra de progresso passa a mostrar "X de N" sem teto, com possibilidade de cancelar o restante da fila.

## 3. Aditivos vinculados ao contrato principal

Hoje o campo de vínculo existente (`parent_contract_id`) é usado para o pareamento Prestação/Compra (outsourcing), então aditivo precisa de um vínculo próprio para não misturar os dois conceitos.

- Novos campos em contratos: tipo de documento (**Principal** ou **Aditivo**), contrato principal do aditivo, número do aditivo e data de vigência do aditivo.
- Na tela de detalhe do contrato principal: card **Aditivos** listando os aditivos (número, título, vigência, valor, status), com ação para vincular um contrato existente como aditivo ou desvincular.
- No detalhe de um aditivo: indicação clara do contrato principal, com link.
- Na grid: badge "Aditivo" e, por padrão, aditivos aparecem agrupados sob o contrato principal (com filtro para exibir todos separadamente).
- Na Importação em Massa e no vínculo manual (/contracts/links): opção de marcar o documento importado como aditivo e escolher o contrato principal.

## Detalhes técnicos

- Migration em `public.contracts`: `document_kind text not null default 'main' check (document_kind in ('main','amendment'))`, `amendment_of_id uuid references public.contracts(id) on delete set null`, `amendment_number text`, `amendment_effective_at date`, + índice em `amendment_of_id`. Sem alterar RLS/grants existentes.
- `src/lib/contracts.functions.ts`: estender `updateContract` para os novos campos, adicionar `linkContractAmendment` / `unlinkContractAmendment` e incluir os campos em `listContracts` e no detalhe.
- `src/components/contracts/contracts-grouped-list.tsx`: props de seleção (`selectedIds`, `onToggle`, `onToggleAll`) e células editáveis; estado de seleção fica em `src/routes/_authenticated/contracts.index.tsx` junto da barra de ações em lote.
- `src/components/contracts/batch-import-contracts-dialog.tsx`: remover `MAX_FILES` e o aviso associado; fila com concorrência limitada.
- Novo `src/components/contracts/contract-amendments-panel.tsx` usado em `contracts.$id.tsx`, reaproveitando o padrão de busca de `contract-parent-link.tsx`.
- Validações: typecheck, lint e build.
