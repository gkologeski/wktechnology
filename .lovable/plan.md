# Conta Azul: agendamento a cada 6 h + painel de progresso da sincronização

## Situação verificada

- A rota `src/routes/api/public/hooks/contaazul-tick.ts` já existe, exige `Authorization: Bearer CRON_SECRET` (`requireCronAuth`) e roda envolvida por `runCronWithLogging("contaazul-tick", ...)`, gravando em `cron_run_logs`.
- Em `cron.job` **não existe** nenhum job `contaazul-tick` hoje (21 jobs cadastrados, nenhum aponta para esse endpoint). A função `reschedule_lovable_cron` mantém uma lista fixa de jobs e também não inclui o Conta Azul.
- A tela `/integrations/contaazul` já mostra, por entidade, "última sincronização / registros / erro" a partir de `contaazul_sync_state`, mas em texto corrido, sem totais, sem indicação de execução automática e sem histórico de execuções.

## O que será feito

### 1. Agendamento a cada 6 horas

- Registrar o job `contaazul-tick` com `cron.schedule('contaazul-tick', '0 */6 * * *', ...)`, chamando `POST /api/public/hooks/contaazul-tick` com o header `Authorization: Bearer <CRON_SECRET>` (mesmo padrão dos ticks existentes). Executado por SQL de dados (não migration), pois contém segredo.
- Incluir `contaazul-tick` na lista de jobs de `reschedule_lovable_cron`, para que um reschedule futuro não apague o agendamento (migration dedicada, apenas substituindo a função).
- Validar depois em `cron.job` e em `cron.job_run_details` / `cron_run_logs` que a execução ocorre e retorna 200 (sem workspace conectado, o tick apenas retorna contadores zerados).

### 2. Painel de progresso na tela de integração

Na tela `/integrations/contaazul`, uma nova seção "Progresso da sincronização":

- **Resumo (MetricCard)**: total de registros importados, total com erro, entidades sincronizadas e horário da última sincronização.
- **Tabela por entidade** (as 6 entidades): estado (`Sincronizado`, `Com erros`, `Nunca sincronizado`) via `StatusBadge`, registros importados, falhas, última sincronização e mensagem de erro (truncada, com tooltip no texto completo).
- **Execuções automáticas**: últimas execuções do job `contaazul-tick` lidas de `cron_run_logs` (início, duração, status, métricas de importados/atualizados/falhas, erro), deixando claro que o agendador roda a cada 6 horas.
- Estados obrigatórios: loading (skeleton fiel), empty ("nenhuma sincronização ainda"), error com ação de tentar novamente; PT-BR, tokens semânticos, responsivo, dark mode, foco visível.
- Enquanto uma sincronização manual está em andamento, o botão mostra estado ocupado e a seção é revalidada ao concluir (invalidate da query `["contaazul"]`).

## Detalhes técnicos

- `contaAzulStatus` (em `src/lib/integrations/contaazul.functions.ts`) passa a devolver também `cronRuns`: últimas 5 linhas de `cron_run_logs` com `job_name = 'contaazul-tick'` (via `supabaseAdmin`, dentro do handler), além do `syncState` já retornado. Nenhuma mudança de assinatura quebrando os campos atuais.
- Nova apresentação em `src/components/contaazul/contaazul-sync-progress.tsx` (componente puro, recebe `syncState` e `cronRuns` por props — sem acesso a dados), consumido por `src/routes/_authenticated/integrations.contaazul.tsx`.
- Componentes oficiais: `SectionHeader`, `MetricCard`, `StatusBadge`, `EmptyState`, `Skeletons` de `@/components/techhire/ui`; tabela com os primitivos existentes de `@/components/ui/table`.
- Sem alteração de RLS, schema de dados ou regra de negócio. Ações continuam sob `<Can any={INTEGRATIONS_MANAGE}>`.
- Validação ao final: `bunx tsgo --noEmit`, `bun run lint`, `bun run test`, `bun run build`, mais consulta ao `cron.job` e ao `cron_run_logs` para confirmar o agendamento.

## Pendências conhecidas

- Sem as credenciais do app Conta Azul (`CONTAAZUL_CLIENT_ID` / `CONTAAZUL_CLIENT_SECRET`) e sem workspace conectado, o job roda mas não importa nada — o painel mostrará execuções com contadores zerados.
- O `CRON_SECRET` já existe no ambiente do servidor; se não estiver configurado, o endpoint responde 500 e o agendamento precisa ser refeito após cadastrá-lo.
