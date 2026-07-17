
## Problema

No wizard de cotação, o botão **Publicar** grava `status = 'sent'` (enviada), mesmo quando o contato não tem e-mail e nenhum envio ocorreu. Além disso, uma vez publicada, não há um caminho claro para enviá-la por e-mail depois (ex.: quando o e-mail do contato é preenchido posteriormente).

## Objetivo

1. **Publicar** apenas publica (gera link público, marca como "Publicada"), sem afirmar envio.
2. **Enviada** só quando o e-mail é de fato disparado.
3. Cotações publicadas (ou em rascunho) podem ser enviadas por e-mail a qualquer momento a partir do card da cotação no negócio.

## Mudanças

### 1. Banco (migration)

- Adicionar o valor `'published'` ao enum `quote_status` (`ALTER TYPE public.quote_status ADD VALUE IF NOT EXISTS 'published' BEFORE 'sent'`).
- Nenhuma alteração de RLS/grants — o enum é apenas ampliado.

### 2. `src/components/deals/quote-wizard.tsx`

- `publishMut`: gravar `status: 'published'` (limpando `sent_at`, que representa "enviada por e-mail"). Toast: "Cotação publicada.".
- `handlePublishAndSend`: publica como `published` e abre `SendEmailDialog`. O envio efetivo (via `onSent`) chama uma nova mutação `markAsSentMut` que grava `status: 'sent'` + `sent_at = now()`.
- Passar `quoteId` para o `SendEmailDialog` e invocar `markAsSentMut` no callback `onSent`.
- Ajustar mensagem quando não há e-mail no contato: "Sem e-mail no contato principal — a cotação será publicada; você poderá enviá-la por e-mail depois que o contato tiver e-mail cadastrado.".

### 3. `src/components/deals/deal-quotes.tsx`

- Adicionar rótulos/cores para `published` (ex.: "Publicada", dot âmbar/roxo suave conforme design system).
- No menu de ações:
  - Substituir "Marcar como enviada" (que hoje só aparece em rascunho) por **"Enviar por e-mail"** disponível quando `status ∈ {draft, published}` **e** o contato principal do negócio tem e-mail. Ao clicar, abre `SendEmailDialog` já preenchido; ao concluir, marca a cotação como `sent` + `sent_at`.
  - Manter "Marcar como enviada" como opção secundária (para registrar envios feitos fora do sistema), disponível em `draft` e `published`.
  - "Editar" continua disponível em `draft` **e** `published` (o wizard já cobre rascunhos; passa a cobrir publicadas também — apenas UI, sem novas regras de negócio).

### 4. Rótulos de status onde `quote_status` é exibido

Adicionar "Publicada" em:
- `src/routes/quote.$token.tsx` (badge do topo e mapa de labels).
- `src/routes/_authenticated/settings.quotes.tsx` (métricas, se aplicável — sem quebrar contagens existentes).

Nenhum outro comportamento server-side é alterado. `sent_at` continua sendo a marca temporal do envio real por e-mail.

## Fora de escopo

- Alterar o fluxo de PDF, template ou pagamento.
- Editar contato/e-mail dentro do wizard (já existe fluxo próprio no detalhe do contato).
- Notificações/automação em cima do novo status.

## Detalhes técnicos

- O enum novo (`published`) é retrocompatível: linhas existentes com `sent` continuam válidas. Não há migração de dados — cotações antigas marcadas erroneamente como `sent` permanecem assim (o usuário pode ajustar manualmente via "Editar" se desejar).
- `updateQuote` em `src/lib/quotes.functions.ts` já aceita `status`/`sent_at` genéricos — não precisa mudar. Após regenerar `types.ts` (automático), o TS aceitará `'published'`.
- Botão "Enviar por e-mail" reutiliza `SendEmailDialog` existente; nenhum novo endpoint.
