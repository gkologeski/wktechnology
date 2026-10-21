# TechProjects — Ciclo 6: operação, desempenho, recuperação, offline, API e assistente

Guia técnico do ciclo 6. Metas de disponibilidade e recuperação aqui são **propostas**; nenhuma
delas está certificada só por existir agendamento, dump ou teste em banco descartável.

## 1. Mudanças de banco

| Migração | Conteúdo |
| --- | --- |
| `0179_techprojects_cycle6_api_offline_ops` | papel `techerp_api_subject` + esquema `techerp_api` (API como o dono da chave), `api_idempotency_keys`, `api_rate_buckets`/`api_rate_hit`, guarda de competência fechada na criação, `project_time_entry_insert_checked`, fila offline (`project_time_client_requests`, `project_time_entry_sync`), `project_ops_status`, `webhook_deliveries.event_id`, revogação de execução anônima em duas consultas de aprovador |
| `0180_techprojects_cycle6_dashboard_performance` | painel C5 em volume: pendências agrupadas antes da checagem, lista de apontamentos indexável, escopo calculado uma vez por transação, previsão agregada direto da tabela |
| `0181_techprojects_cycle6_time_entries_rls_cost` | políticas restritivas de apontamentos avaliadas uma vez por consulta (antes: por linha) |

Todas aditivas (sem apagar/renomear). Rollback compatível: reaplicar a definição anterior de cada
função/política (está em `drizzle/migrations/0173–0177` e no catálogo) — nenhuma migração alterou
dados existentes, então não há dado a reverter. As tabelas novas podem ficar sem uso.

## 2. API como o dono da chave

`/api/public/v1/{projects,project-tasks,time-entries}` autenticam a chave e chamam as portas
`public.project_api_*` (só `service_role` executa). Cada porta chama uma função do esquema
`techerp_api`, cujo dono é `techerp_api_subject` (NOLOGIN, sem BYPASSRLS, membro de
`authenticated`): ela grava as claims do dono da chave, registra a sessão em
`techerp_api.subject_sessions` (presa à transação) e roda as consultas sob a RLS real.
`current_user_workspaces()` usa o workspace da chave só quando há sessão registrada para a
transação e o usuário; marcar a configuração à mão não basta (provado). Contrato: `docs/api-publica-v1.md` §11
e `GET /api/public/v1/openapi.json`.

## 3. Fila offline de apontamentos

- Opt-in por usuário + workspace ("Guardar neste aparelho se a conexão cair"), só para apontamento
  NOVO com atividade já existente. Edição, envio, aprovação, cronômetro e criação de atividade exigem conexão.
- IndexedDB `techerp-offline-v1`: dados mínimos do apontamento, id estável do pedido e hash.
  Sem tokens, custos, respostas do servidor nem cache de telas autenticadas.
- Retenção: 72 h; máximo 50 itens por usuário+workspace; sair/trocar de conta apaga a fila do
  aparelho; vencidos são descartados e a tela avisa quantos se perderam.
- Estados: pendente no aparelho → enviando → sincronizado (só após confirmação do servidor) /
  em conflito (regra de negócio: sobreposição, competência fechada, vínculo, workspace trocado) /
  erro (rede/sessão; nova tentativa com espera crescente). Conflito só volta à fila por ação do usuário.
- Servidor (`project_time_entry_sync`): revalida membership ativo, workspace ativo = workspace do
  pedido, vínculo/vigência, sobreposição, competência fechada e "Ver como"; mesmo id + mesmo conteúdo
  devolve o resultado gravado; conteúdo diferente = conflito. Horário do aparelho só é registrado
  como informação (`device_recorded_at`), nunca vira horário do apontamento nem aprovação.
- Não implementado (fora do escopo seguro): primeira abertura sem conexão, sincronização em segundo
  plano com a aba fechada e cronômetro offline.

## 4. Webhooks

Destino validado no cadastro e antes de cada envio (`src/lib/webhooks/url-guard.ts`): só HTTPS,
porta 443/8443, sem credenciais na URL, sem IP privado/loopback/link-local/metadados, DNS (DoH)
só público. Redirecionamentos não são seguidos; tempo limite de 10 s; destino bloqueado vai direto
para "descartado". Assinatura `X-TechERP-Signature: t=<unix>,v1=HMAC(segredo, "<t>.<corpo>")`,
`X-TechERP-Event-Id` para deduplicar (a assinatura antiga só do corpo continua para receptores
existentes). Evento `project.time_entry.created` só vai para webhooks que um administrador
cadastrou e assinou; nenhum destino é ativado automaticamente.

## 5. Assistente de análise (somente leitura)

`askProjectsAssistant` → ferramentas `resumo_painel` e `listar_registros` (catálogo fixo de
indicadores do painel), executadas com o cliente do próprio usuário. O modelo é chamado por
`aiChatFetch` (provedor configurado no workspace; Lovable AI quando não houver; sem troca
automática). Resultados vão ao modelo num envelope "dados, não instruções", com textos cortados,
sem e-mail/telefone e sem custo quando o perfil não vê custo. Limites: 500 caracteres, 4 consultas
por pergunta, 20 linhas por consulta, 30 s, 30 perguntas/hora por usuário.

## 6. Operação e saúde

- `/projects/settings/operations` (admin ativo): agendamentos esperados, última execução, filas de
  entrega/webhooks, importações e alertas. Nunca devolve comando nem segredo do agendador.
