# Fase 4 — Validação da visibilidade por permissões

Fases 1 a 3 já foram aplicadas (permissões de leitura ampliadas, políticas de leitura normalizadas e server functions lendo por workspace ativo). Esta fase **não altera comportamento**: apenas verifica se o resultado prometido acontece de fato e corrige apenas o que a verificação apontar como quebrado.

## 1. Verificação no banco (antes/depois por usuário real)

Para um usuário membro não-admin real do workspace principal:

- Conferir as permissões efetivas (contagem e presença das chaves `*.view.*` dos módulos Sales, Hire, People, Finance, Projects, Service).
- Contar linhas visíveis por tabela, comparando o total do workspace com o que a política de leitura devolve para esse usuário: `leads`, `deals`, `activities`, `ats_jobs`, `ats_candidates`, `ats_applications`, `ats_interviews`, `ats_scorecards`, `ats_interview_kits`, `contracts`, `contract_templates`, `tickets`, `projects`, `financial_entries`, `customer_invoices`, `custom_properties`, `dashboards`, `financial_recurrences`, `user_files`.
- Conferir linhas órfãs: `workspace_id IS NULL` nas tabelas que passaram a ser filtradas por workspace (registro invisível se houver).

Resultado esperado: contagem visível = contagem do workspace, exceto nas tabelas intencionalmente restritas ao dono (chaves de API, rascunhos pessoais, contas de e-mail/calendário, notificações, preferências de grid, sessões de copilot).

## 2. Verificação na interface (sessão autenticada de preview)

Com um usuário não-admin, abrir e conferir que aparecem registros criados por outras pessoas, com estados de loading/empty/error corretos:

- TechSales: Leads, Negócios, Tarefas
- TechHire: Vagas, Candidatos, Pipeline de candidaturas, Entrevistas, Scorecards, Kits de entrevista
- TechContracts: Contratos e Modelos
- TechService: Tickets
- TechFinance: Lançamentos e Recorrências
- Configuração: Propriedades customizadas, Dashboards, Integrações, Arquivos
- Prospecção: menu e abas visíveis conforme as chaves do cargo

Também conferir que Arquivos lista um upload feito por outro membro (valida o registro por workspace do upload).

## 3. Validações automáticas

`bun run typecheck`, `bun run lint`, `bun run test` e o linter de segurança do banco (revisar achados novos ligados às migrations das fases 1 e 2).

## 4. Correções permitidas nesta fase

Somente o que a validação revelar como defeito direto das fases anteriores:

- gate de permissão com chave inexistente ou sem a variante de workspace (inclui a normalização pendente de `src/lib/prospecting/permission-keys.ts`, onde `QUEUE_VIEW` referencia uma chave que não existe no catálogo);
- leitura ainda presa a `owner_id = usuário logado` que tenha escapado do lote da Fase 3;
- linhas sem `workspace_id` que ficariam invisíveis (backfill aditivo, via migration, quando confirmado);
- estados de loading/empty/error ausentes nas telas conferidas.

Fora de escopo: ampliar criação/edição/exclusão, mudar RLS além de correção pontual apontada pela validação, redesign de tela e filtro por responsável.

## 5. Entrega

Relatório com: permissões efetivas do usuário testado, tabela de contagens antes/depois, telas conferidas com evidência, saída dos comandos de validação, achados do linter de segurança, correções aplicadas e pendências remanescentes.
