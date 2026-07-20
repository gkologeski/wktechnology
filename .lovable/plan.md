## Problema

Cristiane ainda vê **Acesso restrito** ao abrir:

- `/settings/email`
- `/settings/calendars`

Pelos anexos, o bloqueio acontece antes da tela de conexão carregar. O arquivo já em contexto confirma um gate global em `src/routes/_authenticated.tsx`:

- `/settings/email` está em `ADMIN_ONLY`.
- `/settings/calendars` está em `MANAGER_PLUS`.

Isso explica por que a alteração anterior no menu de Configurações não resolveu: a rota continua bloqueada pelo layout autenticado global.

## Plano de correção

1. Alterar somente `src/routes/_authenticated.tsx`.
2. Remover `/settings/email` de `ADMIN_ONLY`.
3. Remover `/settings/calendars` de `MANAGER_PLUS`.
4. Manter as demais permissões de Configurações intactas.
5. Não alterar backend, banco, RLS, OAuth, server functions ou permissões administrativas.

## Resultado esperado

- Usuários membros/vendedores autenticados poderão abrir as telas pessoais de conexão:
  - e-mail pessoal em `/settings/email`;
  - agenda pessoal em `/settings/calendars`.
- A segurança continua por usuário nas funções de conexão/sincronização, não por acesso administrativo à tela.
- Telas realmente administrativas de Configurações continuam bloqueadas.

## Validação

Após implementar:

1. Verificar o diff para garantir que só os dois paths foram removidos das listas globais.
2. Validar que `/settings/email` e `/settings/calendars` não aparecem mais em listas `ADMIN_ONLY`/`MANAGER_PLUS`.
3. Validar manualmente no app com usuário membro/vendedor:
   - abrir `/settings/email`;
   - abrir `/settings/calendars`;
   - confirmar que a tela de conexão aparece em vez de **Acesso restrito**.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>