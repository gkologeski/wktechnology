# Validação, testes e operação

## 1. Comandos

```bash
bun install
bun run dev            # dev server (porta 8080)
bun run typecheck      # tsc --noEmit
bun run lint           # eslint .
bun run format         # prettier --write
bun run test           # vitest run (unitários)
bun run test:e2e       # playwright
bun run build          # build de produção
bun run build:dev      # build de desenvolvimento (valida prerender/SSR)
```

Regra de honestidade: **não afirmar que um teste passou sem tê-lo executado.**
Se o script não existir, informe. Exit code 0 com "Error" na saída conta como
falha.

## 2. O que rodar por tipo de mudança

| Mudança                                    | Rodar                                            |
| ------------------------------------------ | ------------------------------------------------ |
| Só UI/estilo                               | `typecheck`, `lint`                              |
| Server function nova/alterada              | `typecheck`, `lint`, `build:dev`                 |
| Rota nova                                  | `typecheck`, `build:dev` (pega 401 de prerender) |
| Migration / RLS                            | consulta de verificação no banco + e2e afetado   |
| Fluxo crítico (lead, contrato, financeiro) | `test`, `test:e2e` do spec relacionado           |

## 3. Testes existentes

`tests/e2e/` (Playwright, config em `playwright.config.ts`):

- `navigation-smoke.spec.ts`, `public-smoke.spec.ts`
- `contacts-crud.spec.ts`, `deals-crud.spec.ts`, `tasks-crud.spec.ts`
- `lead-convert-flow.spec.ts`, `quotes-smoke.spec.ts`
- `contracts-lifecycle.spec.ts`, `finance-flow.spec.ts`, `projects-psa.spec.ts`
- `confirm-dialogs.spec.ts`
- `workspace-isolation.spec.ts`, `workspace-isolation-ui.spec.ts`
- helpers: `helpers/auth.ts`, `helpers/modules-seed.ts`

Runbooks manuais: `docs/qa/README.md`,
`docs/qa/mvp-modules-manual-runbook.md`.

CI: `.github/workflows/ci.yml`.

## 4. Verificação manual no navegador

Para reproduzir bug de UI ou confirmar fluxo, dirigir Playwright contra
`http://localhost:8080`, restaurando a sessão antes de navegar para rota
protegida. Nunca logar, imprimir ou capturar segredos/tokens.

Roteiro típico de verificação de tela:

1. abrir a rota e confirmar ausência de erro no console;
2. validar loading → conteúdo → empty (com filtro impossível);
3. alternar Tabela|Kanban e conferir persistência no search param;
4. exercitar filtro por Responsável e ordenação de colunas;
5. testar em 1280px e 768px;
6. alternar light/dark.

## 5. Diagnóstico de problemas comuns

| Sintoma                                                                 | Causa provável                                        | Onde olhar                                           |
| ----------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| Registro não aparece para outro usuário do mesmo workspace              | filtro manual de `owner_id` ou política RLS por owner | query da tela + `pg_policies`                        |
| Exclusão "deu certo" mas o registro continua                            | RLS negou o delete silenciosamente                    | usar `deleteRowGuarded`                              |
| Grid mostra vazio e detalhe mostra valor                                | colunas diferentes (`assigned_to` vs `owner_id`)      | alinhar em `assigned_to` + backfill                  |
| 401 no build/prerender                                                  | server fn protegida em loader de rota pública         | mover para componente ou `_authenticated/`           |
| `ReferenceError` em runtime com typecheck verde                         | helper em escopo de módulo de `*.functions.ts`        | mover helper para outro arquivo                      |
| `Could not query the database for the schema cache` / statement timeout | erro transitório ou consulta sem índice               | `withTransientRetry`, criar índice                   |
| `[unenv] X is not implemented yet!`                                     | pacote Node-only no Worker                            | substituir por lib compatível com edge               |
| Automação parada                                                        | fila `workflow_events` inflada ou cron desagendado    | `platform_cron_status`, `cron_run_logs`, drenar fila |
| Erro 500 esporádico em server fn                                        | indisponibilidade transitória                         | retry + verificar logs da função                     |

## 6. Observabilidade

- `cron_run_logs`, `platform_cron_status` — agendador.
- `workflow_runs`, `workflow_events` — automação.
- `webhook_deliveries` — entregas de webhook (com status e retentativa).
- `audit_logs`, `access_audit_log`, `domain_events`, `property_history` —
  trilha de auditoria.
- `bug_reports` + `bug_report_analyses` — chamados internos (rotas
  `/my-bug-reports` e `/admin/bug-reports`); botão flutuante de reporte com
  gravação de tela.
- `security_scan_runs` / `security_scan_findings` — varredura de segurança.
- `ip_access_log`, `email_send_log`, `email_tracking_events`.

## 7. Performance

- Build e typecheck são sensíveis a selects Supabase muito largos: projete
  colunas e reutilize tipos de `src/lib/db-types.ts`.
- Rotas pesadas usam lazy import (editor, gráficos, workflow builder).
- Kanban com muitos cards (>500) precisa página menor ou virtualização.
- Índices dedicados para consultas quentes (padrão do nome:
  `<tabela>_<recorte>_idx`).
- Antes de otimizar, medir: `supabase--slow_queries` e o log do dev server.

## 8. Operação e dados

- Backfill sempre em migration explícita ou script auditado, com `WHERE`
  restritivo e contagem antes/depois.
- `purge_workspace` remove um tenant inteiro — operação destrutiva, só com
  pedido explícito.
- Chaves e senha de banco não são acessíveis; não pedir ao usuário nem
  inventar valor.
- Procedimentos de plantão: `docs/operations-runbook.md`.

## 9. Relatório final de cada entrega

Toda implementação encerra com: resumo, escopo confirmado, arquivos
criados/alterados/removidos, problemas encontrados na revisão, correções,
validações executadas (comando + resultado), testes impactados, banco/migrations
/permissões, segurança e privacidade, UX/UI e acessibilidade, riscos
remanescentes, pendências, como validar manualmente e próximo passo recomendado.
