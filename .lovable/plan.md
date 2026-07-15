
## Objetivo

Permitir que usuários adicionem, editem e excluam comentários em qualquer item da timeline (nota, ligação, reunião, e-mail, tarefa, SMS, WhatsApp, LinkedIn, correio), com suporte a @mentions e notificação em tempo real — igual ao HubSpot.

## Escopo

- Novo recurso de comentários vinculados a `activities.id`.
- Suporte a @mentions (reutiliza infraestrutura existente).
- CRUD completo restrito ao autor (edição/exclusão) e visibilidade por workspace.
- UI: painel expansível abaixo de cada item da timeline com contador ("N comentários"), lista de comentários, editor rich-text e ações inline.
- Fora do escopo: reações/emoji, edição colaborativa em tempo real, comentários encadeados (threading em N níveis) — HubSpot também é flat.

## Banco de dados

Nova tabela `public.activity_comments`:
- `id uuid PK`
- `activity_id uuid` → `activities(id) ON DELETE CASCADE`
- `workspace_id uuid` (denormalizado da activity para RLS eficiente)
- `author_id uuid` (default `auth.uid()`)
- `body text` (HTML rich-text)
- `mentions uuid[]` (extraídas via `extractMentionIds`)
- `created_at`, `updated_at`, `deleted_at` (soft delete)

Índices: `(activity_id, created_at)`, `(workspace_id)`.

RLS (espelha padrão de `activities`):
- `SELECT`: `workspace_id IN current_user_workspaces()` (lê quem lê a atividade).
- `INSERT`: mesma condição + `author_id = auth.uid()`.
- `UPDATE`/`DELETE`: apenas `author_id = auth.uid()` ou permissão `techsales.activities.update.workspace` (admins).

GRANTs: `SELECT, INSERT, UPDATE, DELETE` para `authenticated`; `ALL` para `service_role`.

Trigger `updated_at` padrão.

## Backend

Nenhum server function novo obrigatório — comentários são inseridos via cliente Supabase (mesmo padrão da criação de nota em `activity-timeline.tsx:1150`).

Estender `src/lib/notifications.functions.ts`:
- Novo helper `notifyActivityCommentEvent({ commentId })` que:
  - Lê o comentário + activity + related entity.
  - Notifica os `mentions` do comentário (categoria `mention`, template já existente).
  - Notifica o `owner_id` da activity (se ≠ autor do comentário) — categoria nova ou reutilizar `mention` com contexto "comentou na sua atividade".

## Frontend

Novo componente `src/components/timeline/activity-comments.tsx`:
- Props: `activityId`, `workspaceId`.
- Busca comentários via `supabase.from('activity_comments').select(..., author:profiles(...)).eq('activity_id', ...)`.
- Realtime opcional (`postgres_changes` na tabela filtrando `activity_id`) — pode ficar como polling/invalidation em v1 e adicionar realtime numa fase 2.
- Renderiza:
  - Cabeçalho colapsável: "💬 N comentários".
  - Lista de comentários (avatar, nome, timestamp relativo, corpo HTML sanitizado).
  - Editor `RichHtmlEditor` (já suporta @mentions) com botão "Comentar".
  - Menu por comentário (autor apenas): Editar / Excluir.

Integrar em `src/components/activity-timeline.tsx`:
- Renderizar `<ActivityComments />` no rodapé de cada item da timeline (dentro do wrapper compartilhado — identificar o wrapper por tipo).
- Cuidar dos casos especiais (email já tem `EmailTimelineItem` — inserir logo abaixo do corpo).

## Segurança e privacidade

- RLS espelhando padrão da tabela `activities` (workspace-scoped).
- Autor pode editar/excluir apenas os próprios comentários.
- Sanitização do HTML no render (reutilizar `DOMPurify` já usado no editor).
- Sem exposição de dados sensíveis em logs.

## UX/UI

- Segue design system: `Card` inline compacto, avatar+nome+timestamp, corpo com tipografia consistente.
- Estados: loading skeleton, empty (esconde seção se 0 comentários e usuário não está compondo), erro com retry.
- Dark mode e responsividade.
- Foco visível no editor, aria-labels nos botões de ação.
- Timestamp relativo (`há 2h`) com tooltip do timestamp absoluto.

## Como validar manualmente

1. Abrir um deal/contato/empresa com atividades.
2. Em qualquer item (nota, reunião, e-mail): clicar em "Comentar" → digitar `@` → mencionar alguém → publicar.
3. Verificar contador incrementa e comentário aparece com autor correto.
4. Editar o próprio comentário (menu ⋯ → Editar) → salvar.
5. Excluir o próprio comentário → some da lista.
6. Como outro usuário: não deve conseguir editar/excluir comentário alheio (botões escondidos e RLS bloqueia via API).
7. Usuário mencionado recebe notificação in-app.

## Fases

1. Migration + RLS + GRANTs.
2. Componente `ActivityComments` + integração na timeline.
3. Notificações de menção/comentário.
4. (Opcional) Realtime via `postgres_changes`.
