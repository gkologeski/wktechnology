## Diagnóstico

A cotação `Q-202607-6826` (deal `8da84ad6…`) está com `status = 'sent'` e `sent_at = 2026-07-17 19:55`, porém **não existe nenhum e-mail correspondente**: nem em `email_messages` (não há registro com esse assunto/número), nem em `activities` (não há `activity.type='email'` para o deal), e a cotação também não tem `payment_link_url`.

O `SendEmailDialog` só dispara `onSent` após o backend retornar `thread_id` com sucesso, então o marcação de "enviada" nesse caso não veio de um envio real. Duas causas plausíveis, ambas presentes no código atual:

1. **Legado do `publishMut`** — antes da correção desta sessão, "Publicar" gravava `status='sent'` direto. Esta cotação foi criada às 19:36 e provavelmente publicada por essa versão do código, deixando o status errado mesmo após o fix do enum `published`.
2. **`createQuotePaymentLink` em `src/lib/quotes.functions.ts` (linhas 325-337)** ainda promove `draft → sent` ao gerar link de pagamento, o que não é um envio real. Deve promover para `published` (ou não mexer no status). Como esta cotação não tem `payment_link_url`, não foi a causa aqui, mas é o mesmo bug e continuará gerando falsos "enviada".

## Plano

### 1. Corrigir a fonte residual do bug (código)
- **`src/lib/quotes.functions.ts` → `createQuotePaymentLink`**: quando `quote.status === 'draft'`, promover para `'published'` (não para `'sent'`) e **não** setar `sent_at`. Cotações já `published`/`sent`/etc. permanecem inalteradas. Isso alinha com a nova semântica: "enviada" = e-mail realmente disparado.

### 2. Corrigir o dado desta cotação
- Migration pontual: reverter `Q-202607-6826` para `status='published'` e `sent_at=null`, já que não existe evidência de envio (sem `email_messages` com esse assunto, sem `activities.type='email'` no deal, sem `payment_link_url`).

```text
UPDATE quotes
SET status = 'published', sent_at = NULL
WHERE id = '5e798fa9-e71c-4e5f-bb34-f037f0f44df4';
```

### 3. Nada mais é alterado
- UI/menu de cotações já expõe "Enviar por e-mail" para status `published` e o `SendEmailDialog.onSent` já grava `status='sent'` só após sucesso — comportamento correto, mantido.
- Nenhuma alteração em RLS, autenticação, schema além do UPDATE pontual, ou em outras rotas.

## Verificação após implementação
- Recarregar o detalhe do deal e confirmar que a cotação aparece como "Publicada" (badge âmbar) com opção "Enviar por e-mail" disponível.
- Gerar um novo link de pagamento em uma cotação `draft` de teste e confirmar que ela passa para `published`, não para `sent`.