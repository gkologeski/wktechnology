## Objetivo

Tornar o Workflow Builder um recurso transversal de ERP: qualquer módulo pode ser gatilho (Quando) e alvo (Então), incluindo o ATS (vagas, candidatos, aplicações, entrevistas), não só CRM/Sales.

## Escopo

Cobrir hoje as entidades do ATS que já existem e têm dono claro por `owner_id`:
- `ats_jobs` (Vagas)
- `ats_candidates` (Candidatos)
- `ats_applications` (Aplicações — mudança de etapa do funil)
- `ats_interviews` (Entrevistas)

CRM já suportado (`leads`, `contacts`, `companies`, `deals`, `tickets`) permanece.

Fora deste plano: financeiro, WhatsApp, tickets do suporte como gatilho (tickets segue como já está), objetos custom (fica como próximo passo).

## Mudanças

### 1) Banco (migration)

- Ampliar `workflow_events.entity` CHECK para incluir: `tickets`, `ats_jobs`, `ats_candidates`, `ats_applications`, `ats_interviews`.
- Ampliar `enqueue_workflow_event()` para detectar `stage_changed` em:
  - `ats_jobs`: mudança em `status` (draft → open → closed).
  - `ats_applications`: mudança em `stage_id`.
  - `ats_interviews`: mudança em `status`.
  - `ats_candidates`: mudança em `stage` / `status` (o que existir).
- Anexar triggers `after insert or update` nas 4 tabelas do ATS.
- Idempotente (`if not exists` para triggers), sem tocar em RLS existente.

### 2) Tipos e catálogo (`src/lib/workflows/types.ts`)

- Expandir `WorkflowEntity` com `ats_jobs | ats_candidates | ats_applications | ats_interviews`.
- Adicionar labels em `ENTITY_LABELS` ("Vagas", "Candidatos", "Aplicações", "Entrevistas").
- Adicionar `ENTITY_FIELDS` para as 4 (title/status/department/pipeline_id, first_name/last_name/email/stage, stage_id/status/score, scheduled_at/status/interviewer_id).
- Novas actions ATS:
  - `advance_ats_application_stage { stage_id }`
  - `create_ats_candidate { first_name, last_name, email, source? }`
  - `create_ats_application { job_id, candidate_id, stage_id? }` (tokens permitidos)
  - `assign_recruiter { user_id, target?: "job"|"candidate" }`
- Manter `create_ats_job` mas remover a restrição “só em Negócios” (passa a rodar em qualquer entidade; pega `company_id`/tokens do `after`).

### 3) Engine (`src/lib/workflows/engine.server.ts`)

- Remover `if (ctx.entity !== "deals") throw` em `create_ats_job`.
- Suporte a `assign_to` nas novas entidades: mapa de coluna por entidade (`ats_jobs.recruiter_id`, `ats_candidates.owner_id`, `ats_applications.recruiter_id`, `ats_interviews.interviewer_id`).
- `create_activity`: associar via `metadata` (ATS não tem `related_*_id` para vagas/candidatos hoje) — grava `entity_type`/`entity_id` num campo já existente (`metadata` jsonb) para não alterar schema de activities.
- Implementar as 4 novas actions com validação mínima (throw amigável se faltar `stage_id`, etc.).
- `send_notification`: já é genérico; ampliar `link` para gerar deep-link por entidade (`/ats/jobs?id=…`, `/ats/candidates?id=…`, `/ats/applications/:id`).

### 4) UI do Builder (`src/components/workflows/workflow-builder.tsx`)

- Dropdown "Quando (entidade)" passa a listar todas as entidades de `ENTITY_LABELS`, agrupadas por módulo (Vendas / Atendimento / Recrutamento).
- Cartões de ação novos com formulários simples (selects + inputs + tokens), reaproveitando `UserPicker` e leitura de estágios via server function que já existe para pipelines ATS (se não existir, adicionamos uma leve `listAtsStages`).
- Nenhuma alteração em permissões/rotas.

### 5) Menu (`src/lib/menu-config.ts`)

- Adicionar item "Workflows" (`/settings/workflows`) dentro do submenu do módulo **Recrutar → ATS**, além do lugar atual em Otimizar/Settings.
- Manter `need: "manager"` para consistência.
- Não duplicar entradas em Settings; apenas expor atalho por módulo (padrão ERP).

### 6) Rotas e telas

- Nenhuma rota nova. A tela `/settings/workflows` já suporta qualquer valor em `entity`; o filtro visual passa a mostrar as novas entidades automaticamente.

## Fora de escopo

- Novos triggers em `whatsapp_*`, `activities`, `subscriptions`, objetos custom.
- Fluxos de aprovação multi-nível.
- Alterar RLS, autenticação ou schema de `activities`.
- Integrações externas (HRIS, ERP financeiro).

## Validação manual

1. Migration aprovada → criar workflow com entidade "Aplicações", evento "Mudou de etapa", filtro `stage_id = <Contratado>`.
2. Ação: `send_notification` para o hiring manager + `create_activity` "Iniciar onboarding".
3. Mover uma aplicação para a etapa Contratado → verificar notificação e atividade.
4. Criar workflow com entidade "Vagas", evento "Quando for criado", ação `assign_recruiter` → criar vaga rascunho e verificar `recruiter_id`.
5. Verificar que o item "Workflows" aparece no submenu do módulo ATS.

## Risco

- Ampliar CHECK constraint requer `alter table … drop constraint … add constraint …` — feito em transação idempotente.
- Triggers no ATS podem gerar volume — a fila `workflow_events` já tem índice por `processed_at is null` e é consumida por pg_cron a cada minuto.
