## Diagnóstico

O erro `Unipile 400 invalid_parameters` com `path: "/account_id"` (type 45 = missing) vem de `POST /api/v1/users/invite`. A correção anterior moveu `account_id` de body → query para os três endpoints (search, message, invite), mas o endpoint `/users/invite` do Unipile continua exigindo `account_id` **no corpo da requisição** (JSON), não em query string. Por isso o schema reporta o parâmetro ausente em `/account_id` (path do body).

Referência: docs Unipile "Send new invitation" — payload obrigatório inclui `account_id` + `provider_id` no body.

## Correção proposta

Em `src/lib/unipile/client.server.ts`, na função `sendLinkedinInvite` (linhas 556-571):

- Remover `query: { account_id: ctx.unipileAccountId }`.
- Adicionar `account_id: ctx.unipileAccountId` no `body`.

Resultado:

```ts
const body: Record<string, unknown> = {
  account_id: ctx.unipileAccountId,
  provider_id: params.providerId,
};
if (params.message?.trim()) body.message = params.message.trim();
return call(ctx, {
  endpoint: "invite.send",
  method: "POST",
  path: "/api/v1/users/invite",
  body,
});
```

## Escopo

- Alterar apenas `sendLinkedinInvite` em `src/lib/unipile/client.server.ts`.
- `sendLinkedinMessage` (POST `/api/v1/chats`) e `linkedinSearch` permanecem com `account_id` em query — foi por onde já validamos funcionamento (200 OK) e a doc do endpoint de chats aceita as duas formas quando o body é multipart; mudar sem sintoma novo geraria regressão. Se mensagens voltarem a dar 400 no mesmo formato, aplicamos o mesmo ajuste (mover para body).

## Validação

1. Chamar `sendLinkedinInviteFn` a partir de `/candidates/:id` (botão de convite) com um `provider_id` já resolvido.
2. Conferir `unipile_message_log` (kind=`invite`) → `status = sent`.
3. Se falhar, capturar payload/response em `unipile_request_log` para novo ajuste.

Sem migrations, sem mudanças de UI, sem mudança de contrato dos server functions.