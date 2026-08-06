# Contratos organizados por empresa e por serviço

Adicionar um alternador de agrupamento na lista de contratos (/contracts), mantendo a tabela atual como visão padrão.

## O que muda na tela

- Novo controle na barra de filtros: **Agrupar por: Nenhum | Empresa | Serviço**.
  - **Nenhum**: exatamente a tabela de hoje (comportamento atual preservado).
  - **Empresa**: seções colapsáveis por empresa contraparte, com nome da empresa, contagem de contratos e soma dos valores. Contratos sem empresa vão para "Sem empresa".
  - **Serviço**: seções colapsáveis por serviço do catálogo associado aos serviços do contrato. Contratos sem serviço vão para "Sem serviço".
- Um contrato com vários serviços do catálogo aparece em todos os grupos correspondentes (conforme confirmado).
- Cada seção usa cabeçalho de seção padronizado + a mesma tabela/colunas já existentes, então nenhuma informação é perdida ao agrupar.
- Todos os filtros atuais (busca, tipo, status, responsável) continuam valendo antes do agrupamento.
- Estados: skeleton de carregamento fiel, estado vazio já existente, e estado de erro com ação de tentar novamente na consulta de agrupamento.
- Preferência de agrupamento fica na URL (search param), para poder compartilhar/voltar mantendo a visão.

## Detalhes técnicos

- `src/lib/contracts.functions.ts`: nova server function `listContractGroupings` (autenticada, mesmas permissões de leitura de contratos) que retorna, para os contratos visíveis:
  - `companies`: id + nome das empresas contrapartes (join em `companies` via `counterparty_company_id`);
  - `services`: pares `contract_id` → serviço do catálogo, lendo `services` (filtrado por `contract_id`) e resolvendo o id em `metadata->>service_catalog_id` contra `service_catalog` para obter o nome.
  - Retorno como DTOs simples (arrays de objetos planos).
- `src/routes/_authenticated/contracts.index.tsx`: adiciona `validateSearch` com `groupBy` (`none | company | service`, com `fallback`), lê via `Route.useSearch()`, troca por `useNavigate`. A tabela atual é extraída para um componente reutilizável de linhas para ser renderizada tanto na visão plana quanto dentro de cada grupo.
- Novo componente `src/components/contracts/contracts-grouped-list.tsx`: monta os grupos em memória a partir das linhas já filtradas + os mapas de empresa/serviço, ordena por contagem/nome, e renderiza seções colapsáveis (componentes oficiais de UI, tokens semânticos, foco visível, dark mode).
- Sem mudanças de schema, RLS, permissões ou regras de negócio.

## Fora do escopo

- Agrupar por serviços em execução criados manualmente sem vínculo com o catálogo (esses caem em "Sem serviço").
- Alterações na tela de /services.
