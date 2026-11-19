# Pacote 4 · Lote A — INICIO-EXECUCAO (preparado, não aplicado)

Base: main 8678580ee (pacote 3 publicado, 0375–0380 aplicadas). Migração **preparada** em
`docs/architecture/prepared-migrations/0381_hiring_execution_start.sql`, fora do journal Drizzle. Não aplicada, não publicada.

## Auditoria dos pontos de adaptação

| Ponto | Situação atual | Adaptação no lote A |
| --- | --- | --- |
| `hiring_engagements.job_id`, `model_version_id` NOT NULL (0311) | Vínculo só nasce da admissão ATS | Colunas anuláveis + `hiring_request_id`; CHECK `hiring_engagement_origin` mantém vaga+modelo obrigatórios para toda origem ATS e proíbe vaga/candidatura na origem direta |
| `hiring_allocation_guard` (0312) — joins `ats_jobs`, `hiring_recruitment_reason` | Exige vaga | Ramo novo só quando `hiring_request_id` existe → `hiring_execution_allocation_assert`; ramo ATS idêntico byte a byte (teste) |
| `hiring_allocate` (0312) | Genérico por vínculo, idempotente | Reutilizado sem alteração |
| `hiring_formalization_origin_guard` (0377) | Bloqueio total de `active` ("pacote 4") | `active` apenas com `hiring_execution_starts` do contrato, hash atual e assinatura íntegra, sem outra coluna alterada na transição |
| `hiring_set_live`, `hiring_allocation_scope` (0312/0321) | Join `ats_jobs`/modelo | Sem alteração: vínculo direto sem modelo nunca fica "live" → nenhum IAM implícito |
| `hiring_employment_invite`, lifecycle 0321 (`hiring_lifecycle_*`, `hiring_employment_end`) | Dependem de `job_id` | Sem alteração: falham fechados na origem direta (pendência explícita para lote futuro) |
| `hiring_formalization_current/valid/signed` (0376/0379) | Fronteira de aprovação/assinatura atual | Reutilizados como pré-condição; rechecam os dois aprovadores e a alçada |
| `hiring_purchase_guard` (0380) | Preserva pessoa/CNPJ do contrato vinculado | Sem alteração; passa a proteger o contrato do vínculo direto |
| `hiring_area_policies` | Gestor/CEO/substitutos | Lido, nunca alterado; CEO não é fallback; substituto só quando o gestor é o autor |

## Implementado

- Chaves novas (catálogo + `permission-contracts.json`, sem regenerar baseline):
  `techpeople.hiring_requests.execution.approve.workspace`,
  `techcontracts.supplier_requests.execution.approve.workspace`. Sem concessão automática a cargos.
- Tabela imutável `hiring_execution_starts` (revisão, aprovação, hash do contrato, evidência, CNPJ WK, snapshot da alçada, período, justificativa, operação idempotente, autor). RLS de leitura pelo acesso à solicitação; sem INSERT/UPDATE/DELETE para `authenticated`.
- RPC `hiring_execution_start`: membro ativo no workspace ativo, sem "ver como", chave específica, deny prevalece, gestor atual (nunca CEO/autor), revisão esperada, aprovação vigente, formalização íntegra, assinatura verificável, vigências do instrumento e do contrato comercial (origem cliente), justificativa; serializa por `hiring_formalization_lock`; idempotente por operação. Profissional: cria vínculo direto (sem vaga/modelo/IAM). Fornecedor: nenhum vínculo/pessoa. Ativa o contrato. Evento `execution_started`.
- `hiring_execution_context`: leitura sem efeitos (status, pendência útil, gestor, vigência, início, vínculo, alocações apenas com `techpeople.employment.view`).
- Alocação de origem direta: início autorizado, assinatura íntegra atual, contrato ativo, pessoa/CNPJ, período do vínculo/instrumento/comercial, projeto do workspace com CNPJ coerente, capacidade ≤100% por pessoa com advisory lock (duas conexões).
- UI: `ExecutionPanel` na lateral (ação), `ExecutionHistory` no centro; White Label/design system existentes; `IsoDatePicker`.
- Ajuda v8 dos dois guias preparada no catálogo; **não aplicada**.

## Testes executados

- `src/lib/hiring/requests/execution-postgres.test.ts` — 17/17 em PostgreSQL descartável com funções reais
  (0373–0380 + 0381 preparada, `hiring_allocate`, `hiring_employment_access`, assinatura nativa real).
- `src/lib/hiring/requests/execution-presentation.test.ts` — 2/2.
- `bun run permissions:check` — único achado restante é `src/integrations/supabase/types.ts` (pré-existente, fora deste lote).
- `bun run help:coverage` — 254/254.

## Limitações e pendências

- Migração não aplicada; preflight em schema real, CI e revisão independente pendentes.
- `ALTER COLUMN ... DROP NOT NULL` é mudança de restrição (o CHECK novo preserva a obrigatoriedade para ATS).
- Lifecycle (encerramento/renovação/substituição) e convites para vínculo direto continuam bloqueados (falham fechados) — lote futuro.
- Não há revogação/alteração do início neste lote (registro imutável; mudanças exigem aditivo e fluxo próprio).
- `contract_accepted_draft_guard`/`contract_handoff_source_event` de produção não estão no banco de teste; validar no preflight.
- Regime divergente da pessoa bloqueia com orientação; não há campo novo de cargo/modelo na demanda (o vínculo direto não exige modelo, pois não concede IAM).
- Entregas, aceite, NF, parcelas, provisão e contas a pagar: lotes seguintes.

## Revisão independente local (19/11)

- Corrigida a asserção da corrida de alocação: o teste reutiliza a transação vencedora e sua data SQL canônica, sem presumir ordem nem converter a data pelo fuso do driver.
- A assinatura jurídica permanece histórica. Novas alocações passam a exigir também aprovação, revisão e formalização atuais; uma mudança de alçada bloqueia a nova operação sem apagar o início já autorizado.
- A capacidade usa o pico simultâneo por dia; períodos sequenciais não somam entre si. A corrida continua serializada por pessoa e o limite de 100% inclui os dias de fronteira.
- O contexto canônico da pessoa preserva os gates de vínculo/RH e passa a exibir a origem direta sem modelo IAM. A UI permite alocar, mas oculta convite, revisão de modelo e ciclo de vida ATS nessa origem.
- **22/22 testes específicos** e **58/58 regressões** de aprovação/formalização/fronteira passaram em PostgreSQL local descartável. Permissões e lint direcionado aprovados; checagem incremental sem erros.
- Preflight DDL no banco atual executado em transação revertida: tabela/funções criadas, 19 gatilhos do contrato preservados, contexto direto e indicador de ciclo de vida mantidos. Ainda falta o ensaio integrado dos lotes finais, CI, aplicação e publicação.
