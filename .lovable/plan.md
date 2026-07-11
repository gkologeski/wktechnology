## Diagnóstico

Ao clicar em **Entrar** no card TechSales de `/home`, o app parece "só dar refresh". A causa está em `openModule` (helper local em `src/routes/_authenticated/home.index.tsx`, também duplicado em `src/routes/_authenticated/workspace.modules.tsx`):

```ts
const url = buildModuleUrl(moduleId, "/"); // <- sempre "/"
if (isCrossHostUrl(url)) window.open(url, "_blank", "noopener,noreferrer");
else window.location.assign(url);
```

Comportamento hoje:

- **Mesmo host (preview / lovable.app / o host onde `/home` está sendo servido):** `buildModuleUrl` devolve `"/"`, então `window.location.assign("/")` recarrega a raiz. A raiz autenticada redireciona de volta para `/home` — daí a sensação de "refresh sem navegar".
- **Cross-host (produção com subdomínio do módulo):** abre `https://crm.wktechnology.com.br/` em nova aba; como não há uma rota `/`, cai de novo no `/home` do próprio módulo, gerando o mesmo efeito.

A rota inicial correta de cada módulo já existe em `src/lib/modules/registry.ts` como `defaultRoute` (`/dashboard` para CRM, `/ats-dashboard` para ATS), mas `openModule` não a usa.

## Correção proposta

Usar `MODULES[moduleId].defaultRoute` ao montar a URL, e navegar de forma coerente com o modo (SPA vs cross-host):

1. **`src/routes/_authenticated/home.index.tsx`**
   - Importar `MODULES` de `@/lib/modules/registry`.
   - Substituir a implementação de `openModule`:
     ```ts
     function openModule(moduleId: ModuleId) {
       const target = MODULES[moduleId].defaultRoute; // ex.: "/dashboard"
       const url = buildModuleUrl(moduleId, target);
       if (isCrossHostUrl(url)) {
         window.location.assign(url); // mesmo tab, evita popup blocker
       } else {
         window.location.assign(url); // SPA no mesmo host
       }
     }
     ```
     Observação: manter `window.location.assign` também para cross-host porque abrir o módulo em nova aba não é o comportamento esperado pelo usuário (ele reportou que quer "ir para o módulo"). Sem `target="_blank"`, evita também bloqueio de popup silencioso.

2. **`src/routes/_authenticated/workspace.modules.tsx`**
   - Aplicar exatamente a mesma correção no `openModule` local (mesmo bug duplicado). Mantém consistência entre `/home` e `/workspace/modules`.

Nenhuma outra alteração de escopo: sem mexer em RLS, server functions, schema, design system, ou em outras telas.

## Como validar manualmente

- No preview / lovable.app, em `/home`, clicar **Entrar** no card TechSales deve levar para `/dashboard` (CRM) na mesma aba. No card TechHire, para `/ats-dashboard`.
- Em produção com subdomínios configurados (`crm.wktechnology.com.br` / `ats.wktechnology.com.br`), o mesmo botão deve navegar para `https://crm.wktechnology.com.br/dashboard` ou `https://ats.wktechnology.com.br/ats-dashboard`.
- Repetir o mesmo teste em `/workspace/modules`.

## Fora de escopo

- Reabrir em nova aba quando cross-host (pode ser preferência futura, mas hoje o usuário quer ir para o módulo).
- Ajustes visuais no card, no header ou no restante de `/home`.
- Qualquer mudança de permissões, roles ou dados retornados por `listWorkspaceModules`.
