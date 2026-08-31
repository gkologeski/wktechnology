# Fase 4 (processo de entrega) + guarda de exclusão em Contratos, ATS, People e Substatus

## Estado verificado agora

- `docs/plan-templates.md` já existe e contém os três templates (bug, feature, refactor) e a regra de contenção de escopo. Falta apenas referenciá-la no runbook e trocar a ideia de `docs/templates/*.md` por esse arquivo único.
- `docs/operations-runbook.md` **não** cita a regra de escopo de plano (nenhuma ocorrência encontrada).
- `docs/polimento-semanal.md` **não** existe.
- `docs/backlog-pendencias.md` está com última atualização em 2026-07-21 e sem marcação do que fica congelado.
- Exclusão já guardada (verificado no código): contrato principal em `src/lib/contracts.functions.ts`, substatus em `src/lib/pipelines/substatuses.ts` e pipelines em `settings.pipelines.tsx`. Ou seja, "contratos" e "tela de substatus" já estão cobertos no caminho principal.
- Ainda sem verificação de linhas afetadas: **16 pontos no ATS** (`scheduling` 3, `sourcing-sequences` 2, `talent-crm` 2, e 1 cada em `async-video`, `candidate-detail`, `fraud`, `hunting`, `interview-kits`, `offers`, `scorecards`, `stage-emails`, `whatsapp-meta`), **12 em People** (`onboarding` 3, `performance` 3, `wellbeing` 2, e 1 cada em `allocations`, `benefits`, `documents`, `timesheet`) e **1 em Contratos** (`contracts/templates.functions.ts`, um segundo delete no arquivo).
- Credenciais `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` estão presentes no ambiente (um único usuário).

## Parte A — Guarda de exclusão (29 pontos)

Trocar `supabase.from(t).delete().eq(...)` sem verificação por `deleteByIdGuarded` (de `src/lib/db/delete-guarded.ts`), que já lança mensagem de permissão quando 0 linhas são afetadas.

1. **Contratos** — restante em `src/lib/contracts/templates.functions.ts`.
2. **ATS** — os 12 arquivos listados acima (16 pontos).
3. **People** — os 7 arquivos listados acima (12 pontos).
4. **Substatus / pipelines** — nada a alterar; confirmar por leitura e registrar como já conforme.

Casos que não seguem o padrão `eq("id", ...)` (exclusão por `eq("candidate_id", ...)`, `in(...)` ou limpeza de filhos antes de reinserir) recebem tratamento explícito: quando a exclusão é *idempotente por natureza* (limpar filhos antes de regravar), mantém-se sem guarda, com comentário dizendo o motivo; quando é ação do usuário sobre um registro, ganha `.select("id")` + erro de permissão.

Sem mudança de RLS, schema, permissões ou UX. O efeito visível é a mensagem correta quando a exclusão é negada, em vez de "excluído" falso.

## Parte B — Processo de entrega (Fase 4)

1. Registrar em `docs/operations-runbook.md` uma seção curta "Escopo de plano" apontando para `docs/plan-templates.md`: plano de correção simples não expande para schema, RLS, permissões, autenticação ou regra de negócio sem nova aprovação; se a investigação exigir isso, o plano para e abre-se um plano `refactor`/`feature`.
2. Criar `docs/polimento-semanal.md` como fila única de ajustes pequenos de UI (tabela: item, tela, sintoma, prioridade, estado), já semeada com os ajustes de UI conhecidos que hoje não têm plano próprio.
3. Repriorizar `docs/backlog-pendencias.md`: atualizar a data, marcar como **congelado** o que depende do fechamento da Fase 3 e destacar o que segue ativo.
4. Ajustar `docs/plan-templates.md` apenas para citar o `polimento-semanal.md` como destino dos bugs de UI acumulados.

## Parte C — E2E por papel

Executar `tests/e2e/permission-visibility-roles.spec.ts` e `tests/e2e/permission-visibility.spec.ts` com o usuário disponível e registrar o resultado real em `docs/workspace-isolation-compliance.md`.

Existe apenas um par de credenciais no ambiente, então a cobertura possível é do papel desse usuário. O spec já lê as permissões efetivas via `current_user_permissions` e valida coerência para qualquer papel, então a execução vale como verificação real desse papel; a cobertura de admin/manager/member simultâneos fica registrada como pendência explícita, com o formato de variáveis necessário documentado (`E2E_ADMIN_*`, `E2E_MANAGER_*`, `E2E_MEMBER_*`) — sem inventar resultado de papel não executado.

## Fora de escopo

- Alterar RLS, políticas, schema, autenticação ou regra de negócio.
- Redesenhar telas ou remover funcionalidade.
- Criar usuários de teste no banco de produção para simular papéis.

## Validação

- `bun run typecheck:inc`, `bun run lint`, `bun run test` após a Parte A.
- Execução dos dois specs E2E na Parte C, com saída registrada (inclusive falhas, se houver).
- Conferência manual: excluir um item de ATS (kit de entrevista, scorecard, agendamento), de People (documento, benefício, tarefa de onboarding) e um modelo de contrato — como usuário com permissão (exclui) e sem permissão (mensagem de permissão).
