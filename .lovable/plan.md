# Evolução de Substatus + Enriquecimento por LinkedIn (TechSales)

## Contexto

O plano original de **Substatus por Etapa de Pipeline** foi aprovado e a Fase 1 (filtros) já teve parte de sua estrutura iniciada. Durante a implementação, surgiu um requisito adicional: permitir enriquecimento de leads também pelo **link do LinkedIn** no momento da qualificação.

## Escopo consolidado

### Fase 1 — Filtros por Substatus (em andamento)

Adicionar filtro por `stage_substatus_id` nos grids e no Kanban de Leads e Negócios.

- **Leads (`/leads`)**: sidebar de filtros com agrupamento por etapa; `applyFilters` passa a aplicar `in(stage_substatus_id, [...])`; `hasActiveFilters` considera a nova dimensão.
- **Negócios (`/deals`)**: `DealsToolbar` ganha seletor multi-seleção de substatus; filtro aplicado tanto na tabela quanto no Kanban (que consome `filtered`).
- Dados: `usePipelineSubstatuses(pipelineId)` carrega substatus ativos do pipeline ativo.

### Fase 2 — Substatus no motor de automações

- Condições: expor `stage_substatus_id` como campo comparável no Workflow Builder (já aparece no catálogo de colunas, mas garantir operador `changed_to` e labels amigáveis).
- Ações: nova ação `set_substatus` que atualiza o registro alvo (lead/deal) para o substatus informado, respeitando validação de etapa via trigger do banco.

### Fase 3 — Auditoria de mudanças de Substatus

- Componente `SubstatusHistoryCard` reutilizável nos detalhes de Lead e Negócio.
- Lê de `property_history` filtrando `column_name = 'stage_substatus_id'`, resolvendo nomes antigos/novos via `findSubstatus` e exibindo usuário + data/hora.

### Fase 4 — Performance da reordenação

- Substituir `reorderSubstatuses` (N updates sequenciais) por uma função RPC SQL `reorder_substatuses(ids uuid[])` que atualiza posições em lote de forma atômica.

### Fase 5 — Enriquecimento por LinkedIn na qualificação (novo)

No fluxo de qualificação de leads (`/leads/$id` e diálogos relacionados):

- Campo opcional **URL do LinkedIn** no lead (reutilizar campo existente se houver; caso contrário, adicionar `linkedin_url` temporariamente no formulário de qualificação).
- Botão/ação **"Enriquecer pelo LinkedIn"** ao lado do campo.
- Integração com Apollo.io (ou outro enrichment provider configurado) usando o perfil do LinkedIn como input, extraindo: nome, cargo, empresa, telefone/celular, e-mail, localização.
- Aplicar os dados enriquecidos ao lead e, se permitido, criar/atualizar Empresa/Contato relacionados.
- Registrar atividade na timeline indicando origem "Enriquecimento LinkedIn".
- Tratamento de erro claro quando o provider não conseguir resolver o perfil ou não houver créditos/configuração.

## Fora do escopo

- Criar novo provider de enrichment; usa-se o Apollo.io/integração existente.
- Alterar regras de duplicidade de leads.
- Modificar estrutura de pipelines ou etapas.

## Validação

- `bun run lint`, `bun run typecheck`, `bun run test`.
- Verificação manual em `/leads`, `/deals` (filtros e Kanban), `/settings/pipelines`, detalhes de Lead/Negócio e fluxo de qualificação com LinkedIn.
- Revisar se o runtime error `oauthApi` em `[.]lovable.oauth.consent.tsx` permanece resolvido.
