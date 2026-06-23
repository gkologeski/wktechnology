
## O que vai mudar

Hoje quando alguém é mencionado em uma atividade/nota nada acontece: o array `mentions` é salvo na linha mas nenhuma notificação `in-app`, e-mail ou aviso visual é gerado. Vou fechar esse fluxo e torná-lo configurável por usuário.

## 1. Disparo da notificação

Em `src/components/activity-timeline.tsx`, depois do `insert` em `activities` (e também depois do `update` quando a edição adiciona novos mentions / muda assignee), chamar uma nova server function `notifyActivityEvent` passando o `activity_id`. Ela faz tudo no servidor (autorizada via `requireSupabaseAuth`):

- Lê a atividade (RLS garante que só o próprio workspace).
- Para cada `user_id` em `mentions` (exceto o autor):
  - Lê as preferências do destinatário (ver §3).
  - Se `mention.inapp` ativo → `insert` em `public.notifications` com `type='mention'`, título "Você foi mencionado por <nome>", body = trecho do `subject`/`body` da atividade, `link` apontando para o registro relacionado (`/deals/$id`, `/contacts/$id`, etc).
  - Se `mention.email` ativo → enfileira e-mail no template `mention-notification`.
- Se a atividade for `type='task'` e `owner_id != created_by`, mesma lógica com `type='assignment'` ("<nome> atribuiu uma tarefa a você") respeitando a preferência `assignment.*`.

Idempotência: usar `idempotencyKey = mention:<activityId>:<userId>` para evitar e-mail duplicado em re-saves.

## 2. Sino: som + tremor

`src/components/notifications-bell.tsx` no callback do realtime de `notifications`:

- Tocar bip curto via `AudioContext` (oscilador, 600 Hz, 120 ms) — sem asset, sem dependência nova.
- Aplicar classe `animate-shake` no botão por ~900 ms (reset por `setTimeout`).
- Respeitar a preferência local `sound` e `shake` do usuário (lidas junto com prefs em §3).

Adicionar keyframe `shake` em `src/styles.css`:

```text
@keyframes shake { 0,100% { translateX 0 } 20,60% { -4px } 40,80% { 4px } }
.animate-shake { animation: shake .6s ease-in-out 1; }
```

## 3. Preferências por usuário

Migração nova:

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT jsonb_build_object(
    'mention',    jsonb_build_object('inapp', true, 'email', true,  'sound', true, 'shake', true),
    'assignment', jsonb_build_object('inapp', true, 'email', true,  'sound', true, 'shake', true),
    'deal_stage', jsonb_build_object('inapp', true, 'email', false, 'sound', false,'shake', false),
    'ticket',     jsonb_build_object('inapp', true, 'email', true,  'sound', true, 'shake', true),
    'task',       jsonb_build_object('inapp', true, 'email', false, 'sound', true, 'shake', false),
    'sla',        jsonb_build_object('inapp', true, 'email', true,  'sound', true, 'shake', true),
    'message',    jsonb_build_object('inapp', true, 'email', false, 'sound', true, 'shake', true)
  );
```

Server functions novas em `src/lib/notifications.functions.ts`:

- `getMyNotificationPrefs` — retorna o jsonb (defaults se nulo).
- `updateMyNotificationPrefs({ prefs })` — valida com Zod e grava.

## 4. Tela de configuração

Nova rota `src/routes/_authenticated/settings.notifications.tsx` (link adicionado no índice de Settings em `settings.index.tsx` e na sidebar de configurações, se existir). Layout: tabela com as categorias (Menção, Atribuição, Mudança de fase, Ticket, Tarefa, SLA, Mensagem) × colunas (No app, E-mail, Som, Tremor) usando `Switch` do shadcn. Botão "Salvar" → mutation usando `updateMyNotificationPrefs`.

## 5. E-mail

Pré-requisito: domínio de e-mail configurado + `setup_email_infra` + `scaffold_transactional_email`. Já existe `src/routes/lovable/email/queue/process.ts`, mas os templates ainda não foram scaffoldados. Se o domínio não estiver pronto, mostro o diálogo de setup antes de continuar.

Após scaffold, criar `src/lib/email-templates/mention-notification.tsx` com React Email (assinatura "Você foi mencionado em <CRM>", trecho do conteúdo, botão "Abrir") e registrar em `registry.ts`. A server function de §1 chama `/lovable/email/transactional/send` via um helper `src/lib/email/send.ts` (também criado pelo scaffold) com `templateData = { mentionerName, snippet, link }`.

Se a preferência `email=false` para o destinatário, simplesmente pula o envio.

## Detalhes técnicos

- **Privilégio:** `notifyActivityEvent` precisa ler `profiles.notification_preferences` de OUTROS usuários e inserir em `notifications` para OUTROS `user_id`. RLS atual de `notifications` só permite `SELECT/UPDATE/DELETE` do próprio user; insert é grant para `authenticated` mas sem policy explícita → vou adicionar `CREATE POLICY notif_insert_workspace ... FOR INSERT WITH CHECK (public.is_workspace_member(owner_id, auth.uid()))` para permitir o autor criar notificação para colegas do mesmo workspace. Leitura de prefs de outros via `supabaseAdmin` (carregado dentro do handler com `await import('@/integrations/supabase/client.server')`) apenas para o campo `notification_preferences` e `email` do profile alvo, após validar que ambos são membros do mesmo workspace.
- **Sem alteração no schema de `activities`** — `mentions uuid[]` já existe.
- **Realtime já está habilitado** em `public.notifications` (publication `supabase_realtime`).

## Arquivos a tocar

- `supabase/migrations/<nova>.sql` — coluna `notification_preferences`, policy `INSERT` em `notifications`.
- `src/lib/notifications.functions.ts` — `notifyActivityEvent`, `getMyNotificationPrefs`, `updateMyNotificationPrefs`.
- `src/components/activity-timeline.tsx` — chamar `notifyActivityEvent` após insert/update.
- `src/components/notifications-bell.tsx` — som + shake + leitura de prefs.
- `src/styles.css` — keyframe `shake`.
- `src/routes/_authenticated/settings.notifications.tsx` — nova tela.
- `src/routes/_authenticated/settings.index.tsx` — atalho para a nova tela.
- (Após scaffold) `src/lib/email-templates/mention-notification.tsx` + `registry.ts`.

## Fora do escopo

- Notificações push web (já existe `push_subscriptions` separado — fica como está).
- Reescrever a tela de Slack notifications.
- Histórico/digest diário por e-mail.
