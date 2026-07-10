## Objetivo
Deixar o e-mail na timeline com aparência próxima à do Gmail: aberto por padrão, cabeçalho estruturado, corpo formatado fielmente (HTML rico do provedor, sem distorção do `.prose`), anexos como cards de download e métricas discretas — igual ou melhor que o print de referência.

## Diagnóstico
Em `src/components/activity-timeline.tsx` (bloco `type === "email"`, ~L1774-1879):
- O corpo fica escondido atrás de "Ver e-mail" e, quando aberto, renderiza via `<HtmlContent />` (usa classes `prose prose-sm`) — isso reformata cabeçalhos, listas, tabelas e tipografia do e-mail original, o que faz textos plain com `\n` colapsarem em um bloco único e HTML de marketing perder layout.
- Quando o outbound veio só como `body_text` (composer sem HTML), a timeline não converte quebras de linha para `<br>`, então aparece como texto cru contínuo.
- Cabeçalho atual é apenas "Para:/De:" em texto pequeno, sem avatar/nome, sem toggle de cc/bcc, sem hora relativa.
- Anexos são chips pequenos em linha; queremos cards mais legíveis com ícone por extensão, nome e tamanho.
- Métricas usam `Badge` "default" grande (visível demais); precisam virar chips discretos.

## Mudanças (apenas UI/apresentação)

### `src/components/activity-timeline.tsx` — reescrever o bloco `type === "email"`

1. **Aberto por padrão.** Trocar o modelo de "clicar em Ver e-mail" por uma pré-visualização sempre visível. Manter estado `expandedEmails` só como flag "ver conteúdo completo" quando o corpo passar de ~420 px de altura (colapsa com máscara/gradient e botão "Ver mensagem completa"). Corpos curtos aparecem inteiros sem toggle.

2. **Cabeçalho estilo Gmail:**
   - Avatar circular (Avatar do shadcn) com iniciais de `from_name`/`from_email` (inbound) ou do owner (outbound). Cor de fundo derivada por hash simples do email para consistência.
   - Linha 1: `from_name` em negrito + `<email>` em muted; à direita, hora relativa (`formatDateTime` já usado). Ícone `Paperclip` pequeno ao lado da hora se houver anexos.
   - Linha 2 colapsada: "para {primeiro destinatário} +N" com chevron; ao clicar, expande painel com `De`, `Para` (lista completa) e `Cc` quando existir. Mesmo padrão do Gmail.

3. **Corpo com fidelidade visual:**
   - Renderizar o HTML em um `<iframe sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={...} referrerPolicy="no-referrer">` com altura auto-ajustada (medir `scrollHeight` no `onLoad` e setar via ref). Isso isola o CSS do e-mail do `.prose` da app e evita reformatação — é o padrão que clientes de e-mail usam.
   - `srcDoc` = `sanitizeHtml(body_html)` já existente + um `<base target="_blank">` e um wrapper com fonte/tamanho neutros e `word-wrap: break-word; max-width:100%; img{max-width:100%;height:auto}`.
   - Fallback: se só houver `body_text`, gerar HTML a partir dele escapando entidades e trocando `\n` por `<br>` antes de mandar ao iframe.
   - Fallback do fallback: se o iframe falhar (SSR / ambiente sem `srcDoc`), cair para `<HtmlContent />` como hoje.
   - `max-height` inicial 420 px com máscara de fade e botão "Ver mensagem completa" / "Recolher".

4. **Anexos como cards:**
   - Grid (`flex flex-wrap gap-2`) com cards ~260 px: ícone por extensão (PDF/DOC/XLS/IMG/ZIP/genérico com `FileText`, `FileSpreadsheet`, `Image`, `Archive`, `File`), nome truncado, tamanho em muted, botão `Download` alinhado à direita. Reaproveita `openEmailAttachment` para gerar signed URL.
   - Se `att.path` ausente, card fica em estado desabilitado com tooltip "Anexo indisponível".

5. **Métricas discretas (só outbound com envio bem-sucedido):**
   - Rodapé em `text-xs text-muted-foreground` com ícones inline `Eye`/`MousePointerClick`: "14 aberturas · 0 cliques · Última abertura em {data}". Sem `Badge default` chamativo; usar `Badge variant="secondary"` apenas quando > 0.
   - Ocultar linha inteira quando não houver eventos ainda.

6. **Container:**
   - Envelope em `rounded-lg border bg-card` com padding uniforme, alinhado ao padrão dos demais itens da timeline (usar tokens semânticos, sem cores fixas).
   - Remover badges duplicados "Enviado"/"Sent" que aparecem embaixo (bloco `~L1953`): quando `type === "email"` e há `emailMeta`, suprimir os badges genéricos de `email_direction`/`email_status` para evitar redundância vista no print.

## Fora do escopo
- Alterar sync/ingestão de e-mails, RLS, schema, edge functions ou o sanitizer global.
- Rerender do card do topo (já removido) ou de `email-engagement-card.tsx` (analytics).
- Composer, envio ou anexos do lado do backend.

## Verificação manual
1. Abrir um deal com e-mail outbound recente + anexo PDF: cabeçalho mostra avatar/nome/hora, corpo formatado como no Gmail, anexo como card, métricas em rodapé discreto.
2. Abrir e-mail inbound: header mostra "De: nome <email>", corpo preserva HTML rico (imagens, tabelas), sem métricas.
3. E-mail com corpo longo: colapsa com fade e botão "Ver mensagem completa"; expandir mostra tudo.
4. E-mail só com `body_text` (\n): renderiza com quebras de linha corretas.
