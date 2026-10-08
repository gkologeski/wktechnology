# Tempo real

- Tempo real de fichas usa `useRealtimeInvalidate` com `filter` por registro e agrupamento em `src/lib/realtime/invalidation-batcher.ts`; troca de identidade zera o cache via `src/lib/session-cache.ts`; por quê: evitar recargas por eventos alheios e dados do contexto anterior.
