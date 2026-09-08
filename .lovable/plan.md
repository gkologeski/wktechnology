# TechProjects — Apontamento de horas dos profissionais

## O que já existe (auditado agora)

- `projects` (com `contract_id`, `service_id`, `planned_hours`), `project_spaces`, `project_folders`, `project_milestones`.
- `project_tasks` (título, status, responsável, `estimated_hours`, listas, subtarefas).
- `project_members` (papel no projeto, custo/venda hora) — **sem** campo de autorização para apontar.
- `project_time_entries` (data, `hours`, descrição, faturável, `started_at`/`stopped_at`, aprovação, aloca\u00e7ão, fatura) — **sem** hora de início/fim, origem, id externo ou status de aprovação em etapas.
- Timer global funcionando (`src/lib/project-timer.functions.ts`, `src/components/timer-widget.tsx`), timesheet semanal (`/projects/timesheet`), My Work, painel de timesheet em People.
- API pública versionada já existe em `src/routes/api/public/v1/` e há tabela `api_keys` com hash, escopos e workspace — reaproveitada, sem criar nada paralelo.
- RLS por workspace + permissões granulares (`techprojects.time_entries.*`) já cobrem as tabelas.

Portanto: **nenhuma tabela nova de projeto/tarefa/apontamento**. O trabalho é ampliar o que existe.

## Decisões confirmadas

- Meta de horas derivada da alocação do profissional (percentual × 8h/dia).
- Sem bloqueio de edição retroativa nesta versão (estrutura pronta para bloquear).
- Fluxo de aprovação completo: Rascunho → Enviado → Aprovado / Rejeitado → Travado.
- Atividade livre digitada cria automaticamente a tarefa no projeto.

## O que será entregue

### 1. Banco (migração aditiva)

Em `project_time_entries`: `start_time`, `end_time` (hora do dia), `duration_minutes`, `source` (manual/timer/api/integração/importação), `external_id`, `status`, `submitted_at`, `rejected_at`/`rejected_by`, `reject_reason`, `locked_at`, `created_by`.
Índice único parcial em (`workspace_id`, `source`, `external_id`) para idempotência; índice por usuário+data.
Trigger de validação: fim > início, duração positiva, sem sobreposição de horários do mesmo profissional no mesmo dia, projeto e usuário obrigatórios.
Trigger de auditoria gravando alteração (quem, antes, depois, quando) na tabela de log já existente.
Em `project_members`: `can_track_time` (padrão verdadeiro).
Novas permissões de apontamento/aprovação no catálogo e políticas ajustadas para leitura própria x gestor.

### 2. Backend

- Server functions novas/ampliadas: apontar (com validação de sobreposição e criação de tarefa livre), duplicar, encadear (início = fim do anterior), editar, excluir com guarda, enviar período, aprovar, rejeitar, travar.
- Resumo do dia/semana/mês com meta derivada da alocação.
- Indicadores do gestor: horas hoje/semana/mês, por profissional, projeto, cliente, atividade e status; quem não apontou; quem está incompleto.
- Timer ajustado para gravar início/fim e origem `timer`, mantendo um único timer ativo.
- Eventos de domínio `time_entry.created/updated/deleted/approved` publicados na estrutura de eventos existente (base para webhooks).

### 3. API de integração (`/api/public/v1/time-entries`)

- `POST` (por e-mail/ids externos ou ids internos), `GET` lista, `GET` por id, `PUT`, `DELETE`; e leitura de projetos/tarefas/usuários.
- Autenticação pela chave de API já existente (hash, escopos leitura/escrita, workspace, último uso).
- Idempotência por `external_id`; retorno com id e duração em minutos.

### 4. Frontend

- Botão destacado **+ Apontar Horas** no TechProjects e no painel inicial; atalho também no menu.
- Drawer de apontamento rápido: projeto pré-selecionado quando há apenas um, atividade com busca e criação livre, data padrão hoje, início/fim com cálculo automático do total, descrição. Ações: Salvar, Salvar e adicionar outro, Duplicar, Próximo apontamento.
- Nova tela **Minhas Horas**: hoje (apontado, esperado, restante, lista), semana (por dia, total, meta) e calendário mensal com status por dia; clique no dia abre os apontamentos.
- Painel do gestor com filtros por profissional, projeto, cliente, período, atividade e status, mais aprovação/rejeição em lote.
- Cards no painel inicial: Horas Hoje e Esta Semana com barra de progresso.
- Base de alertas ("ainda não lançou as horas de hoje", dias incompletos) usando as notificações internas existentes.
- Tudo com o design system oficial (PageHeader, MetricCard, FilterBar, EmptyState, esqueleto, erro), acessível, responsivo até celular e com tema claro/escuro.

## Detalhes técnicos

- Migração única aditiva, com `GRANT` → RLS → políticas na ordem exigida; nenhuma coluna removida ou renomeada; `hours` continua preenchido (derivado de `duration_minutes`) para não quebrar timesheet de People, faturamento e margens.
- Exclusões via `deleteRowGuarded`/`deleteWhereGuarded`.
- Server functions em arquivos finos por tema (`src/lib/projects/time-tracking.functions.ts`, `time-approval.functions.ts`, `time-metrics.functions.ts`), lógica em `*.server.ts`, todos abaixo de 350 linhas.
- Endpoint público valida a chave antes de qualquer escrita e nunca retorna dados de outro workspace.
- Validação: `bun run typecheck`, `bun run lint`, `bun run test`, mais conferência das contagens de apontamentos antes/depois.

## Fases

1. Migração + permissões.
2. Backend de apontamento, validações e auditoria.
3. Apontamento rápido, Minhas Horas e calendário.
4. Timer alinhado ao novo formato + cards do painel.
5. Visão do gestor e fluxo de aprovação.
6. API pública v1 + eventos para webhooks.
