## Objetivo

Hoje o `AiSummaryPanel` só permite resumir "Conversa" (WhatsApp + activities) ou "Calls/Reuniões". Ficam de fora e-mails, notas, tasks, e principalmente as **gravações/transcrições de reuniões** (`meeting_summaries`, `meetings.transcript`, `activities.transcription`) — que contêm informação valiosa. Vamos expandir os tipos de resumo e enriquecer o coletor.

## Escopo

Somente `AiSummaryPanel` + `ai-summaries.functions.ts` + migration do CHECK constraint. Sem mexer em RLS, autenticação, timeline geral ou outras entidades.

## Mudanças

### 1. Novos tipos de resumo (kind)
Ampliar o enum `kind` para:
- `conversation` — WhatsApp + e-mails (mantém foco em diálogo com cliente)
- `call` — activities `call` (áudio + transcrição Twilio)
- `meeting` — reuniões (`meetings` + `meeting_summaries` + `activities` tipo `meeting` com `transcription`/`recording_url`)
- `email` — apenas e-mails (`email_messages` + activities tipo `email`)
- `notes` — notas e comentários internos (`activities` tipo `note`, `activity_comments`)
- `tasks` — tasks e follow-ups (`activities` tipo `task`)
- `all` — consolidação de tudo acima, timeline completa

### 2. Coletor `collectMessages`
Reescrever para, conforme o `kind`, incluir também:
- **meetings**: buscar `meetings` (por `deal_id`/`contact_id`), juntar `meeting_summaries.summary/action_items` e `meetings.transcript` quando existir; incluir `activities.transcription` para type=`meeting`.
- **email**: buscar `email_messages` relacionados (via `email_threads` do contato/deal) — assunto, snippet, direction; complementar com activities tipo `email`.
- **notes/tasks**: incluir activities dos tipos correspondentes; para notas, também puxar `activity_comments` do período.
- **calls**: incluir `activities.transcription` e `recording_duration_seconds` além do body/outcome.
- **all**: união de tudo, limitado a ~400 mensagens.

Manter janela `window_days` e ordenação cronológica.

### 3. Prompt
`buildPrompt` recebe `kind` e adapta cabeçalho ("Resuma reuniões e gravações…", "Resuma e-mails trocados…", "Consolide toda a interação…"). Schema JSON de saída permanece igual.

### 4. UI (`AiSummaryPanel`)
- Substituir o Select de kind por lista com todos os novos tipos + ícones (Mail, FileText, ListTodo, CalendarDays, Layers para "Tudo").
- Badge do card mostra label amigável do tipo.
- Empty state atualizado.

### 5. Migration
Atualizar CHECK constraint `ai_summaries_kind_check` para aceitar os novos valores (`conversation|call|meeting|email|notes|tasks|all`). Preservar linhas existentes.

## Detalhes técnicos

Arquivos:
- `supabase/migrations/<ts>_ai_summaries_expand_kinds.sql` — drop/add do CHECK.
- `src/lib/ai-summaries.functions.ts` — enum KIND, `collectMessages` expandido, `buildPrompt` com header por kind.
- `src/components/ai/ai-summary-panel.tsx` — Select com novas opções, mapa `KIND_LABEL`/`KIND_ICON`, badge.

Sem alterações em: RLS, schema de `ai_summaries` (só CHECK), outras rotas, permissões.

## Riscos / não-escopo

- Não altero como a timeline renderiza itens; só o painel de resumo.
- Não crio novo modelo IA; segue `google/gemini-2.5-flash`.
- Transcrições longas podem estourar contexto — aplico `slice(0, 800)` por item já existente e limito total a 400 msgs.

## Validação manual

1. Abrir um deal com reuniões gravadas (ex.: `deals/f6c61100-1e8e-4ef3-a224-ceaf055f07d0`) → gerar resumo tipo "Reuniões" e conferir se traz pontos das transcrições.
2. Abrir contato com e-mails trocados → gerar tipo "E-mails".
3. Ticket com notas/comentários → tipo "Notas".
4. Deal com muita coisa → tipo "Tudo" consolidado.
