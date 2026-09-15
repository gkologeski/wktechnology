# Workflows: escolher o substatus pelo nome, não pelo ID

No construtor de workflows, campos de referência já mostram nome (empresa, contato, pipeline, responsável, contrato, negócio). Mas colunas mais novas — como "Substatus da etapa" — não estão no mapa de referências do catálogo, então caem no caminho padrão e pedem um ID cru.

## O que muda

### 1. Substatus da etapa (o caso relatado)

- Em condições, critérios de meta e no passo "Criar/Atualizar registro", o campo passa a ser um combo com os substatus cadastrados no workspace, rotulados como "Etapa · Nome do substatus".
- O valor gravado continua sendo o ID do substatus (nada muda no motor nem no banco).
- Substatus inativos não aparecem para escolha; se um workflow salvo aponta para um inativo, o valor é preservado e exibido.
- Sem substatus cadastrados, o campo fica oculto do bloco principal (vai para "Outros campos") em vez de pedir um ID.
- Vale para as entidades que têm a coluna: Negócios, Leads e Chamados.

### 2. Outras colunas de ID que ainda pedem hash

Mesma correção, por tipo já existente de seletor com busca por nome:

- Responsáveis/pessoas: `recruiter_id`, `relationship_owner_id`, `interviewer_id`, `assignee_id` (onde faltava).
- Empresa/contato/negócio/contrato em Financeiro e ATS: `counterparty_legal_entity_id`, `job_id` (vaga), `candidate_id` (candidato), `application_id` (candidatura), `project_id`, `milestone_id`, `service_id`, `category_id` — cada um com busca por nome, gravando o ID.
- Colunas puramente técnicas passam a ficar recolhidas em "Outros campos" em vez de aparecerem como propriedade editável: `provider_applicant_id`, `linkedin_company_id`, `linkedin_location_id`, `connection_id`, `external_id`, `origin_id`, `parent_entry_id`, `signature_operation_id`.

Nada é removido: condições e passos já salvos continuam válidos e funcionando.

## Detalhes técnicos

- `src/lib/entity-fields-refs.ts`: novos `RefKind` (`substatus`, `job`, `candidate`, `application`, `project`, `milestone`, `service`, `category`) e novas entradas em `REF_COLUMNS` para as colunas listadas.
- `src/lib/entity-fields.functions.ts`: para `stage_substatus_id`, carregar `pipeline_stage_substatuses` (ativos, ordenados) como `registryOptions` com rótulo "Etapa · Nome" — mesmo padrão já usado em `deal_loss_reasons` e `lead_sources`; ampliar a lista de colunas marcadas como `system` (bloco recolhido).
- `src/components/workflows/extra-fields-editor.tsx` (`FkPicker`) e o seletor de condições: tratar os novos `kind`s, reaproveitando as buscas de servidor existentes por entidade; para substatus, usar o hook `useWorkspaceSubstatuses` já existente em `src/lib/pipelines/substatuses.ts`.
- Sem migration, sem alteração de RLS, permissões, schema ou regra de negócio; apenas apresentação/catálogo de campos.

## Validação

`bun run typecheck`, `bun run lint`, `bun run test` e conferência manual em `/settings/workflows`.

## Como validar manualmente

1. `/settings/workflows` → nova condição em Negócios → campo "Substatus da etapa": deve listar nomes, não IDs.
2. Passo "Atualizar registro" em Leads → mesmo campo, mesmo combo.
3. Abrir um workflow antigo que use algum desses campos e confirmar que o valor salvo continua exibido corretamente.
