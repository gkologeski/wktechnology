# Workflows: ação "Criar registro" de Contrato em PT-BR e sem campos técnicos

## O que foi verificado

O formulário do passo usa o catálogo genérico de campos (`src/lib/entity-fields.functions.ts` + `src/components/workflows/extra-fields-editor.tsx`). Hoje:

- Rótulos vêm de um dicionário global; colunas de contrato não mapeadas caem no fallback `snake_case → Title Case` (daí "Parent Contract Id", "Imported From", "Public Token").
- Qualquer coluna de texto com até 20 valores distintos vira combo. Por isso "Título do contrato" abriu um combo gigante com títulos de contratos existentes.
- Colunas UUID sem entrada em `REF_COLUMNS` (`parent_contract_id`, `contracting_legal_entity_id`, `assigned_to`) viram campo de texto com token/chips.
- `payment_terms` e `metadata` são `jsonb`; `body_html` é `text`.

## Respostas às dúvidas

- **e) `number`**: é o número do contrato e é gerado pelo sistema — não deve ser editável no workflow.
- **f) `public_token`**: token do link público de visualização/assinatura; gerado pelo sistema.
- **g/h) `readjustment_index`, `readjustment_period`, `service_type`, `service_location`**: não há tabela de cadastro; existem listas canônicas em `src/lib/contracts/import-schemas.ts` (IGPM/IPCA/INPC/SELIC/CDI, tipos e local de serviço). Serão combos com essas listas em PT-BR. **`service_scope`** é texto descritivo do escopo → texto longo, nunca combo.
- **i) `signature_operation_id` / o) `signature_document_id` / p) `signature_document_path`**: identificadores devolvidos pelo provedor de assinatura (ForSign/Clicksign/DocuSign). São preenchidos pela integração, não pelo usuário.
- **l) `contracting_legal_entity_id`**: qual empresa/CNPJ do grupo (tabela `legal_entities`) figura como contratante. Deve ser seletor por nome.
- **m) `metadata`**: bolsa técnica de dados auxiliares (jsonb) usada por integrações.
- **c) `parent_contract_id`**: contrato-pai (aditivo/renovação de outro contrato). Deve ser seletor de contrato por número/título, nunca texto livre.
- **k) `body_html`**: sim, editor WYSIWYG.
- **n) `payment_terms`**: não é texto rico — é jsonb. As condições de pagamento legíveis já têm colunas próprias (dia, método, multa, juros, reembolso). Fica no bloco avançado como pares chave/valor.

## O que será feito

### 1. Rótulos PT-BR completos para Contratos

Preencher `ENTITY_LABEL_OVERRIDES.contracts` com todas as colunas: papel, contraparte, negócio, contrato-pai, vigência, renovação automática, aviso prévio, valores, moeda, índice/periodicidade de reajuste, dia e método de pagamento, multa, juros mensais, reembolso de despesas, multa rescisória, prazo de cura, período de teste, aviso de rescisão unilateral, tipo/escopo/local do serviço, lei aplicável, foro, sigilo (meses), empresa contratante, provedor de assinatura, assinado em, responsável, etc.

### 2. Bloco colapsado "Outros campos (sistema e integração)"

Em vez de esconder, agrupar `number`, `public_token`, `signature_document_id`, `signature_document_path`, `signature_operation_id`, `signed_pdf_path`, `source_file_path`, `imported_from`, `metadata` e `payment_terms` em uma seção colapsável fechada por padrão, logo abaixo dos campos principais, com rótulos PT-BR e nota curta explicando que normalmente são preenchidos pelo sistema ou pela integração de assinatura. Continuam editáveis quando o usuário abrir a seção.

### 3. Combos com listas canônicas

`readjustment_index`, `readjustment_period`, `service_type`, `service_location`, `payment_method`, `signature_provider`, `role`, `status`, `currency` passam a usar listas fixas com rótulos PT-BR (reaproveitando as constantes de `import-schemas.ts` e os enums `contract_role`/`contract_status`).

### 4. Nunca transformar texto livre em combo

Adicionar `title`, `service_scope`, `governing_law`, `jurisdiction`, `body_html` à lista de campos sempre livres — resolve o combo gigante do Título do contrato (b). O campo Título passa a ser input de texto com suporte a tokens.

### 5. Seletores por nome em vez de IDs

Registrar em `REF_COLUMNS`: `assigned_to` → usuário, `contracting_legal_entity_id` → empresa (CNPJ), `parent_contract_id` → contrato. Novos `RefKind` "legal_entity" e "contract" com server functions de busca (`searchLegalEntities`, `searchContracts`, com `ilike` em nome/número/título e hidratação por `ids`), no mesmo padrão de `searchCompanies`. Assim nenhum campo mostra hash (j, c, l).

### 6. WYSIWYG no corpo do contrato

`body_html` renderiza o `WordEditor` (lazy) dentro do editor de campos, com altura reduzida e suporte a inserção de tokens acima do editor.

## Detalhes técnicos

- Alterados: `src/lib/entity-fields.functions.ts` (labels, ocultos, listas canônicas, free-text por entidade), `src/lib/entity-fields-refs.ts` (novos RefKind e colunas), `src/lib/workflow-refs.functions.ts` (duas novas buscas com `requireSupabaseAuth`, RLS aplicada), `src/components/workflows/extra-fields-editor.tsx` (mapa de resolvers de ref + branch WYSIWYG para `body_html`).
- Sem migration, sem mudança de RLS, schema ou engine de workflow: apenas catálogo de campos e UI do construtor.
- Componentes oficiais (Select, Popover/Command, WordEditor), tokens semânticos, labels acessíveis, foco visível, light/dark.

## Como validar

`/settings/workflows` → novo workflow → ação "Criar registro" → tabela Contratos: todos os rótulos em PT-BR; Título é texto simples; Contrato-pai, Empresa contratante e Responsável abrem busca por nome; Índice de reajuste/Tipo de serviço são combos; Corpo do contrato abre editor rico; nenhum campo de token/ID técnico visível.
