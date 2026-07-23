## Problema

E-mails legados na timeline contêm URLs corrompidas onde o host antigo `https://wktechnology.lovable.app` (ou preview) ficou colado imediatamente antes da URL canônica, gerando links como:

`https://wktechnology.lovable.apphttps://app.wktechnology.com.br/quote/…`

Isso é resíduo do backfill anterior, que substituiu o corpo do link de rastreio mas manteve o prefixo original do host. Confirmado no banco: 2 registros com esse padrão exato, incluindo o e-mail reportado do deal `8da84ad6-…`.

## Correção

Migration única no banco para normalizar `email_messages`:

- Em `body_html` e `body_text`, remover qualquer prefixo `https?://<host-lovable>` que esteja **imediatamente colado** a outro `https?://`, mantendo somente a URL canônica que vem depois.
- Regex aplicada:
  - `regexp_replace(col, 'https?://[^"'' <>]*lovable\.app(?=https?://)', '', 'g')`
- Escopo restrito a linhas onde o padrão existe, para não tocar em e-mails saudáveis.

Não altera código de aplicação — o helper `getPublicAppUrl()` já emite links corretos para envios novos.

## Validação

- `SELECT count(*)` do padrão antes/depois (esperado: 2 → 0).
- Conferir o e-mail `b273d45f-…` do deal reportado renderiza um link único apontando para `https://app.wktechnology.com.br/quote/d188ba86…`.
