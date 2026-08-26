# Conta Azul: progresso em tempo quase real + métricas por workspace

## Credenciais (resposta)

As credenciais do Conta Azul não são inseridas por tela: `src/lib/integrations/contaazul-api.server.ts:42-55` lê `CONTAAZUL_CLIENT_ID` e `CONTAAZUL_CLIENT_SECRET` (e opcionalmente `CONTAAZUL_API_BASE`, `CONTAAZUL_AUTH_URL`, `CONTAAZUL_TOKEN_URL`) de segredos do servidor. Enquanto não existirem, a tela mostra "não configurado" e o botão Conectar fica desabilitado. Vou solicitar o cadastro dos dois segredos obrigatórios como primeiro passo; a conexão da conta em si continua via OAuth no botão **Conectar**.

## Estado verificado

- `src/routes/_authenticated/integrations.contaazul.tsx:61` usa um único `useQuery` sem `refetchInterval`; já existe um botão "Atualizar" no cabeçalho (linha 160) que chama `refetch()`.
- `src/lib/integrations/contaazul.functions.ts:34-39` lê as últimas 5 execuções de `cron_run_logs` filtrando só por `job_name = 'contaazul-tick'` — sem recorte por workspace.
- `cron_run_logs` **não possui coluna `workspace_id`** (colunas: `job_name`, `started_at`, `finished_at`, `duration_ms`, `status`, `metrics`, `error`, `created_at`).
- O tick (`src/routes/api/public/hooks/contaazul-tick.ts`) roda uma vez para todos os workspaces conectados e grava apenas totais agregados (`workspaces`, `imported`, `updated`, `failed`), por isso hoje as métricas na tela são globais.

## O que fazer

### 1. Autoatualização do painel de progresso

- Adicionar `refetchInterval` de 5s ao `useQuery` da tela, ativo somente quando a integração está conectada e há sincronização em andamento ou o painel está visível; pausar quando a aba está em background (`refetchIntervalInBackground: false`).
- Manter um switch "Atualização automática" ao lado do botão Atualizar, com estado local, para o usuário desligar.
- Botão "Atualizar" existente ganha indicador de carregamento (`isFetching`) para dar feedback do refresh manual.
- Sem tela nova: usa `Button`/`Switch` do design system e mantém loading/empty/error atuais.

### 2. Métricas do histórico por workspace

Como o log de cron é global por execução, o recorte por workspace exige registrar o resultado por workspace:

- Migration: adicionar `workspace_id uuid null` a `public.cron_run_logs` com índice `(job_name, workspace_id, started_at desc)`. Coluna opcional — execuções realmente globais continuam com `null`. Sem alterar as policies existentes (tabela é escrita pelo `service_role` e lida por server function admin).
- No tick do Conta Azul, além do log agregado atual, gravar uma linha por workspace processado (`job_name = 'contaazul-tick'`, `workspace_id = owner_id`, métricas do próprio workspace, status e erro individuais). Um erro em um workspace não interrompe os demais.
- `contaAzulStatus` passa a filtrar `cron_run_logs` por `workspace_id = context.workspaceId` (mantendo compatibilidade: se não houver nenhuma linha por workspace ainda, exibe as execuções globais como hoje, marcadas como "execução global").
- O painel passa a rotular a origem da execução (workspace vs. global) para não induzir a erro durante a transição.

## Fora de escopo

- Alterar o motor de sincronização, mapeamentos ou entidades importadas.
- Alterar RLS/policies de outras tabelas, schema financeiro ou regras de negócio.
- Redesenhar a tela de integração.

## Validação

- `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`.
- Manual: abrir `/integrations/contaazul`, disparar "Sincronizar agora" e confirmar que os contadores avançam sozinhos sem recarregar a página; desligar o switch e confirmar que para; clicar em Atualizar e ver o indicador; após uma execução do tick, confirmar que o histórico mostra apenas o workspace atual.
