## Diagnóstico

O tick retornou `0 aplicações em 0 eventos` porque o engine atual é event-driven: só lê `workflow_events` com `created_at > scoring_cursors.last_event_at`. Para a regra ICP:

- `scoring_cursors.last_event_at` do owner está em `2026-07-21 18:46`.
- Maior `workflow_events.created_at` de `companies` desse owner é `2026-07-17 19:24`.
- Cursor à frente de todos os eventos ⇒ batch vazio ⇒ 0/0.

Além disso, mesmo com cursor zerado o engine só pontua deltas históricos — nunca varre o estado atual da base. Existem 12.295 empresas do owner cujo `industry` casa com "inform / software / desenvolv".

## Objetivo

Ao clicar em **Executar** em `/prospecting?tab=scoring`, o botão deve varrer a base inteira da entidade da regra, avaliar a condição contra o estado atual de cada registro e aplicar pontos idempotentemente. Sem novo botão, sem cursor, sem depender de `workflow_events`.

## Mudanças

### 1. `src/lib/scoring/engine.server.ts` — nova função `runScoringFullScan`

Assinatura:
```ts
runScoringFullScan(supabase: SupabaseClient, opts?: { pageSize?: number })
  : Promise<{ rules: number; scanned: number; applied: number; skipped: number }>
```

Comportamento:
- Lê `scoring_rules` do próprio caller (RLS já filtra por `owner_id`), apenas `enabled = true`.
- Para cada regra, resolve `entity` singular → tabela plural (`lead→leads`, `contact→contacts`, `company→companies`).
- Faz paginação keyset por `id` (`.order('id').gt('id', last).limit(pageSize)`, default 500) na tabela alvo, sem filtro adicional de owner — a RLS da tabela já restringe ao escopo permitido do caller.
- Seleciona `id, score, <campos referenciados pela condição>`. Para simplificar e evitar parser, seleciona `*` (páginas de 500 são aceitáveis) — mantém código curto e robusto a `changed_to`/`is_empty` etc.
- Reutiliza `evalCondition(rule.condition, row, null)` (before = null; operadores dependentes de "before" como `changed_to` simplesmente não casam em full-scan, o que é o comportamento correto — não há delta).
- Quando casa e `points ≠ 0`:
  - INSERT em `score_events` `{ owner_id: rule.owner_id, rule_id, entity, entity_id, points, reason: rule.name }`.
  - Se INSERT falha por unique violation (regex `duplicate key`), incrementa `skipped` e segue.
  - Caso contrário, faz o `SELECT score + UPDATE score = score + points` já existente e incrementa `applied`.
- Contadores agregados por execução e retornados.

Correção adicional em `evalCondition` (bug secundário revelado pelo caso ICP): quando `op = "contains"` e `value` é string com vírgulas, tratar como "contém qualquer" (split por `,`, trim, `some(v => str.includes(v))`). Sem essa mudança, "inform, software, desenvolvimento" nunca casaria, mesmo com full-scan. `contains` sem vírgula mantém a semântica atual.

### 2. `src/lib/scoring.functions.ts` — trocar `runScoringTickNow`

`runScoringTickNow` passa a chamar `runScoringFullScan(context.supabase)` em vez de `tickScoring`. Retorna `{ rules, scanned, applied, skipped }`.

`tickScoring` (event-driven) continua existindo e sendo chamado pelo cron `/api/public/hooks/scoring-tick` — o comportamento agendado não muda, só o botão manual.

### 3. `src/routes/_authenticated/settings.scoring.tsx` — toast

Atualizar a mensagem do toast do botão "Executar" para refletir o novo shape:  
`Tick concluído: X aplicações em Y registros (Z já pontuados)`.

## Escopo "base inteira, independente do owner"

Interpretação: a partir da tela de scoring, o botão aplica a regra sobre **toda a base visível ao usuário** — que na prática, para admins do workspace, é a base inteira do workspace via RLS. Não vou usar `supabaseAdmin` porque isso quebraria isolamento entre workspaces (regra do owner A pontuando dados do workspace B). O RLS de `leads/contacts/companies` já dá o "todos os registros que este usuário enxerga", que é o comportamento desejado.

Se o usuário quiser literalmente "todos os workspaces do planeta pelo botão manual", isso exige uma decisão de segurança separada — não faz parte deste plano.

## Não faz parte deste plano

- Nenhuma migration.
- Sem alteração no cron agendado (`scoring-tick`).
- Sem novo botão na UI.
- Sem mudança em `scoring_cursors` ou em `workflow_events`.

## Como validar

1. `/prospecting?tab=scoring` → clicar **Executar**.
2. Toast deve reportar ~12.295 aplicações para a regra ICP na primeira execução.
3. Reexecutar → 0 novas aplicações, ~12.295 `skipped` (idempotência via unique constraint em `score_events`).
4. Conferir no banco:
   - `select count(*) from score_events where rule_id = '<icp>'` cresce na 1ª execução, estabiliza na 2ª.
   - `companies.score` das empresas que casam foi incrementado em 10 exatamente uma vez.
5. Cron agendado (`/api/public/hooks/scoring-tick`) continua rodando `tickScoring` sem regressão.