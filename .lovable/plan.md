## Objetivo
Permitir criar/editar em `/surveys` (mesma tela usada em `/settings/surveys`): modelos de pesquisa (templates), envio avulso e edição de respostas existentes. Sem alterar a geração automática atual disparada por ticket resolvido/fechado.

## Escopo
- Somente a página de Pesquisas (CRM e Configurações — é a mesma via alias).
- Sem mexer em RLS de outras tabelas, sem tocar em `bug_reports`, ATS, branding ou menus.

## 1. Modelos de pesquisa (templates)

### Banco (migration)
Nova tabela `public.survey_templates`:
- `id uuid pk`, `workspace_id uuid not null`, `owner_id uuid not null`
- `name text not null`
- `kind text not null check (kind in ('csat','nps'))`
- `question text not null` (texto principal exibido ao respondente)
- `invite_subject text`, `invite_body text` (usados no convite por email/WhatsApp)
- `channel text not null default 'email' check (channel in ('email','whatsapp','both'))`
- `trigger_event text not null default 'ticket_resolved' check (trigger_event in ('ticket_resolved','ticket_closed','manual'))`
- `delay_minutes int not null default 0`
- `is_active boolean not null default true`
- `is_default boolean not null default false`
- `created_at`, `updated_at` (+ trigger de updated_at)

GRANTs para `authenticated` e `service_role`. RLS: `SELECT/INSERT/UPDATE/DELETE` restritos a `workspace_id = current setting do usuário` seguindo o mesmo padrão já usado em `survey_responses` (replicar policies existentes: reuso do helper `is_workspace_member`/equivalente já presente no projeto).

Observação: nenhum código atual lê `survey_templates` — a inserção automática de `survey_responses` no resolve/close continua como está. Wiring dos templates à geração automática fica registrado como pendência (fora deste escopo).

### UI
Nova aba "Modelos" na página de Pesquisas, ao lado das abas CSAT/NPS existentes. Usa o componente já existente `CrudSettings` (`src/components/crud-settings.tsx`) parametrizado para `survey_templates`, com campos: name, kind (select), question, invite_subject, invite_body, channel, trigger_event, delay_minutes, is_active, is_default.

## 2. Envio avulso

Botão "Nova pesquisa" no header da página abre um `Dialog`:
- Campos: ticket (Combobox buscando `tickets` do workspace por assunto/número), kind (csat/nps), template opcional (lista `survey_templates` do mesmo kind).
- Ao confirmar: `supabase.from('survey_responses').insert({ ticket_id, kind, owner_id, workspace_id })` — `token`, `sent_at`, `created_at` vêm do default. Toast com link público copiável.
- Reaproveita padrão já usado (`copyLink`) para mostrar/copiar `/survey/{token}`.

Sem server function nova: `survey_responses` já tem RLS/GRANT ativos e o insert respeita `owner_id = auth.uid()`.

## 3. Editar respostas existentes

Cada linha da tabela ganha botão "Editar" (ícone `Pencil`) que abre `Dialog` com:
- Score (input numérico com range conforme kind: 0–10 NPS, 0–5 CSAT).
- Comentário (Textarea).
- `responded_at` fica somente-leitura; se estiver nulo e o admin salvar um score, gravamos `responded_at = now()`.

Update via `supabase.from('survey_responses').update({...}).eq('id', id)`. Restrição de admin fica a cargo da RLS existente (não alteramos policies aqui).

## 4. Arquivos

Criar:
- `supabase/migrations/<timestamp>_survey_templates.sql` (via ferramenta de migration).
- `src/components/surveys/new-survey-dialog.tsx`
- `src/components/surveys/edit-response-dialog.tsx`
- `src/components/surveys/survey-templates-tab.tsx` (wrapper fino sobre `CrudSettings`).

Editar:
- `src/routes/_authenticated/settings.surveys.tsx`: adicionar aba "Modelos", botão "Nova pesquisa" no header do Card, coluna de ações com "Editar" abrindo o dialog. Nenhuma mudança no cálculo de stats/agentes.

Não mexer:
- `src/routes/_authenticated/surveys.tsx` (alias — herda automaticamente).
- `src/lib/surveys.functions.ts` (fluxo público de resposta permanece intacto).
- `src/routes/survey.$token.tsx`, geração automática de pesquisas, menus, sidebar.

## 5. Validação
- `bunx tsgo --noEmit`.
- Manual: criar/editar/excluir template; disparar pesquisa avulsa e copiar link; abrir link público e responder; editar score de resposta existente; conferir stats CSAT/NPS e "Por responsável" continuam corretos.

## 6. Pendências registradas (não implementadas)
- Wiring dos `survey_templates` no gatilho automático de `ticket_resolved/closed` (hoje o insert automático usa defaults, não lê templates).
- Envio real por email/WhatsApp do convite gerado no fluxo avulso (hoje entregamos link copiável — mesmo comportamento das pesquisas já existentes).
