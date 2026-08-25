# Aplicar escopos "Meus/Minhas" e "Da minha equipe" em Atividades

Hoje as permissões de escopo de Atividades existem no catálogo e aparecem em `/settings/permissions`, mas **não têm efeito nas consultas**: qualquer membro do workspace enxerga todas as atividades. O objetivo é fazer o escopo valer de verdade na leitura, edição e exclusão.

## Situação atual (verificada no banco)

- A regra de leitura de `activities` filtra apenas por workspace, sem nenhuma checagem de escopo/permissão.
- A regra de exclusão usa a chave errada no ramo "próprio" (chave de edição em vez de exclusão) e ignora o escopo de equipe.
- A regra de edição também ignora o escopo de equipe.
- O responsável da atividade é o campo `owner_id` e aponta sempre para um usuário (nenhum registro nulo em 433.601 atividades). Atividades não possuem coluna separada de "responsável atribuído".
- Concessões atuais usam somente escopos "todos" e "próprio"; nenhum cargo usa ainda o escopo de equipe.
- Equipe continuará sendo definida pelos grupos de usuários existentes (3 grupos, 7 vínculos hoje).

## O que será feito

### 1. Regras de acesso do banco (migration)

Reescrever leitura, edição e exclusão de Atividades para respeitar as chaves granulares:

- **Todos**: quem tem a chave de escopo "todos" (ou é dono/administrador do workspace) vê e age sobre tudo do workspace.
- **Da minha equipe**: vê e age sobre atividades cujo responsável compartilha grupo com o usuário (além das próprias).
- **Meus/Minhas**: vê e age somente sobre atividades em que é o responsável.
- Corrigir a chave errada na exclusão e incluir o ramo de equipe em edição e exclusão.
- A criação continua exigindo que o responsável seja o próprio usuário (sem mudança).

### 2. Rede de segurança nas concessões

Migration aditiva: cargos e conjuntos de permissão que hoje **não têm nenhuma** chave de visualização de Atividades recebem "Meus/Minhas" (visualizar), para ninguém perder o próprio histórico. Nenhuma concessão existente é removida ou alterada.

### 3. Consultas do aplicativo

- Reaproveitar o helper de escopo já existente para limitar leituras server-side de Atividades por responsável permitido, nos caminhos que usam o cliente autenticado (timeline agregada, resumos de IA, copiloto).
- Caminhos que usam cliente privilegiado (sincronizações, webhooks, workers) permanecem restritos ao registro em que operam; não passam a listar atividades para usuários.

### 4. Interface

- Em Tarefas e nas listas de Atividades, o filtro de Responsável passa a refletir o escopo efetivo: com escopo "próprio", só "Meus registros"; com escopo de equipe, apenas colegas do grupo; "Todos os responsáveis" somente com escopo "todos".
- Estados vazios com texto claro quando o escopo limita o resultado (nada de "nenhum registro" ambíguo).
- Sem alteração visual fora desse filtro.

### 5. Validação

- Testes de unidade do mapeamento de escopo (chave -> filtro esperado).
- Verificação no banco simulando cada cargo: contagem de atividades visíveis para um usuário com escopo próprio, de equipe e total.
- Rodar typecheck, lint, testes e build.

## Detalhes técnicos

- Migration única com `DROP POLICY`/`CREATE POLICY` para SELECT/UPDATE/DELETE em `public.activities`, usando `user_has_permission(auth.uid(), workspace_id, <key>)`, `shares_team_with(owner_id, auth.uid())` e bypass para `is_workspace_admin_of`. Sem subconsulta na própria tabela (evita recursão).
- Chaves: `techsales.activities.{view,update,delete}.{own,team,workspace}`.
- Backfill de concessões via operação de dados (não schema), inserindo `techsales.activities.view.own` apenas onde não existe nenhuma chave de view.
- Filtro server-side por `getAllowedOwnerIds` de `src/lib/access-control/scope.server.ts` (`.in("owner_id", ids)`), aplicado em `src/lib/ai-summaries.functions.ts`, `src/lib/copilot.functions.ts` e nas leituras de timeline com cliente autenticado.
- UI: novo prop de restrição em `src/components/entity/assignee-filter.tsx` alimentado por `useDataScope`/permissões, consumido em `src/routes/_authenticated/tasks.tsx` e no timeline de atividades.

## Riscos e pendências

- Usuários com cargos sem chaves de Atividades passam a ver apenas as próprias atividades (comportamento pedido).
- O escopo de equipe só produz resultado útil onde há grupos de usuários cadastrados; hoje a cobertura é pequena e pode exigir cadastro de grupos.
- Leitura de atividades pelo cliente do navegador passa a depender da regra do banco; se algum cargo ficar sem chave, o ajuste é feito em `/settings/permissions`.
