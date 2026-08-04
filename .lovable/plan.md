# Modelos de contrato com variáveis (TechContracts) usáveis no TechSales

## Estado atual (verificado)

- `public.contracts` já tem corpo do contrato (`body_html`) e metadados extraídos; `src/lib/contracts.functions.ts` grava `body_html`.
- A importação existente (`src/lib/contracts/import.functions.ts` + `import-contract-file-dialog.tsx`) extrai variáveis de contratos **já firmados** e cria um registro em `contracts`. Não existe nada para modelos.
- Não existe tabela nem tela de modelos de contrato (`contract_templates` não aparece no schema).
- Existe um padrão pronto de "modelos" em Propostas: tabela `quote_templates`, `src/lib/quote-templates.functions.ts` e editor `src/components/quote-templates/template-editor.tsx` — será a referência de arquitetura.
- Catálogo global de serviços em `public.service_catalog` (tela `/catalog/services`); `public.services` são serviços em execução de um contrato (exigem `contract_id`), portanto o vínculo do modelo será com o **catálogo**.
- Rich text já disponível: `RichHtmlEditor`/`WordEditor` (lazy) e pills de variáveis via `TokenInput`/`token-pills`.

## O que será construído

### 1. Banco (migration)

- `public.contract_templates`: `name`, `description`, `role` (prestação/compra), `service_type`, `body_html`, `variables` (jsonb: lista de variáveis detectadas), `defaults` (jsonb: valores padrão de campos do contrato), `source_file_path`, `imported_from` (`docx`/`pdf`/`manual`), `is_default`, `status` (rascunho/publicado), `owner_id`, `assigned_to`, `workspace_id`, timestamps + trigger de `updated_at`.
- `public.contract_template_services`: vínculo N:N com `service_catalog` (`template_id`, `service_catalog_id`).
- GRANTs para `authenticated`/`service_role`, RLS por workspace + escopos (mesmo padrão das demais tabelas de contratos), sem leitura anônima.
- Chaves de permissão granular `techcontract.contract_templates.{view,create,update,delete}.{own,team,workspace}` no catálogo de permissões.

### 2. Tela de modelos

- Nova rota `/contracts/templates` (item "Modelos de contrato" no menu do TechContracts, em `menu-config-contracts.ts`).
- Lista padrão: PageHeader com ações "Novo modelo" e "Importar modelo", busca, filtros (tipo de serviço, serviço do catálogo, status), estados loading/empty/error, badge de status e de "Importado".
- Editor do modelo (`/contracts/templates/$id`): nome, descrição, papel, tipo de serviço, seletor múltiplo de serviços do catálogo, corpo em Rich Text com painel de pills de variáveis agrupadas por entidade (empresa, contato, negócio, contrato, valores), pré-visualização com dados de exemplo, salvar rascunho e publicar.

### 3. Importação de modelo (.docx / .pdf)

- Novo diálogo "Importar modelo de contrato" reaproveitando a UI/estado de progresso existente (`import-progress.ts` e o visualizador local do arquivo).
- Pipeline: extrair texto/HTML (mammoth para .docx, IA para .pdf) → chamada de IA com prompt novo que devolve o corpo em HTML **com trechos variáveis já substituídos por tokens** (`{{company.name}}`, `{{contract.monthly_value}}` etc.) mais a lista de substituições sugeridas.
- Passo de revisão: corpo no Rich Text com as variáveis destacadas, tabela "trecho original → variável sugerida" para aceitar/descartar cada sugestão, campos de nome/serviços/tipo, e então salvar como modelo (rascunho).
- O arquivo original é guardado como origem do modelo, igual à importação atual.

### 4. Uso no TechSales

- Na tela do negócio (área de contratos do negócio): ação "Gerar contrato a partir de modelo".
- Passo 1: escolher o modelo — a lista prioriza modelos vinculados aos serviços/produtos do negócio, depois os demais.
- Passo 2: pré-visualização do documento com as variáveis já mescladas a partir do negócio, empresa, contato e valores, com botão de baixar/imprimir.
- Passo 3: "Criar contrato" grava um contrato em rascunho com `body_html` mesclado, campos padrão do modelo aplicados e vínculo ao negócio; navega para o contrato criado.
- A mesma ação fica disponível dentro de TechContracts ao criar contrato ("usar modelo").

## Detalhes técnicos

- Server functions novas em `src/lib/contracts/templates.functions.ts` (CRUD, publicar, duplicar) e `src/lib/contracts/template-import.functions.ts` (extração + sugestão de variáveis), ambas com `requireSupabaseAuth` e `assertAnyPermission`, seguindo `contracts.functions.ts`.
- Merge de variáveis em módulo puro `src/lib/contracts/template-merge.ts` (testável), reutilizando o catálogo de tokens já existente (`token-catalog.ts`) para manter as pills coerentes com o que o sistema resolve.
- Sanitização do HTML importado via `normalizeHtmlField`/`sanitizeHtml` já existentes.
- Nada é alterado na importação de contratos firmados; o fluxo novo é aditivo.
- UX/UI: componentes oficiais (PageHeader, DataTable, FilterBar, EmptyState, LoadingSkeleton, ErrorState, Badge, FormSection), tokens semânticos, responsivo, light/dark, foco visível e `aria-live` no progresso.

## Como validar

1. TechContracts → Modelos de contrato → "Novo modelo": escrever corpo com pills e publicar.
2. "Importar modelo": enviar um .docx e um .pdf, acompanhar o progresso, revisar as variáveis sugeridas e salvar.
3. Vincular o modelo a um serviço do catálogo e conferir o filtro na lista.
4. TechSales → negócio → "Gerar contrato a partir de modelo": pré-visualizar e criar; conferir corpo mesclado no contrato criado.
