# Tempo real

- Tempo real de fichas usa `useRealtimeInvalidate` com `filter` por registro e agrupamento em `src/lib/realtime/invalidation-batcher.ts`; troca de identidade zera o cache via `src/lib/session-cache.ts`; por quê: evitar recargas por eventos alheios e dados do contexto anterior.
- White Label assina só `workspace_branding`/`module_branding` filtrados pelo workspace carregado; troca de workspace é avisada por `notifyWorkspaceChanged` (`src/lib/workspace-events.ts`), nunca por tempo real de `profiles`; por quê: `profiles` tem dados pessoais e não está na publicação.
