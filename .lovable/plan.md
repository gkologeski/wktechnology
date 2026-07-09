## Objetivo
Remover o card agregado "E-mails enviados" do topo e, na própria timeline, fazer cada e-mail (inbound e outbound) aparecer como um item com corpo formatado, anexos, badges de aberturas/cliques e última abertura (mesmos controles do card atual).

## Diagnóstico
- `src/components/activity-timeline.tsx` renderiza `<EmailEngagementCard />` no topo (linha 957) — precisa sair.
- Cada e-mail já vira uma `activity` (`type = "email"`) na timeline, mas hoje:
  - o corpo mostrado é o snippet salvo em `activity.body`, sem anexos nem métricas;
  - o side-load em `load()` (linhas 389-417) puxa apenas `body_html/body_text`, ignorando `attachments`, contadores e eventos.
- `email_messages` já persiste `direction`, `body_html`, `body_text`, `attachments`, `has_attachments`, `open_count`, `click_count`, `first_opened_at`, `sent_at`, `received_at`.
- `email_tracking_events` guarda `last_opened_at` / `last_clicked_at` / `last_clicked_url`.
- Atividades inbound: verificar se o sync do inbox cria `activities` para e-mails recebidos. Se não criar, os inbound não aparecem hoje na timeline — precisará ser tratado (ver item 4).
- `email-send.functions.ts` remove os anexos do bucket após envio, impedindo download posterior a partir da timeline.

## Mudanças

### 1. `src/components/activity-timeline.tsx`
- Remover o bloco `{relatedKey !== "related_ticket_id" && <EmailEngagementCard ... />}` (linhas 956-958) e o import associado.
- Estender o side-load de `email_messages` em `load()`:
  - `select("id, direction, from_email, from_name, to_emails, cc_emails, body_html, body_text, sent_at, received_at, open_count, click_count, first_opened_at, has_attachments, attachments")`;
  - buscar em paralelo `email_tracking_events` (`message_id, event_type, url, occurred_at`) para os mesmos IDs, para derivar `last_opened_at`, `last_clicked_at`, `last_clicked_url`;
  - anexar tudo em uma propriedade privada de cada activity de e-mail (`_email`) usada apenas no render.
- No render do item de atividade (`type === "email"`, bloco perto da linha 1667):
  - substituir o `HtmlContent` do snippet pelo `HtmlContent` do `body_html || body_text` já hidratado;
  - abaixo do corpo, adicionar bloco de anexos (chip com Paperclip + nome + tamanho); clique gera signed URL via `supabase.storage.from("email-attachments").createSignedUrl(path, 3600)` e abre em nova aba;
  - adicionar linha de métricas somente para outbound: badges "N aberturas", "N cliques", texto "Última abertura: …", "Último clique: … · URL".
- Manter a chip de direção existente ("Enviado" / "Recebido"). Adaptar o cabeçalho para exibir `De:`/`Para:` conforme direção usando `_email.from_email`/`_email.to_emails`.

### 2. `src/lib/email-engagement.functions.ts`
- Manter `getEmailEngagementReport` (Analytics ainda usa).
- Marcar `listEntityEmailEngagement` como deprecated internamente ou remover se não houver mais consumidores. Verificar imports antes de excluir; se só o card usar, remover a função junto com o card.

### 3. `src/components/email/email-engagement-card.tsx`
- Excluir o arquivo (sem outros consumidores além da timeline).

### 4. Inbound na timeline
- Verificar (durante implementação) se o sync de inbox cria `activities` para e-mails inbound relacionadas à entidade. Duas hipóteses:
  - **Já cria**: nenhum ajuste extra; o novo render passa a exibi-los com corpo/anexos.
  - **Não cria**: incluir passo adicional no `load()` da timeline para buscar `email_messages` inbound cujos `thread_id` pertençam a threads da entidade (`email_threads` com `contact_id/lead_id/deal_id/company_id` = entidade) e "virtualizá-los" como itens de timeline (mesmo padrão já usado para eventos de calendário via `calendarVirtuals`).
- Escolher o caminho com base na descoberta; documentar no PR o que foi feito.

### 5. `src/lib/email-send.functions.ts`
- Remover o bloco `storage.remove(...)` de anexos após envio (linhas 172-178). Anexos permanecem no bucket para download futuro; a RLS já restringe a leitura ao owner.

## Fora do escopo
- Redesign visual amplo dos demais itens da timeline.
- Mudanças em RLS/schema, no bucket ou no pipeline de sync do Gmail.
- Analytics de e-mail (relatório agregado permanece).
