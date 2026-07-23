## Problema

O e-mail da cotação do deal `8da84ad6-…` foi enviado ANTES do fix do `getPublicAppUrl()` e ficou gravado em `email_messages` com o host de preview (`https://id-preview--68dcfa85-b6da-4030-a825-b896ca621e0c.lovable.app/quote/…`). O fix anterior corrige apenas envios futuros — não reescreve o histórico. Ao clicar no link salvo na timeline, o cliente cai na tela de login do editor Lovable.

## Diagnóstico confirmado

Query em `email_messages`:
- 2 linhas ainda contêm `id-preview--68dcfa85-…lovable.app` em `body_text`/`body_html` (cotações Q-202607-6826 e Q-202607-7713).
- Nenhuma outra tabela textual do schema tem esse host (varredura em `body_html`, `body_text`, `notes`, `description`, `content`, `message`).

## Correção proposta

### 1. Migration de backfill (única, idempotente)

Substituir em `email_messages.body_html` e `email_messages.body_text` toda ocorrência de `https://id-preview--68dcfa85-b6da-4030-a825-b896ca621e0c.lovable.app` por `https://app.wktechnology.com.br`. Preserva o path/token da cotação — só troca o host.

```sql
UPDATE public.email_messages
SET body_html = REPLACE(body_html,
      'https://id-preview--68dcfa85-b6da-4030-a825-b896ca621e0c.lovable.app',
      'https://app.wktechnology.com.br'),
    body_text = REPLACE(body_text,
      'https://id-preview--68dcfa85-b6da-4030-a825-b896ca621e0c.lovable.app',
      'https://app.wktechnology.com.br')
WHERE body_html ILIKE '%id-preview--%'
   OR body_text ILIKE '%id-preview--%';
```

Também rodar o mesmo `REPLACE` genérico por segurança em:
- `email_broadcasts` (`body_html`, `body_text`)
- `ats_candidate_email_queue` (`body_html`, `body_text`)
- `email_templates` (`body_html`, `body_text`)

Com `WHERE … ILIKE '%id-preview--%'` para não tocar linhas limpas. Se count = 0, é no-op.

### 2. Reenvio ao cliente (fora do backfill automático)

O link ORIGINAL entregue no e-mail SMTP do cliente continua com o host de preview — o REPLACE só corrige a timeline interna. Para o destinatário efetivamente receber um link válido, o vendedor precisa reenviar a cotação a partir do wizard (que agora usa `getPublicAppUrl`). Vou deixar isso como passo manual no relatório final — não reenvio automático.

### 3. Verificação

- `SELECT count(*) FROM email_messages WHERE body_html ILIKE '%id-preview--%' OR body_text ILIKE '%id-preview--%';` → 0.
- Abrir o deal `8da84ad6-…` na timeline e confirmar que o link do e-mail antigo agora aponta para `app.wktechnology.com.br/quote/…`.

## Fora do escopo

- Reenvio automático das cotações aos clientes.
- Alteração de qualquer código de aplicação (o fix já está em produção via `getPublicAppUrl()`).
- Tokens de cotação — permanecem os mesmos, apenas o host muda.
