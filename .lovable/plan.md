## Notificações de comentários em atividades

Fechar a pendência do turno anterior: quando alguém comenta em uma atividade da timeline, disparar notificações in-app para (a) usuários mencionados via `@` e (b) o dono/participantes da atividade — sem notificar o próprio autor do comentário.

### Escopo

1. **Server function** `notifyActivityCommentEvent` em `src/lib/notifications.functions.ts`
   - Input: `{ commentId, activityId, authorId, mentionIds, workspaceId }`.
   - Resolve destinatários:
     - mencionados (`mentionIds`) → tipo `mention`.
     - dono da atividade (`activities.owner_id` / `assigned_to`) e criador → tipo `comment`.
   - Deduplica e remove o `authorId`.
   - Insere linhas em `public.notifications` (mesma tabela usada por `notifyActivityEvent`), com `entity_type='activity'`, `entity_id=activityId`, link para a timeline da entidade pai quando disponível.
   - Retorna `{ notified: number }`.

2. **Integração no componente** `src/components/timeline/activity-comments.tsx`
   - Após `insert` bem-sucedido de comentário, chamar `notifyActivityCommentEvent` com `extractMentionIds(html)` e ids do autor/atividade/workspace.
   - Fire-and-forget com `.catch` silencioso (não bloquear UX).
   - Em edição, notificar apenas menções **novas** (diff contra o conteúdo anterior).

3. **Não incluído nesta fase**
   - E-mail transacional (fica para próxima fase se solicitado).
   - Preferências por usuário / mute por atividade.
   - Realtime badge no sino (já existe subscription genérica em `notifications`).

### Detalhes técnicos

- Reutilizar helpers/padrão de `notifyActivityEvent` (mesma tabela `public.notifications`, mesma estrutura de payload).
- Escrita usa `requireSupabaseAuth` — RLS de `notifications` já permite insert do próprio workspace.
- Diff de menções na edição: `Array.from(new Set(newIds).difference(new Set(oldIds)))`.
- Sem migration: `public.notifications` já existe.

### Validação manual

1. Comentar em uma atividade mencionando outro usuário → o mencionado vê notificação no sino.
2. Comentar sem menção → dono da atividade (se diferente do autor) recebe notificação tipo `comment`.
3. Editar o comentário adicionando nova menção → só o novo mencionado recebe (o antigo não recebe duplicata).
4. Comentar em atividade própria sem mencionar ninguém → nenhuma notificação criada.
