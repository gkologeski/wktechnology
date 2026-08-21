# Fase 3 — Coerência no aplicativo (visibilidade por permissão)

## O que a verificação no banco e no código mostrou

- Os gates citados originalmente (**serviços**, **modelos de contrato**, **presets**, **perfis de cargo**) já aceitam a chave de workspace além da chave `own` — conferido em `services.functions.ts`, `contracts/templates.functions.ts`, `contracting-presets.functions.ts` e `job-profiles.functions.ts`.
- Todas as chaves de permissão usadas literalmente no código existem em `permissions` (161 chaves conferidas, nenhuma faltando), e um membro comum não-admin do workspace principal já recebe as chaves `*.view.workspace` dos módulos Sales, Hire, People, Finance, Projects, Service, com `user_data_scope = workspace`.
- **A causa real de telas vazias que resta é outra**: cerca de 125 pontos em ~35 arquivos de server function ainda filtram a leitura por `owner_id = usuário logado`, ignorando permissões e workspace. Confirmado no banco que nessas tabelas `owner_id` guarda o **id do usuário criador** (nunca igual a `workspace_id`), e todas elas já possuem `workspace_id`. Ou seja: mesmo com permissão ampla, o usuário só vê o que ele mesmo criou.

Exemplo verificado (`listScorecards`): consulta `ats_scorecards` com `.eq("owner_id", userId)` e sem qualquer gate de permissão.

## Objetivo da fase

Fazer as server functions lerem por **workspace ativo + permissão**, em vez de "sou o criador", sem alterar RLS, schema, nem introduzir filtro por responsável em telas.

## Escopo — lotes

Em cada função de **leitura**: trocar `.eq("owner_id", userId)` por `.eq("workspace_id", workspaceId)` (via `resolveActiveWorkspace`) e adicionar/ajustar o gate `assertAnyPermission` com as chaves `view` (`workspace`, `team`, `own`) do recurso. Em **escrita**: manter a regra atual, apenas trocando o filtro de escopo por `workspace_id` quando o usuário tiver a chave de `update`/`delete` em escopo workspace; sem ampliar quem pode escrever além do que as chaves já permitem.

1. **TechHire** — `ats/scorecards`, `ats/interview-kits`, `ats/stage-emails`, `ats/interviews`, `ats/async-video`, `ats/hunting`, `ats/unipile-hunting`, `ats/fraud`, `ats/analytics`, `ats/dashboard`, `ats/export`, `ats/cv-parse*`, `ats/lgpd` (esta última mantém restrição para dados sensíveis de titular, apenas admins/DPO).
2. **Core / configuração compartilhada** — `custom-properties`, `custom-objects`, `property-groups`, `dashboards`, `sequences`, `webhooks`, `files`, `sentiment`, `ml-scoring`, `finance-recurrences`.
3. **Integrações** — `integrations/core`, `integrations/hubspot-steps.server`, `hubspot-sync`, `hubspot-relink`, `hubspot-reconcile*`, `unipile/accounts`, `unipile/observability`. Leitura de estado/logs passa a ser por workspace; criação/edição de conexão continua exigindo a chave de gestão de integrações.
4. **Permanecem restritos ao dono** (nenhuma mudança): `api_keys`, `message-drafts` (rascunho pessoal), `chat.functions`, `bug-reports` do próprio usuário, notificações, preferências de grid, contas de e-mail/calendário.

## Normalização das chaves de prospecção

`CADENCES_VIEW` e `QUESTIONNAIRES_VIEW` em `src/lib/prospecting/permission-keys.ts` listam só a chave sem escopo e a `own`; `QUEUE_VIEW` referencia `techsales.prospecting.queue.view.workspace`, que **não existe** no catálogo. Ajuste: alinhar as listas às chaves realmente existentes (`...view`, `...view.own`, `...view.team` quando houver) e remover a referência inexistente, evitando gate que nunca casa.

## Fora de escopo

- Nenhuma tela passa a filtrar por responsável; o filtro "Responsável" continua opcional nos grids.
- Sem mudanças de RLS, schema, autenticação ou regra de negócio.
- Sem ampliar permissões de criação, edição ou exclusão.

## Detalhes técnicos

- Padrão por handler: `const workspaceId = await resolveActiveWorkspace(userId)` → `assertAnyPermission(supabase, userId, workspaceId, VIEW)` → consulta com `.eq("workspace_id", workspaceId)`.
- Listas de chaves ficam em constantes no topo do arquivo apenas quando ele **não** for `*.functions.ts`; nos `*.functions.ts` as chaves entram como literais dentro do handler ou vêm de módulo auxiliar (`permission-keys.ts`), respeitando a regra de casca fina.
- Escritas continuam usando `deleteRowGuarded` onde já é usado.

## Validação

- Query comparando, para um membro não-admin real, a contagem de linhas visíveis antes/depois em scorecards, kits de entrevista, dashboards, propriedades customizadas, integrações e recorrências financeiras.
- Sessão de preview autenticada como membro comum (Playwright) nas telas de Scorecards, Entrevistas, Propriedades, Dashboards e Integrações.
- `bun run typecheck`, `bun run lint`, `bun run test`.

## Riscos

- Ampliar leitura de configuração e integrações expõe, dentro do workspace, dados operacionais a todos os membros com a chave `view` — comportamento pedido; restrição futura é feita removendo chaves dos cargos.
- Tabelas com linhas antigas sem `workspace_id` ficariam invisíveis após a troca de filtro; a verificação de linhas órfãs entra como primeiro passo de cada lote (as amostradas hoje estão 100% preenchidas).
