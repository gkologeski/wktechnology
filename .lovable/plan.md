## Problema

A tela `/candidates/$id` não carrega porque o `import()` do chunk lazy falha:

```
Failed to fetch dynamically imported module: /@id/virtual:tanstack-start-client-entry
```

Causa: build novo invalidou os hashes de `assets/*.js`, mas a aba aberta ainda referencia os antigos. Como nada captura essa rejeição, o router fica preso — não há `errorComponent` para falhas de chunk, e o SW pode estar entregando assets obsoletos. O candidato existe no banco e o owner_id confere, então não é problema de RLS/escopo.

## Correção (frontend, sem mexer em regra de negócio)

### 1. Captura global de "chunk perdido" → reload único

Em `src/start.ts` (ou um módulo carregado pelo root), adicionar listeners `window` para `error` e `unhandledrejection` que:

- Detectam mensagens típicas: `Failed to fetch dynamically imported module`, `Importing a module script failed`, `error loading dynamically imported module`.
- Disparam **um único** `window.location.reload()` (guard via `sessionStorage["techhire:chunk-reload"]` com TTL de 30s para evitar loop).
- Antes do reload, fazem `navigator.serviceWorker.getRegistrations()` + `unregister()` e `caches.keys()` + `caches.delete()` para garantir que o reload pegue assets novos.

### 2. `errorComponent` da rota `/candidates/$id`

Hoje o arquivo só tem `component`. Adicionar `errorComponent` e `pendingComponent` no `createFileRoute("/_authenticated/(ats)/candidates/$id")` exibindo fallback "Quiet Premium" com botão "Tentar novamente" que chama `router.invalidate()` + `reset()`. Isso evita tela branca em qualquer outro erro do loader/render.

### 3. Versionamento do Service Worker

Em `public/sw.js`, garantir que o `CACHE_NAME` tenha sufixo de versão e que o `activate` faça `caches.delete` em chaves antigas. Sem alterar a estratégia de cache existente, só elevar a constante de versão para invalidar o cache atual de uma vez.

### 4. Validação

- Após build, abrir `/candidates`, clicar no nome de um candidato e confirmar que a rota carrega (caso normal).
- Simular chunk obsoleto: em DevTools, bloquear um `assets/*.js` específico via "Network → Block request URL", navegar para `/candidates/$id` e verificar que o app faz reload automático em vez de travar.
- Confirmar que não há loop de reload (sessionStorage guard).
- Re-checar `read_runtime_errors` — não deve mais aparecer "Failed to fetch dynamically imported module".

## Arquivos afetados

- `src/start.ts` — adicionar listeners globais (ou criar `src/lib/chunk-reload.ts` e importar em `start.ts` pelo efeito colateral).
- `src/routes/_authenticated/(ats)/candidates.$id.tsx` — adicionar `errorComponent` + `pendingComponent`.
- `public/sw.js` — bump da versão do cache.

## Fora de escopo

- Não alterar `getCandidateDetail`, RLS, schema, ou owner scoping.
- Não mexer no design system nem em outras rotas (a correção do start.ts cobre todas).