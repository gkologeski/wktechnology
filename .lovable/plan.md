## Diagnóstico

Cristiane (perfil Vendedor, membro) está acessando `app.wktechnology.com.br/settings/calendars` e vê "Sem permissão". A confusão inicial ("não consegue conectar Google") na verdade é sobre **conectar a agenda Google pessoal** dela — não é falha de login.

Causa raiz confirmada em `src/routes/_authenticated/settings.tsx:111`:

```ts
{ to: "/settings/calendars", label: "Calendários", icon: Calendar, need: "manager" }
```

O item do menu está restrito a `manager`/`admin`, então:
- O link nem aparece no menu de Configurações para o membro.
- A tela é filtrada como não-permitida na navegação (sensação de "sem permissão").

Isso é inconsistente com `/settings/email` (linha 100), que **não** exige role — e-mail pessoal já é liberado a todos. As server functions do calendário (`startCalendarOAuth`, `listCalendarAccounts`, etc.) já operam por `context.userId` dentro do workspace, ou seja, cada usuário conecta a própria conta Google. Não há motivo funcional para exigir manager.

## Correção proposta

Alteração mínima e cirúrgica, apenas UI/gate de navegação:

1. Em `src/routes/_authenticated/settings.tsx` linha 111, remover `need: "manager"` do item `/settings/calendars`, deixando-o visível a todos os usuários autenticados (mesmo padrão do `/settings/email`).

## Fora do escopo

- Não altero server functions, RLS, schema ou fluxo OAuth.
- Não mexo em outras entradas do menu.
- Não altero permissões de outras telas de Configurações.

## Como validar

1. Logar como Cristiane (perfil Vendedor) em `app.wktechnology.com.br`.
2. Abrir Configurações → item "Calendários" deve aparecer no menu.
3. Clicar em "Conectar Google", concluir consentimento OAuth e ver a conta listada com sync ativo.
4. Validar que admin/manager continuam enxergando normalmente.