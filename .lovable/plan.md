# Mensageiro interno do workspace

Chat em tempo real entre membros do mesmo workspace, com conversas diretas (1-1), grupos, anexos de arquivo/imagem e notificações (badge + toast + push).

## Experiência do usuário

- **Ícone "Mensagens"** no header (ao lado de Bug report), com badge de não lidas atualizado em tempo real.
- **Drawer flutuante** abre pela direita em qualquer tela:
  - Coluna esquerda: lista de conversas (avatar, último trecho, hora, contador).
  - Coluna direita: thread da conversa selecionada (mensagens, composer, botão de anexo).
  - Header da thread: nome/avatares + ação "Adicionar membros" (grupos).
- **Nova conversa**: botão `+` abre seletor de membros do workspace (reutiliza `use-workspace-members`). Selecionar 1 → DM; selecionar 2+ → grupo (com campo de nome opcional).
- **Anexos**: clip no composer, até 10 arquivos/20MB cada, preview inline (imagens) ou card com nome+tamanho (outros).
- **Toast** quando chega mensagem e a conversa não está aberta.
- **Push** (service worker já existe + tabela `push_subscriptions`): notificação nativa quando a aba está fechada/em background.
- **Read receipts simples**: "visto por N" no rodapé da última mensagem em grupos; check duplo em DMs.

## Arquitetura técnica

### Banco (migration)

Quatro tabelas novas em `public`, todas com `workspace_owner_id` e RLS exigindo `is_workspace_member`:

- `chat_conversations` — id, workspace_owner_id, kind (`dm`|`group`), title (nullable), created_by, created_at, updated_at, last_message_at.
- `chat_conversation_members` — conversation_id, user_id, joined_at, last_read_at, muted. PK composta.
- `chat_messages` — id, conversation_id, workspace_owner_id, sender_user_id, body (text), created_at, edited_at, deleted_at.
- `chat_message_attachments` — id, message_id, storage_path, file_name, mime_type, size_bytes.

Função `is_chat_member(conv_id, user)` SECURITY DEFINER (lê `chat_conversation_members`) para evitar recursão em RLS.

Trigger `chat_messages_after_insert`: atualiza `last_message_at` da conversa e dispara `pg_notify`/edge para push (ver abaixo).

Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages, chat_conversations, chat_conversation_members`.

GRANTs: `SELECT, INSERT, UPDATE, DELETE` para `authenticated`; `ALL` para `service_role`. Sem `anon`.

### Storage

Bucket privado `chat-attachments`. Path: `{workspace_id}/{conversation_id}/{message_id}/{filename}`. RLS em `storage.objects` permite leitura/escrita apenas a membros da conversa (usa `is_chat_member`).

### Server functions (`src/lib/chat.functions.ts`)

Todas com `requireSupabaseAuth`:

- `listConversations()` — conversas do usuário no workspace ativo + contagem de não lidas + último trecho.
- `getOrCreateDM({ other_user_id })` — idempotente (procura DM existente entre os dois).
- `createGroup({ title, member_user_ids })`.
- `addGroupMembers({ conversation_id, user_ids })`.
- `listMessages({ conversation_id, before?, limit })` — paginação reversa.
- `sendMessage({ conversation_id, body, attachments[] })` — attachments já enviados ao Storage; insere mensagem + linhas em `chat_message_attachments`.
- `markRead({ conversation_id })` — atualiza `last_read_at`.
- `signAttachmentUrl({ attachment_id })` — gera URL assinada (60 s).

### Frontend

Novos arquivos:

- `src/components/chat/chat-drawer.tsx` — Sheet shadcn com layout 2 colunas.
- `src/components/chat/conversation-list.tsx`
- `src/components/chat/conversation-thread.tsx`
- `src/components/chat/message-composer.tsx` (anexos + envio).
- `src/components/chat/new-conversation-dialog.tsx`
- `src/components/chat/chat-trigger.tsx` — botão do header com badge.
- `src/hooks/use-chat-realtime.ts` — assina canais Supabase Realtime, invalida React Query, dispara toast.
- `src/hooks/use-unread-count.ts`.

Montagem:
- `chat-trigger` adicionado em `src/components/page-header.tsx` (área de ações globais).
- Estado de drawer aberto/fechado em contexto leve (`ChatProvider` em `src/routes/_authenticated/route.tsx`).

### Push

Reaproveita `push_subscriptions` + `public/sw.js`. Trigger no banco enfileira evento; novo handler `src/routes/api/public/hooks/chat-push-tick.ts` (autenticado via `CRON_SECRET`) consome a fila e dispara web-push para membros offline. Agendamento via `reschedule_lovable_cron` (cron de 1 min) — adiciona entrada ao array existente.

## Entregáveis (ordem de execução)

1. Migration: tabelas, função `is_chat_member`, RLS, GRANTs, trigger de `last_message_at`, publicação realtime.
2. Bucket `chat-attachments` + policies em `storage.objects`.
3. `chat.functions.ts` (server fns).
4. Componentes do drawer + hooks de realtime/unread.
5. Integração no header e provider em `_authenticated/route.tsx`.
6. Handler de push + entrada no cron.

## Fora do escopo (podem vir depois)

Reactions/emojis, threads aninhadas, busca full-text, edição/exclusão pelo usuário, menções `@user` com highlight, status online/digitando, chamadas de voz/vídeo.