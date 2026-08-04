# Correção: conexão do Gmail parece "não acontecer nada"

## Diagnóstico (confirmado)

A conta da Cristiane **foi conectada com sucesso**. Existe registro em `email_accounts`:

- e-mail: cristiane.menezes@wktechnology.com.br
- status: `connected`, com refresh token válido, atualizado hoje 20:40 UTC

O problema é na **leitura** da lista de contas na tela `/settings/email`.

A coluna `signature_html` foi adicionada em `email_accounts` na migration de hoje, mas
sem conceder permissão de leitura ao papel `authenticated`. Verificado no banco:

```text
has_column_privilege('authenticated', 'email_accounts', 'signature_html', 'SELECT') = false
has_column_privilege('authenticated', 'email_accounts', 'email',          'SELECT') = true
```

A função `listEmailAccounts` (`src/lib/email-accounts.functions.ts`) seleciona
`signature_html`, então a consulta é recusada por falta de permissão de coluna. A tela
não lista nenhuma conta e o usuário conclui que a conexão não funcionou.

## Correção

1. Nova migration concedendo permissão de coluna faltante em `public.email_accounts`
   para `authenticated`:
   - `GRANT SELECT (signature_html)`
   - `GRANT UPDATE (signature_html)` — necessário para `saveEmailSignature`
   - manter `access_token` e `refresh_token` sem acesso (segurança atual preservada)
2. Verificar, com consulta ao banco após a migration, que
   `has_column_privilege('authenticated', ..., 'signature_html', 'SELECT'/'UPDATE')` = true.
3. Verificar se a mesma omissão ocorreu em `activities.remind_before_minutes` e
   `activities.reminder_sent_at` (adicionadas na mesma migration) e conceder as
   permissões faltantes no mesmo arquivo, se for o caso.

## Detalhes técnicos

- Nenhuma alteração de RLS, de policies ou de lógica de negócio: apenas grants de coluna,
  aditivos, no padrão já usado nas migrations `20260606171823` e `20260609151427`.
- Nenhum arquivo de frontend precisa mudar; a tela volta a listar as contas
  automaticamente após o grant.
- Sem impacto em dados existentes.

## Como validar manualmente

1. Pedir à Cristiane para abrir `/settings/email` — a conta
   cristiane.menezes@wktechnology.com.br deve aparecer como **Conectada**.
2. Salvar uma assinatura na conta e recarregar a página para confirmar persistência.
