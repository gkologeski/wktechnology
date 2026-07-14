
## Escopo

Criar um sistema de **Snippets** no estilo HubSpot: textos curtos pré-prontos, inseridos em qualquer campo de texto via `/atalho`. Escopo global no workspace (sem filtro por módulo), com visibilidade pessoal ou compartilhada. Gestão em Configurações. Disponível em Email, Notas/Timeline, Tickets, Chat interno, WhatsApp e Cotações.

## Modelo de dados

Tabela nova `public.snippets` (não reaproveitar `email_snippets` — permanece intacta para não quebrar o compose atual, com migração leve descrita abaixo):

- `name` (rótulo humano)
- `shortcut` (ex.: `assinatura`, `condicoes-pagamento`) — único por `(owner_id, visibility, workspace_id)`
- `body_html` (rich text sanitizado) e `body_text` (fallback plain)
- `visibility` enum: `personal` | `shared`
- `workspace_id`, `owner_id`
- `folder` (texto opcional, para organizar)
- `usage_count` (contador para ordenar por mais usados)
- timestamps + trigger `updated_at`

RLS:
- SELECT: dono OU (`shared` e mesmo workspace).
- INSERT/UPDATE/DELETE: dono; snippets `shared` só admin/gerente do workspace podem editar/apagar (via `has_role`).
- GRANT autenticado + service_role.

Migração de dados: copiar entradas existentes de `email_snippets` para `snippets` como `personal`, marcando `folder = 'Email (legado)'`. `email_snippets` continua funcionando lado a lado até deprecar em fase futura.

## Backend

Novo arquivo `src/lib/snippets.functions.ts`:
- `listSnippets({ q?, visibility? })` — lista visíveis pelo usuário, ordenados por `usage_count desc, shortcut asc`.
- `upsertSnippet(payload)` — cria/edita respeitando visibilidade.
- `deleteSnippet(id)`.
- `incrementSnippetUsage(id)` — chamado quando um snippet é inserido.

Todos com `requireSupabaseAuth`.

## Componentes de UI

### 1. Hook central `useSnippetTrigger`
Arquivo novo `src/hooks/use-snippet-trigger.ts`. Detecta `/atalho` em:
- `<input>` / `<textarea>` (via ref + eventos de seleção)
- `RichHtmlEditor` (via detecção no `contentEditable`, mesmo padrão da menção `@` já existente)

Retorna estado do popover (query, posição, ativo) + função `insertSnippet(snippet)` que substitui o `/atalho` pelo conteúdo do snippet e chama `incrementSnippetUsage`.

### 2. Popover `SnippetPicker`
Novo componente `src/components/snippets/snippet-picker.tsx`:
- Lista filtrada por texto após `/`
- Mostra `shortcut`, `name`, preview do body
- Navegação por ↑ ↓, Enter/Tab para inserir, Esc para fechar
- Segue tokens semânticos e mesmo padrão visual do popover de menções existente

### 3. Adaptação dos campos alvo
- `RichHtmlEditor` (`src/components/rich-html-editor.tsx`): adicionar detecção de `/` em paralelo à detecção `@` (compartilhando o algoritmo já existente). Renderizar `SnippetPicker` quando ativo. Ao inserir, colar HTML sanitizado do body.
- `send-email-dialog.tsx`: substituir a lógica interna atual de `/atalho` (que hoje consulta `email_snippets`) pelo `useSnippetTrigger`. Comportamento externo idêntico.
- Notas/timeline: `activity-timeline.tsx` já usa `RichHtmlEditor`, então ganha automaticamente.
- Tickets: identificar campo de resposta (`components/tickets/*`) e usar `RichHtmlEditor` se ainda for `<Textarea>` puro, ou plugar `useSnippetTrigger` no textarea.
- Chat interno (`components/chat/chat-thread.tsx`) e WhatsApp (`components/whatsapp/send-whatsapp-dialog.tsx`): `<Textarea>` puros — plugar `useSnippetTrigger` inserindo body_text (não HTML) para não quebrar canais que não suportam rich text.
- Cotações: campos de descrição do wizard (`quote-wizard.tsx`) e descrição de line item — usar `useSnippetTrigger` com body_text.

### 4. Gestão em Configurações
Nova rota `src/routes/_authenticated/settings.snippets.tsx`:
- Header padrão (`PageHeader`), botão "Novo snippet"
- FilterBar: busca por texto + tabs "Meus" / "Compartilhados"
- Lista em `DataTable`: shortcut, nome, escopo, pasta, usos, atualizado em
- Estados loading/empty/error obrigatórios
- Modal de edição com form: name, shortcut (validação regex), folder, visibilidade (radio: pessoal/compartilhado — compartilhado só habilitado se admin), body via `RichHtmlEditor`
- Ação de duplicar

Adicionar entrada no menu de Configurações (`settings-menu.tsx` ou equivalente).

## UX

- Gatilho: `/atalho` no início de palavra (regex `(^|\s)\/([a-zA-Z0-9_\-/]*)$`)
- Popover fecha em blur / Esc / clique fora
- Se snippet é `body_html` e campo é plain, faz strip para texto simples
- Toast de "Snippet inserido" só em campos plain para dar feedback (rich mostra visualmente)

## Segurança

- Sanitização HTML já é feita pelo `RichHtmlEditor`; snippets HTML passam pela mesma pipeline
- RLS conforme acima; sem alteração em outras policies
- `shared` protegido no backend, não só na UI

## Fora de escopo desta entrega

- Snippets por cargo/permission set (fica para futuro se necessário)
- Placeholders/tokens dinâmicos dentro do snippet (`{{first_name}}`) — email já resolve isso via `email-tokens`; para os demais canais, os tokens são inseridos literalmente nesta fase
- Migração/desativação definitiva de `email_snippets` (mantido para não regredir)

## Arquivos previstos

Novos:
- migration `snippets` + RLS + backfill leve
- `src/lib/snippets.functions.ts`
- `src/hooks/use-snippet-trigger.ts`
- `src/components/snippets/snippet-picker.tsx`
- `src/components/snippets/snippet-form-dialog.tsx`
- `src/routes/_authenticated/settings.snippets.tsx`

Alterados:
- `src/components/rich-html-editor.tsx` (adiciona hook `/`)
- `src/components/email/send-email-dialog.tsx` (troca fonte de snippets)
- `src/components/tickets/*` (campo de resposta)
- `src/components/chat/chat-thread.tsx`
- `src/components/whatsapp/send-whatsapp-dialog.tsx`
- `src/components/deals/quote-wizard.tsx` (campos textuais)
- entrada no menu de Configurações

## Validação manual

1. Criar snippet pessoal `saudacao` = "Olá, tudo bem?"
2. Em Compose Email digitar `/saudacao` → substitui pelo texto
3. Repetir em nota de deal, resposta de ticket, chat interno, WhatsApp e descrição da cotação
4. Criar snippet compartilhado como admin, logar como outro usuário do mesmo workspace e ver na lista
5. Verificar que usuário de outro workspace **não** vê o snippet compartilhado
