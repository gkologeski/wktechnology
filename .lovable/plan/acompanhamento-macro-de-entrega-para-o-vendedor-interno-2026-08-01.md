# Acompanhamento macro de entrega para o Vendedor Interno

Objetivo: quando um negócio é ganho e gera um projeto no TechProjects, o vendedor
responsável passa a acompanhar a evolução macro daquele projeto — sem acesso a
marcos, tarefas, horas ou datas operacionais.

## Como o vendedor chega ao projeto

O vínculo usa o contrato como ponte (decisão do usuário):

```text
deals.id  ->  contracts.deal_id  ->  projects.contract_id  ->  projeto
```

Nenhum campo novo em `projects`. Uma função no banco resolve o caminho e decide
se o usuário atual pode ver a entrega daquele projeto (é o responsável do
negócio, está na equipe dele, ou tem permissão ampla).

## Linha do tempo híbrida

Nova tabela `project_updates`, que alimenta a timeline macro:

- Checkpoints escritos pela equipe de projetos: título, resumo, farol
  (Verde / Atenção / Crítico), previsão de entrega vigente e % de evolução.
- Eventos automáticos resumidos, gerados por gatilho quando o projeto muda de
  status, de % de progresso ou de data prevista. Texto sempre macro
  ("Projeto avançou para Execução", "Evolução passou de 40% para 55%") —
  nunca nomes de tarefas ou marcos.
- Cada registro tem visibilidade: `internal` (só equipe do projeto) ou
  `commercial` (também visível ao vendedor do negócio). Checkpoints nascem como
  `commercial`; o autor pode marcar como interno.

Previsão de entrega versionada: cada checkpoint carrega a previsão vigente, então
a timeline mostra o histórico de replanejamentos ("Previsão alterada de 30/09
para 20/10") e o cabeçalho exibe a previsão mais recente.

## Onde aparece

1. **Aba "Entrega" no negócio** (`/deals/$id`): card com farol atual, previsão de
   entrega, % de evolução e a timeline macro somente leitura. Só aparece quando o
   negócio está Ganho e existe projeto vinculado via contrato.
2. **Visão macro do projeto** (`/projects/$id/entrega`): mesma timeline em tela
   cheia, somente leitura, sem abas de marcos, tarefas, horas e financeiro.
   Quem já tem acesso completo ao projeto continua usando `/projects/$id` normal.

Ambas usam os componentes oficiais (PageHeader, MetricCard, StatusBadge,
EmptyState, LoadingSkeleton, ErrorState), PT-BR, responsivo e dark mode.

## Permissões

Novas chaves granulares no catálogo, visíveis em `/settings/permissions` e no
diagnóstico RBAC:

- `techsales.deal_delivery.view.own` — acompanhar a entrega dos negócios do
  próprio vendedor (será concedida ao Vendedor Interno).
- `techsales.deal_delivery.view.team` / `.workspace` — equipe / todo o workspace.
- `techprojects.project_updates.view.workspace`, `.create.own`,
  `.update.own`, `.delete.workspace` — para a equipe de projetos publicar e
  manter os checkpoints.

O vendedor recebe apenas leitura. Ele não ganha `techprojects.projects.*`, logo
continua sem acesso a marcos, tarefas, horas e custos.

## Detalhes técnicos

**Migração**

- `public.project_updates`: `id`, `workspace_id`, `project_id`, `kind`
  (`checkpoint` | `auto`), `title`, `summary`, `health`
  (`green` | `yellow` | `red`), `progress_pct`, `expected_delivery_date`,
  `visibility` (`internal` | `commercial`), `published_at`, `author_id`,
  `owner_id`, `assigned_to`, `created_at`, `updated_at` + trigger de
  `updated_at`.
- GRANTs para `authenticated` e `service_role` na mesma migração.
- RLS: SELECT para membros do workspace com permissão de projetos **ou** via
  `public.user_can_view_deal_delivery(auth.uid(), project_id)`, que só libera
  registros `visibility = 'commercial'` para o responsável do negócio (escopo
  own/team conforme a chave `techsales.deal_delivery.view.*`). INSERT/UPDATE/
  DELETE apenas com as chaves `techprojects.project_updates.*` e
  `owner_id = auth.uid()` no INSERT.
- Função `security definer` `user_can_view_deal_delivery` resolvendo
  `projects.contract_id -> contracts.deal_id -> deals.owner_id`, com
  `shares_team_with` para o escopo de equipe.
- Trigger `AFTER UPDATE ON public.projects` inserindo eventos `kind = 'auto'`
  quando `status`, `progress` ou `due_at` mudam.
- INSERT das novas chaves em `public.permissions` e concessão de
  `techsales.deal_delivery.view.own` aos cargos de vendedor.

**Código**

- `src/lib/projects/delivery.functions.ts`: `getDealDelivery` (por `deal_id`),
  `getProjectDelivery` (por `project_id`), `createProjectUpdate`,
  `updateProjectUpdate`, `deleteProjectUpdate` — todas com
  `requireSupabaseAuth` e `assertAnyPermission`.
- `src/lib/projects/delivery-labels.ts`: rótulos PT-BR de farol, tipo e
  visibilidade.
- `src/components/projects/delivery-timeline.tsx`: timeline macro reutilizável
  (usada no negócio e na tela do projeto).
- `src/components/projects/project-update-dialog.tsx`: publicar/editar
  checkpoint (só para quem tem permissão de escrita).
- `src/routes/_authenticated/deals.$id.tsx`: nova seção "Entrega", condicionada
  a negócio ganho + projeto vinculado.
- `src/routes/_authenticated/projects.$id.entrega.tsx`: visão macro somente
  leitura.
- `src/lib/menu-resources.ts` e catálogo de rótulos: registrar os novos recursos
  para aparecerem em `/settings/permissions` e no diagnóstico RBAC.

**Fora de escopo**

- Não altera RLS de `projects`, `project_tasks` ou `project_milestones`.
- Não cria automação de criação de projeto no ganho do negócio.
- Não expõe nada ao cliente final (portal externo) nesta etapa.
