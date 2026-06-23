# Corrigir sync incompleto do Google Calendar

## Problema

O `pullGoogleEvents` está sendo morto pelo limite de tempo/subrequests do Cloudflare Worker antes de paginar todos os eventos do calendário. Hoje a paginação só persiste o `sync_token` no **fim** do loop — se o Worker morre no meio, na próxima execução tudo recomeça do zero e nunca chega nos eventos mais antigos/recentes. Resultado: 6.343 eventos importados, `last_synced_at = NULL`, e a reunião "WK Technology <> LRB SOLUTIONS LTDA" continua invisível.

## Solução: paginação retomável + acabar com upserts um-a-um

Três mudanças em `src/lib/calendar/engine.server.ts → pullGoogleEvents`:

### 1. Persistir `pageToken` a cada página

Adicionar coluna `sync_page_token text` em `calendar_accounts`. No início do pull, se já houver `sync_page_token` salvo, retomar de onde parou. Salvar o `pageToken` no banco depois de cada página processada. Limpar ao final.

### 2. Limitar páginas por execução + agendar continuação

Processar no máximo **N páginas por chamada** (ex.: 8 páginas = ~2000 eventos). Se ainda houver `nextPageToken`, salvar e retornar `{ imported, deleted, partial: true }`. O cron de 15min retoma. Para o usuário não esperar, o botão "Sincronizar agora" reagenda automaticamente (loop client-side) enquanto `partial: true` até virar `partial: false`.

### 3. Upsert em lote

Hoje cada evento é um `upsert` separado (250 subrequests por página!). Acumular o array da página e fazer **um único `upsert`** com todos os 250 — corta drasticamente o consumo do limite de 1.000 subrequests do Worker.

## UI

Em `src/routes/_authenticated/settings.calendars.tsx`:

- `useMutation` do sync: se a resposta vier com `partial: true`, mostrar toast "Sincronizando lote N… continuando…" e reexecutar a mutation automaticamente até completar (com cap de segurança, ex.: máx. 20 lotes).
- Toast final: "Sincronizado: X importados no total".

## Migração SQL

```sql
ALTER TABLE public.calendar_accounts
  ADD COLUMN IF NOT EXISTS sync_page_token text,
  ADD COLUMN IF NOT EXISTS sync_in_progress boolean NOT NULL DEFAULT false;
```

(`sync_in_progress` evita o cron e o botão manual rodarem em paralelo no mesmo account.)

## Validação

Após implementar:
1. Clicar em ⟳ no calendário do guilherme → ver toasts de progresso até "Sincronizado".
2. Query: `SELECT COUNT(*) FROM calendar_events WHERE attendees::text ILIKE '%z3ttagroup%';` deve retornar ≥ 1.
3. Abrir `/deals/7c1a5ca9-3f0d-4887-b4fa-965084f52cef` → reunião na timeline.

## Fora do escopo

- Não vamos reativar `syncPastRecordings` no sync interativo (continua só no cron `tickAllRecordings`).
- Não vamos conectar a conta `domine.automacoes@gmail.com` — os eventos da agenda do guilherme contemplam tudo o que precisa.
