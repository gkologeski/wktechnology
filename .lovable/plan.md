## Entendido — não precisa conectar `domine.automacoes@gmail.com`

Se a IA marca os eventos **na sua agenda Google** (`guilherme@wktechnology.com.br`), eles aparecem no `events.list` da sua conta primária — independente de quem criou. O sync atual (`pullGoogleEvents` em `src/lib/calendar/engine.server.ts:332`) já puxa tudo do seu `primary` na janela -30/+365 dias. Conectar a conta da IA seria redundante (e até problemático, porque o matching de contato iria casar pelo lado errado).

## O que falta para essas reuniões aparecerem

Sua conta `guilherme@wktechnology.com.br` está em `calendar_accounts` com `sync_enabled=true` mas **sem `refresh_token`** (NULL) — ou seja, o consentimento OAuth original não emitiu o token offline e a sincronização nunca rodou (`last_synced_at` é NULL). O fluxo OAuth atual já força `access_type=offline` + `prompt=consent` (`src/lib/email-oauth.server.ts:84-85, 100-101`), então uma reconexão agora vai persistir o refresh_token corretamente.

## Plano de execução (operacional, sem código)

1. Em `/settings/calendars`, na linha do `guilherme@wktechnology.com.br`: **Desconectar** → **Conectar** de novo, aceitando todas as permissões na tela do Google.
2. Clicar **"Sincronizar agora"** na mesma linha. Primeira execução vai trazer ~30 dias passados + 365 dias futuros do seu calendário.
3. Abrir `/deals/7c1a5ca9-3f0d-4887-b4fa-965084f52cef` — a reunião "WK Technology <> LRB SOLUTIONS LTDA" deve aparecer na timeline, casada via e-mail `comercial@z3ttagroup.com.br` (que é o `primary_contact_id` do deal). O mesmo vale para qualquer outra reunião que a IA marcou na sua agenda.
4. Opcional: também reconectar `grasiele.magalhaes@wktechnology.com.br` (refresh_token revogado, mesmo procedimento).

## Verificação que faço depois que você confirmar que reconectou

Vou rodar um SELECT em `calendar_events` filtrando por `calendar_account_id` da sua conta e contar quantos eventos entraram — se vier 0, sigo o `last_error` para diagnosticar. Se vier >0 mas a reunião do Leandro não aparecer no deal, confiro se o e-mail `comercial@z3ttagroup.com.br` está mesmo na lista de `attendees` do evento que o Google retorna (a IA pode estar omitindo convidados).

## Nada para o build mode agora

Como combinado antes, nenhuma alteração de código é necessária — o problema é 100% credencial OAuth ausente. Aprove esse plano só para registrar a decisão; depois que você reconectar e me avisar, eu valido os dados via SQL.