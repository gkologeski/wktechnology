# Isolamento de workspace no ATS + consolidação em RH - Seleção

## Situação atual (verificada)

- As tabelas principais do ATS (`ats_pipelines`, `ats_jobs`, `ats_applications`, `ats_candidates`) **não têm `workspace_id`**. O workspace é derivado depois pela função `public.resolve_workspace_id(owner_id)`, que retorna apenas o workspace _criado_ pelo owner, não o workspace do qual ele é membro.
- Consequência: 4 vagas criadas por `Priscila (5946...)` — que é membro do workspace `WK Technology (184b...)` — estão sem workspace, apesar de pertencerem ao mesmo workspace de `RH - Seleção`.
- Dados atuais:
  - 10 vagas: 6 no workspace `184b...` + 4 em pipelines "Pipeline padrão" do owner `5946...`
  - 4 pipelines: 3 "Pipeline padrão" e 1 "RH - Seleção"
  - 38 candidaturas em 9 vagas
  - Etapas atuais das candidaturas: `applied` (31), `screening` (5), `interview_hr` (1), `hired` (1)

## Objetivo

1. Adicionar `workspace_id` às tabelas principais do ATS e migrar os dados existentes.
2. Consolidar todas as vagas, candidaturas e candidatos no workspace de **RH - Seleção** (`184b...` — WK Technology) e mover todas as vagas para o pipeline **RH - Seleção**.
3. Reescrever as políticas de RLS para usar `workspace_id` e `current_user_workspaces()`, eliminando a dependência de `resolve_workspace_id(owner_id)`.
4. Atualizar as server functions e a UI para respeitar o workspace ativo.

## O que será feito

### 1. Migração de schema (migration tool)

- Adicionar coluna `workspace_id uuid` (nullable) em `ats_pipelines`, `ats_jobs`, `ats_applications` e `ats_candidates`.
- Adicionar FK `references public.workspaces(id)`.
- Criar índices em `workspace_id` nas quatro tabelas.
- Adicionar índice único parcial em `ats_pipelines(workspace_id)` onde `is_default = true`.
- Atualizar o gatilho `trg_ats_pipelines_single_default` para desmarcar outros padrões do mesmo `workspace_id`.
- Reescrever as políticas RLS das quatro tabelas para usar `workspace_id` como chave de escopo, mantendo os gates de admin/permissões (`is_workspace_admin_of`, `user_has_permission`, `techhire_rbac_gate`).
- Executar `GRANT` padrão após cada alteração.

### 2. Migração de dados (insert tool)

- Workspace de destino: `184b9435-0a9b-4334-9e89-8854dc883f5d` (WK Technology).
- Preencher `workspace_id` com o workspace de destino para **todas** as linhas de `ats_pipelines`, `ats_jobs`, `ats_applications` e `ats_candidates`.
- Atualizar `ats_jobs.pipeline_id` para o id do pipeline **RH - Seleção** (`7d8a58c3-e878-4c9c-a0e5-fa777acc548c`).
- Converter os `stage_value` das candidaturas para etapas do pipeline RH - Seleção:
  - `applied` → `caixa_de_entrada`
  - `screening` → `validacao_comportamental`
  - `interview_hr` → `entrevista_rh`
  - `hired` → `profissional_contratado`
- Remover os 3 pipelines "Pipeline padrão" restantes (após mover as vagas, eles ficam sem vínculos).

### 3. Server functions

- `src/lib/ats/pipelines.functions.ts`
  - Usar `workspace_id` do workspace ativo para listagem, criação, edição e garantia do pipeline padrão.
  - Garantir que `ensureDefaultAtsPipeline` crie o pipeline no workspace correto.
- `src/lib/ats/ats.functions.ts`
  - Inserir vagas com `workspace_id` do workspace ativo.
  - Filtrar listagens por `workspace_id`.
- Outras funções que inserem/alteram `ats_applications`, `ats_candidates` ou `ats_jobs`
  - Atualizar `workspace_id` nos inserts/updates.
- `src/routes/api/public/v1/ats/jobs.ts`
  - Popular `workspace_id` a partir do workspace do dono da API key.
- Workflow engine (`src/lib/workflows/engine.server.ts`)
  - Atualizar leitura/escrita de ATS quando necessário.

### 4. UI / UX

- Seletor de pipeline e criação de vaga usam `workspace_id` do workspace ativo.
- Manter o aviso `PipelineSelectNotice` quando não houver pipelines visíveis.
- Garantir que o pipeline padrão seja por workspace.

### 5. Validação

- `tsgo --noEmit` / `bunx tsc --noEmit`.
- `bun run lint`.
- Testes de workspace isolation (manual ou e2e) para confirmar que usuários de outros workspaces não veem os dados.
- Verificação visual: todas as 10 vagas e 38 candidaturas aparecem em RH - Seleção no workspace WK Technology.

## Riscos e observações

- Donos originais (`owner_id`) das vagas/candidaturas migradas serão preservados como metadados de auditoria, mas o acesso passará a ser controlado pelo `workspace_id`.
- Se houver usuários que pertençam a múltiplos workspaces, a regra de backfill usará o workspace de destino (WK Technology) para todas as linhas do ATS; ajustes manuais serão necessários se isso não for o desejado.
- A mudança de RLS pode esconder dados de usuários que antes os viam por `owner_id`; validaremos permissões antes de publicar.
- Após a fase 1, ainda restarão outras tabelas ATS sem `workspace_id` (ex.: `ats_interviews`, `ats_offers`, `ats_job_postings`). Uma segunda fase será necessária para isolamento completo do módulo.
