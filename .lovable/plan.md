## Diagnóstico

Ao dar F5 em `/tickets` (e outras rotas), o Service Worker em `public/sw.js` usa `NetworkFirst` para HTML e, se o `fetch` falhar (comum em preview durante recarregamentos do Vite / conexões instáveis), o fallback final é:

```js
.catch(() => caches.match(req).then((c) => c || caches.match("/")))
```

Como `/tickets` não faz parte do `SHELL` cacheado, `caches.match(req)` retorna `undefined` → vem o fallback `caches.match("/")`. Esse HTML da raiz executa a rota `/` (`src/routes/index.tsx`), que faz `redirect({ to: "/home" })`. Resultado: a URL muda para `/home`, abandonando `/tickets`.

O mesmo padrão explicaria refreshes em qualquer rota TechSales / TechHire caindo em `/home` no preview.

## Correção

Alterar `public/sw.js` para não trocar a URL do usuário em nenhum caminho:

1. Bumpar versões de cache (`crm-v3` → `crm-v4`, `crm-runtime-v3` → `crm-runtime-v4`) para invalidar SWs antigos já instalados no navegador do usuário.
2. Remover `"/"` do `SHELL` pré-cacheado (não precisa mais servir de fallback universal).
3. No handler de HTML, remover o fallback `|| caches.match("/")`. Manter apenas: tentar rede → salvar no runtime → em erro, servir o cache da mesma URL, se existir; caso contrário, deixar o erro natural do navegador aparecer (o usuário simplesmente vê "sem conexão" naquela rota, sem perder o path).

Trecho final aproximado:

```js
const CACHE = "crm-v4";
const RUNTIME = "crm-runtime-v4";
const SHELL = ["/favicon.ico", "/manifest.webmanifest"];

// ...
if (isHTML) {
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(RUNTIME).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req)),
  );
  return;
}
```

## Fora de escopo (não mexer agora)

- Rota `/` continua com `redirect({ to: "/home" })` — comportamento correto quando o usuário realmente acessa a raiz.
- `HostRouterGuard`, `ModuleSwitcher`, `_authenticated.tsx` — não estão envolvidos neste bug (host preview deixa o guard inerte, e nenhum deles navega automaticamente para `/home` em refresh).
- `public/manifest.webmanifest` (`start_url: "/dashboard"`) — não afeta refresh de rotas, só instalação PWA.

## Validação

1. Republicar/carregar preview, forçar `Update on reload` no DevTools (Application → Service Workers) uma vez para instalar o `crm-v4`.
2. Ir para `/tickets`, dar F5 → deve continuar em `/tickets`.
3. Repetir em `/deals/<id>`, `/companies`, `/ats/candidates`.
4. Simular offline no DevTools em `/tickets` e recarregar → a página pode mostrar erro de rede, mas a URL não muda para `/home`.
