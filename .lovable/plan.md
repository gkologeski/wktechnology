## Objetivo

Adicionar um novo tipo de passo `wait_invite_accept` nas sequências de sourcing (Unipile/LinkedIn) que pausa o avanço até o convite anterior ser aceito, com janela máxima configurável em dias. Se expirar sem aceite, a sequência segue um caminho definido (pular passos de mensagem, encerrar ou continuar).

## Modelo de dados

**`ats_sourcing_sequence_steps`** — novo canal e campos de configuração:
- `channel` aceita novo valor: `wait_invite_accept`
- Novas colunas (nullable, aplicam-se ao passo `wait_invite_accept`):
  - `max_wait_days` int — janela de monitoramento (default 14, limite 30)
  - `poll_interval_hours` int — frequência de checagem (default 12, mínimo 6 para respeitar rate limit Unipile)
  - `on_timeout` text — enum `skip_messages` | `end_sequence` | `continue` (default `end_sequence`)

**`unipile_message_log`** — passa a persistir o convite para permitir consulta de status:
- `provider_invite_id` text
- `accepted_at` timestamptz
- `status` já existe (`sent` | `accepted` | `failed`); acrescentar `pending`

**`ats_sourcing_enrollments`** — controle do gate:
- `waiting_since` timestamptz — quando entrou no passo de espera
- `waiting_for_invite_log_id` uuid — referência ao convite monitorado

## Worker (`sourcing-sequences-worker.server.ts`)

1. Ao processar um passo `linkedin_invite`, capturar `provider_invite_id` retornado pela Unipile e gravar em `unipile_message_log` com `status='pending'`.
2. Ao encontrar um passo `wait_invite_accept`:
   - Localiza o último `linkedin_invite` da mesma enrollment.
   - Se `status='accepted'` → avança para o próximo passo imediatamente.
   - Se `status='pending'` e `now - sent_at < max_wait_days`:
     - Reagenda `next_run_at = now + poll_interval_hours`.
     - Não conta como envio (não incrementa daily limit).
   - Se expirou (`> max_wait_days`):
     - `skip_messages` → pula todos os próximos passos `linkedin_message` até achar outro canal ou fim.
     - `end_sequence` → marca enrollment `completed` com `last_error='invite_not_accepted'`.
     - `continue` → segue normalmente.

## Sincronização de aceites (novo cron)

- Nova rota `src/routes/api/public/hooks/unipile-invites-sync.ts` (autenticada via `requireCronAuth`).
- Executa a cada 2h via `pg_cron`.
- Busca `unipile_message_log` com `kind='invite'` e `status='pending'` dos últimos 30 dias.
- Consulta relação/status via Unipile (endpoint de `relations` ou `invitations/sent`) agrupado por `account_id` para respeitar rate limit.
- Atualiza `status='accepted'` + `accepted_at` quando detectado.
- Registra evento `ats.invite.accepted` em `domain_events` para timeline.

## Respeito a limites do LinkedIn/Unipile

- `poll_interval_hours` mínimo 6h, default 12h.
- Batch por `account_id` no cron, com `unipile_rate_buckets` já existente.
- Passo `wait_invite_accept` não consome quota diária (`daily_send_limit`).
- `max_wait_days` limitado a 30 (padrão LinkedIn de expiração de convite).

## UI

**Sequence Builder (`src/components/sequences/sequence-builder.tsx` + editor de sourcing)**:
- Novo tipo "Aguardar aceite do convite" na lista de passos.
- Campos configuráveis: janela máxima (dias), intervalo de checagem (horas), ação no timeout (select).
- Validação: só pode ser adicionado após um passo `linkedin_invite`.

**Timeline/Detalhes da enrollment**:
- Badge "Aguardando aceite (Xd restantes)" enquanto em espera.
- Badge "Convite aceito em DD/MM" quando sincronizado.
- Badge "Convite expirou — X" quando timeout.

**Catálogo de passos** (`STEP_LABELS` em `src/lib/ats/sourcing/types.ts` equivalente): incluir o novo tipo.

## Detalhes técnicos

- Migração cria colunas nullable + CHECK do enum `on_timeout`.
- `processDueEnrollments` ganha branch dedicado antes do `switch` atual de canais.
- Log de step gravado como `status='waiting'` (novo valor) quando reagendado, para auditoria sem poluir métricas de envio.
- Feature flag opcional `sourcing_wait_accept_enabled` para rollout controlado.

## Fora de escopo

- Detecção de aceite via webhook Unipile em tempo real (fica como evolução futura; começamos com polling).
- Reenvio automático de convite expirado.

## Entregáveis

1. Migração SQL (colunas + enum).
2. Worker atualizado + novo cron de sync.
3. UI do builder e badges de status.
4. Documentação curta em `docs/backlog-pendencias.md` ou runbook.
