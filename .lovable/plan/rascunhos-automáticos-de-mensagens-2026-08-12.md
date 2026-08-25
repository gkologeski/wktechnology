# Rascunhos automáticos de mensagens

Objetivo: qualquer conteúdo redigido (e-mail ou WhatsApp) é salvo automaticamente como rascunho no servidor. Se a janela for fechada e reaberta, o texto volta como estava.

## Comportamento

- Ao digitar, o rascunho é salvo automaticamente (com pequeno atraso de ~800 ms para não salvar a cada tecla).
- Indicador discreto ao lado do título: "Salvando…" / "Rascunho salvo às HH:MM".
- Ao reabrir a mesma composição (mesmo destinatário/registro/thread), os campos são restaurados: Para, Cc, Assunto, Mensagem e anexos já enviados.
- Botão "Descartar rascunho" (com confirmação) limpa o formulário e remove o rascunho.
- Ao enviar com sucesso, o rascunho é removido automaticamente.
- Se já existir rascunho e a tela abrir com valores padrão (ex.: template pré-preenchido), o rascunho salvo tem prioridade, com opção de descartar.

## Onde se aplica

1. Modal "Novo email" usado nas entidades (lead, contato, empresa, negócio, propostas).
2. Composição de resposta de e-mail na Caixa de entrada.
3. Campo de mensagem do WhatsApp na Caixa de entrada.

## Detalhes técnicos

Banco (migration):

- Nova tabela `message_drafts` com: `owner_id`, `workspace_id`, `channel` (`email` | `whatsapp`), `scope_key` (texto determinístico que identifica a composição), `to_addr`, `cc`, `subject`, `body_html`, `body_text`, `attachments` (jsonb), `context` (jsonb com lead_id/contact_id/deal_id/company_id/thread_id), `created_at`, `updated_at`.
- Índice único em (`owner_id`, `channel`, `scope_key`) para upsert idempotente.
- GRANTs para `authenticated` e `service_role`; RLS habilitada com policies restritas a `owner_id = auth.uid()` (select/insert/update/delete). Sem acesso anônimo.

Servidor (`src/lib/message-drafts.functions.ts`, com `requireSupabaseAuth`):

- `getMessageDraft({ channel, scope_key })`
- `saveMessageDraft(...)` — upsert por `onConflict: owner_id,channel,scope_key`; ignora salvamento quando todos os campos estão vazios.
- `deleteMessageDraft({ channel, scope_key })`

Cliente:

- Novo hook `src/hooks/use-message-draft.ts`: carrega o rascunho ao abrir, expõe `status` (`idle` | `saving` | `saved`), faz debounce do save, e oferece `discard()`. Evita salvar durante a hidratação inicial e cancela saves pendentes ao desmontar.
- `scope_key` derivada do contexto: `email:new:<lead|deal|contact|company>:<id>` ou `email:reply:<thread_id>`; `whatsapp:<conversation_id>`. Sem id de contexto, usa o destinatário normalizado.
- `send-email-dialog.tsx`: integra o hook (Para, Cc, Assunto, Mensagem, anexos), mostra o indicador de status no cabeçalho e adiciona "Descartar rascunho" no rodapé; a assinatura só é anexada quando não há rascunho restaurado, para não duplicar.
- `inbox.email.tsx` / `inbox.index.tsx` e `inbox.whatsapp.tsx`: mesmo hook aplicado ao campo de resposta, restaurando o texto ao trocar de thread/conversa.
- Anexos já enviados ao storage continuam válidos no rascunho; o botão "Descartar" também remove os arquivos do rascunho descartado.

UX/acessibilidade: indicador com `aria-live="polite"`, ação de descarte com confirmação, estados de loading do rascunho sem bloquear a digitação, tokens semânticos do design system.

Validações previstas: typecheck, lint, build e testes unitários do hook de debounce/`scope_key`.
