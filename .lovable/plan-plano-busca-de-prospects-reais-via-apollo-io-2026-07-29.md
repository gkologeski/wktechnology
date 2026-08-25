# Plano: Busca de prospects reais via Apollo.io

## Objetivo

Substituir a geração de prospects "inventados" pela IA no TechSales por busca de leads reais via Apollo.io, mantendo a mesma UX de ICP → busca → revisão → importação como lead.

## Contexto atual

- A aba "Busca de prospects" (`/prospecting?tab=prospecting`) usa `runProspectSearch`, que chama a Lovable AI Gateway (`google/gemini-2.5-flash`) e pede à IA para gerar uma lista plausível de empresas e contatos.
- Os resultados são heurísticos/inventados (`email_hint`, `domain_hint`, `reason`).
- As tabelas `prospecting_searches` e `prospecting_results` já existem, mas não possuem campos para IDs externos, telefones, LinkedIn, score Apollo, etc.
- O conector Apollo.io está disponível no workspace, mas ainda não está linkado ao projeto.

## Escopo

1. Conectar Apollo.io ao projeto.
2. Evoluir o schema das tabelas de prospecção para suportar dados reais do Apollo.
3. Refatorar `runProspectSearch` para chamar a API real do Apollo.io via gateway.
4. Atualizar a UI para exibir metadados reais (LinkedIn, telefone, email estimado, score, etc.).
5. Melhorar a importação de prospect como lead, aproveitando dados reais.
6. Remover a geração por IA dessa funcionalidade.

## Não está no escopo

- Manter IA como fallback.
- Adicionar outras fontes de dados (Google Maps, LinkedIn scraping, etc.).
- Alterar outras abas da Suíte de Prospecção (fila, cadências, scoring, etc.).

## Fases

### Fase 1 — Infraestrutura e conector

- Linkar o conector Apollo.io ao projeto via `standard_connectors--connect`.
- Verificar se `LOVABLE_API_KEY` e `APOLLO_API_KEY` estão disponíveis no runtime.
- Documentar no plano de execução: sem Apollo conectado, a busca ficará indisponível (sem fallback de IA).

### Fase 2 — Migração do banco

Adicionar colunas às tabelas existentes:

`prospecting_searches`:

- `source` (text, default `'apollo'`) — fonte da busca.
- `apollo_query` (jsonb, nullable) — payload enviado ao Apollo para auditoria.

`prospecting_results`:

- `source` (text, default `'apollo'`)
- `external_id` (text, nullable) — ID do Apollo.
- `linkedin_url` (text, nullable)
- `phone` (text, nullable)
- `email` (text, nullable) — email real/estimado do Apollo.
- `company_domain` (text, nullable)
- `company_size` (text, nullable)
- `industry` (text, nullable)
- `apollo_score` (numeric, nullable)
- `raw_payload` (jsonb, nullable) — resposta bruta do Apollo.

### Fase 3 — Backend: integração Apollo.io

Refatorar `src/lib/prospecting.functions.ts`:

- Remover a chamada à Lovable AI Gateway em `runProspectSearch`.
- Implementar chamada ao gateway do Apollo (`https://connector-gateway.lovable.dev/apollo/api/v1/mixed_companies/search` ou endpoint equivalente de people search).
- Mapear campos do ICP para parâmetros Apollo:
  - `industry` → `organization_industry_tag_ids` ou filtros por nome.
  - `role_title` → `person_titles`.
  - `company_size` → `organization_num_employees_ranges`.
  - `location` → `person_locations` / `organization_locations`.
  - `keywords` → `q_keywords` ou `organization_keyword_tags`.
- Limitar a `max_results` (padrão 10, máximo 50).
- Tratar erros específicos do Apollo:
  - `401` → credencial inválida.
  - `403` API_INACCESSIBLE → chave sem acesso ao endpoint; instruir a usar master key.
  - `429` → rate limit; respeitar `Retry-After` e informar ao usuário.
- Inserir resultados em `prospecting_results` com todos os metadados reais mapeados.
- Atualizar `importProspectAsLead` para usar `email`, `phone`, `linkedin_url`, `company_domain` e criar lead/contato/empresa mais completo.

### Fase 4 — UI

Atualizar `src/routes/_authenticated/settings.prospecting.tsx`:

- Alterar subtítulo e empty states para refletir busca real via Apollo.io.
- No card de resultado, exibir:
  - Nome do contato e cargo.
  - Nome da empresa, tamanho, indústria e localização.
  - Email (quando disponível) com indicativo "estimado" se for inferred.
  - Telefone e LinkedIn (quando disponíveis).
  - Score Apollo.
- Manter a ação "Importar como Lead".
- Adicionar estado de erro quando Apollo não estiver configurado.

### Fase 5 — Validação

- Typecheck e build.
- Testar fluxo end-to-end com Apollo conectado.
- Verificar se a remoção da IA não quebrou outras partes da Suíte de Prospecção.
- Revisar RLS/policies das tabelas alteradas (não alterar regras de negócio, apenas garantir que novas colunas não vazem dados).

## Riscos e dependências

- **Apollo.io é pago e quota-limitado**: cada busca consome créditos. O usuário precisa ter um plano Apollo ativo.
- **Master key**: alguns endpoints do Apollo exigem master key. Se a chave conectada não tiver permissão, a busca retornará 403.
- **Sem fallback**: se Apollo falhar ou não estiver conectado, a funcionalidade ficará indisponível.
- **Dados parciais**: o Apollo frequentemente retorna contatos sem email ou com email estimado. A UI deve deixar isso claro.

## Próximo passo após aprovação

Conectar o Apollo.io e iniciar a migração do banco.
