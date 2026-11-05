> Registro histórico do rascunho remoto, sem publicação. A implementação final e a adoção sem perda desse schema estão em [hiring-integration-stage6.md](hiring-integration-stage6.md). As limitações abaixo descrevem apenas aquele rascunho.

# Etapa 6A — evidências e limitações

## Preparado/aplicado
- Painel existente EmploymentPanel: prévia, solicitação, decisão gestor → CEO e execução por origem. Datas IsoDatePicker, tokens existentes, negação por chave.
- Schema aplicado pelo instrumento de migrations. Consulta posterior: schema presente, 7 chaves, 0 requests e 0 workspaces com gate ativo. Sem operações reais ou publicação.
- 30 testes direcionados passaram: `bunx vitest run src/lib/hiring/lifecycle-postgres.test.ts src/lib/hiring/employment-worker.test.ts src/lib/hiring/employment-registration.test.ts`. 23 usam PostgreSQL local descartável com dados sintéticos. Incluem cinco cenários de autorização, enum real, renovação/substituição, horas/corte, assinatura, CAS, privacidade e bloqueio financeiro.
- `bun run permissions:check`: passou, findings=[]; baseline preservado.
- ESLint direcionado: 0 erros, 3 avisos de tamanho (EmploymentPanel, LifecyclePanel, teste PostgreSQL).
- `git diff --check`: passou. Telemetria do preview: build OK em 19:56:27 UTC.
- Playwright abriu /people?view=table, título Pessoas · TechPeople. Isso é smoke somente, não validação visual do ciclo completo.

## Não certificado / desvios
- Instrumento gerou `0305_hiring_lifecycle_governance.sql`, pois o journal gerenciado terminava em 0304, embora os arquivos manuais 0306–0320 já estivessem no projeto. Não atendeu 0321+. Não reescrevi migrações antigas nem alterei o journal manualmente; requer reparo autorizado do histórico antes de aceitação do pacote.
- `bun run perf:check` falhou: `.verification/build.json` ausente. Verify global, typecheck global e build manual não executados neste ambiente; não há certificação desses gates.
- Não houve submissão/aprovação/execução real no navegador, conforme proibição de QA operacional. O ciclo inteiro foi exercitado somente em PostgreSQL descartável.
- Plano financeiro explícito continua BLOQUEADO; não há cancelamento automático por vencimento nem seleção operacional de compromissos. Financeiro gestor → CEO será separado antes de qualquer liberação.
- Não publicado. Etapa 6B fora do pacote.

## Arquivos
Criados: lifecycle-panel.tsx; lifecycle.types.ts; lifecycle.functions.ts; lifecycle-postgres.test.ts; tests/fixtures/hiring-stage6.sql; migration 0305 e snapshot gerados; este relatório.
Alterados: employment-panel.tsx; actions-offboarding.server.ts; hiring/AGENTS.md; permission-contracts.json; permission-key-catalog.json; roadmap.md; journal e types gerados.
Removidos: nenhum. Diferença inicial de types sobre ccd3be8dc preservada.

## Validação manual posterior
Após regularizar o histórico e gates: em ambiente isolado com gate ativo e chaves atribuídas explicitamente, abrir vínculo no TechPeople, calcular prévia, solicitar, decidir como gestor e depois CEO, executar e conferir períodos/acessos. Testar mesma URL com sem chave/deny/outro workspace/inativo. Não usar operações reais para QA.