- `GET /api/public/health` (servidor) e `GET /api/public/health/ready` (banco): só situação e latência.
- Logs estruturados JSON (`evt`, `cid`/`X-Request-Id`, rota, status, ms, id da chave) sem chave, corpo nem dados pessoais.

## 7. Recuperação — runbook

**O que a plataforma oferece (documentação pública do Lovable Cloud):** um backup diário do banco,
retenção de até ~14 dias, restauração "no lugar" pelo painel (Database → Backups → Restore to this
backup), sem recuperação a um instante arbitrário (sem PITR), sem arquivos do armazenamento. Não há
ferramenta para o agente ler o inventário real de backups: conferir data/hora do último backup é
pendência do responsável (painel Backups).

**Procedimento de restauração (produção):** 1) exportar o estado atual antes (Database → Settings →
Export data); 2) escolher o snapshot; 3) restaurar (o banco fica indisponível alguns minutos; tudo
depois do snapshot é perdido e o schema volta junto); 4) conferir migrações pendentes e reaplicar
migrações compatíveis; 5) baixar arquivos do armazenamento separadamente (não entram no backup).

**Ensaio executado (banco descartável):** `scripts/isolated-db/backup-restore-drill.sh` — ver §9.

**Metas propostas, NÃO certificadas:** RPO 1 h, RTO 4 h, disponibilidade 99,9%. Com backup diário
e sem PITR, o RPO real hoje é de até ~24 h. Atingir as metas exige configuração e observação
operacional (plano com PITR ou exportação programada, monitor externo do `/health/ready`, alerta
de falha de agendamento) que não foram contratadas nem ativadas neste ciclo.

## 8. Desempenho

Ver §9 (números medidos). Reprodução: `bash scripts/perf/cycle6/run.sh` (variáveis `N_ENTRIES`,
`CLIENTS`, `DURATION`). Banco descartável com `fsync` e `synchronous_commit` ligados.

## 9. Medições

Ambiente: banco descartável PostgreSQL 17 no sandbox (8 CPUs, 31 GB), mesmo schema extraído da
produção + 0179/0180/0181. Dados 100% sintéticos. Não é medição de produção nem SLA.

**Volume:** 1.000.000 apontamentos (1.062.144 ao fim, com as gravações do teste), 400 pessoas,
40 projetos, 2.000 tarefas. 100 sessões simultâneas por 60 s em cada cenário, `pgbench`.

| Cenário (100 sessões) | Transações | Falhas | p50 | p95 | p99 | máx | Meta |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Gravação de apontamento (RLS do usuário) | 60.646 | 0 | 59 ms | 232 ms | 868 ms | 4,4 s | p95 ≤ 1 s — atingida |
| Painel "Meu trabalho" (mês) | 8.961 | 0 | 634 ms | 989 ms | 1,23 s | 2,3 s | p95 ≤ 2 s — atingida |
| Lista da API (porta `project_api_list_entries`) | 10.740 | 0 | 566 ms | 651 ms | 792 ms | 1,2 s | — |
| Misto 3 gravação : 6 meu trabalho : 1 equipe | 5.005 | 0 | | | | | |
| — gravação | 1.498 | 0 | 147 ms | 483 ms | 772 ms | 1,3 s | atingida |
| — meu trabalho | 3.064 | 0 | 616 ms | 792 ms | 1,19 s | 1,8 s | atingida |
| — equipe (admin, todo o workspace) | 443 | 0 | 9,2 s | 9,8 s | 10,2 s | 10,3 s | **não atingida** |

Execução isolada (1 sessão): equipe 788 ms frio / 694 ms quente; meu trabalho 71 / 70 ms.
Nenhum pedido duplicado na fila offline durante a carga (`duplicate_client_requests = 0`).

Antes das correções (mesmo fixture): "meu trabalho" com 100 sessões p95 65,7 s (a pendência de
aprovação checava permissão 166.667 vezes); a lista da API não terminava. 0180 resolveu o painel;
0181 tirou a checagem de permissão por linha da RLS de apontamentos (gravação foi de 738 para
1.010 transações/s).

**Limite conhecido:** a visão "Equipe" do admin soma o consumo de horas de TODO o histórico por
projeto para a previsão (≈ 530 ms de CPU por chamada com 1 milhão de linhas). Com 10 dessas
consultas ao mesmo tempo e mais 90 sessões, as 8 CPUs saturam. Próximo passo sugerido (não
implementado): consumo por projeto mantido por gatilho ou recalculado pelo agendador.

Os tempos são só do banco (SQL). HTTP e navegação não foram medidos sob carga; o caminho HTTP real
(GoTrue + PostgREST + funções da API) foi provado em funcionalidade (`scripts/isolated-db/stack/run-cycle6.sh`).
Na WK (112.490 apontamentos, ~9× menos) os tempos devem ser menores, mas não foram medidos sob carga
para não pesar o banco compartilhado.

**Ensaio de backup/restauração** (`scripts/isolated-db/backup-restore-drill.sh`): origem
descartável com schema + seed sintético + 20 anexos sintéticos privados; `pg_dump` formato
custom (4,3 MB, 0,4 s) → restauração em outro cluster (4,6 s, 0 erros). Conferidos idênticos:
contagem e hash de 436 tabelas/verificações, políticas, privilégios de tabelas e funções, donos,
papéis, visibilidade por RLS de 8 perfis, hash dos 20 anexos e um fluxo após a restauração (API
como dono da chave + repetição idempotente). Isto prova o procedimento e o schema; NÃO prova o
backup gerenciado da plataforma.
