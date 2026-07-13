## Diagnóstico

Hoje o `ensureActivityForCalendarEvent` (src/lib/calendar/engine.server.ts:263–372) usa **janela de tempo ±2h** como fallback de matching, o que:

- gera falsos positivos entre reuniões distintas próximas (30 em 30 min);
- gera duplicidade quando a reunião passa da janela;
- não representa a semântica real (a mesma reunião = mesmo Meet ou mesmo evento no Google).

O deal `54c61...` tem 2 activities porque os dois `calendar_events` têm `conference_id` diferentes (`eim-xejq-etq` e `tns-qqun-fwh`) — são reuniões distintas mesmo. O trabalho aqui é garantir que **nunca mais** duas activities apareçam para a mesma reunião real, sem usar tempo.

## Estratégia — igual ao HubSpot: chave canônica estável

No sync HubSpot a chave é `hs_object_id` (id imutável do objeto). Para Google, adotar a mesma ideia com **chave composta determinística**:

```
meeting_key =
  1) 'meet:'   + conference_id                              (quando existir)
  2) 'gcal:'   + recurring_event_id                          (série recorrente)
  3) 'gcal:'   + base_event_id (provider_event_id sem sufixo _YYYYMMDDTHHMMSSZ)
  4) 'title:'  + normalize(title) + '@' + organizer_email    (último recurso, sem tempo)
```

Cada nível é testado em ordem; o primeiro que existir vira a chave. **Nenhum critério envolve start_at/end_at.**

## Plano

### 1. Migration — coluna canônica + índice único + backfill + merge

- Nova coluna `activities.meeting_key text` (nullable).
- Backfill para activities com `external_ids.source = 'google_calendar'`:
  - Recomputa `meeting_key` a partir do `calendar_events` linkado.
- **Merge determinístico** de duplicatas por `(workspace_id, meeting_key)`:
  - Mantém a activity mais antiga (menor `created_at`).
  - Faz coalesce nos campos `recording_url`, `body`, `attachments`, `meeting_location`, `subject` (só copia quando o destino estiver null/vazio).
  - Aponta `calendar_events.related_activity_id` dos órfãos para a sobrevivente.
  - Deleta a duplicata.
- Índice único parcial:
  ```sql
  CREATE UNIQUE INDEX activities_meeting_key_unique
    ON public.activities (workspace_id, meeting_key)
    WHERE meeting_key IS NOT NULL AND type = 'meeting';
  ```
- **Sem CHECK constraint** envolvendo tempo. Sem trigger que use `now()`.

### 2. Helper `computeMeetingKey(event)` (novo, em `engine.server.ts`)

Função pura que recebe `{ conference_id, provider_event_id, recurring_event_id, title, organizer_email }` e devolve a chave conforme a cascata acima. `normalize(title)` = `title.trim().toLowerCase().replace(/\s+/g,' ')`.

### 3. Reescrita de `ensureActivityForCalendarEvent`

Substituir o bloco atual (linhas 290–328) por match **apenas por chave**:

```ts
const meeting_key = computeMeetingKey(event);
if (!meeting_key) { /* fallback: cria activity nova, sem tentar deduplicar */ }

const { data: existing } = await supabaseAdmin
  .from("activities")
  .select("id, external_ids")
  .eq("workspace_id", event.workspace_id)
  .eq("type", "meeting")
  .eq("meeting_key", meeting_key)
  .maybeSingle();

if (existing) {
  // atualiza metadados (calendar_event_id atual, meet_link, html_link,
  // due_date da instância mais recente, subject se veio null antes)
  return { activityId: existing.id, created: false };
}

// INSERT ... com meeting_key preenchido. Usar upsert onConflict=(workspace_id,meeting_key)
// para eliminar corrida.
```

- Zero uso de `start_at`/`end_at`/janela.
- Zero busca por `related_deal_id` ou `related_contact_id` como filtro de dedup (a chave é global no workspace — o link com deal/contact é aplicado depois).

### 4. Ajuste em `reconcileCalendarActivityLinks`

- Mantém o loop, mas o critério de "linkado" passa a ser `related_activity_id IS NOT NULL`.
- Antes de chamar `ensureActivityForCalendarEvent`, pré-computa `meeting_key` para logar/diagnóstico.

### 5. Timeline (`src/components/activity-timeline.tsx`)

Complementar o filtro atual (que hoje só filtra por `calendar_event_id`):

- Coletar dos `baseRows` também o conjunto de `meeting_key`s (via `external_ids.meeting_key` ou recalculado a partir do que a activity já tem).
- Filtrar do `calendarVirtuals` qualquer evento cujo `meeting_key` computado esteja nesse conjunto.
- Assim, mesmo que a activity real esteja linkada a uma instância diferente da série (ou a nenhuma), o card virtual da mesma reunião não aparece em dobro.

### 6. Push (Google → CRM criando reuniões novas)

Ao criar reunião no Google via CRM, gravar `meeting_key` desde a inserção da activity (usando `conference_id` retornado pelo Google ou o `provider_event_id`). Garante que a próxima varredura não crie sósia.

### 7. Correção pontual do deal atual

- Recomputar `meeting_key` para `707538b3` e `2d57c562`:
  - `707538b3` → `meet:eim-xejq-etq`
  - `2d57c562` → `meet:tns-qqun-fwh`
- Chaves diferentes → **não são duplicatas**; ambas permanecem (correto). O usuário verá 2 cards porque são 2 reuniões reais distintas — indicar isso no card com o Meet code visível, para o usuário identificar.

### 8. Observabilidade

- Log estruturado no engine: `[meeting-dedup] key=<...> action=matched|created|skipped_no_key`.
- Contador simples em memória agregado no retorno de `syncCalendarNow` (`matched`, `created`, `skipped_no_key`) exibido na tela `/settings/calendars`.

## Detalhes técnicos

- Arquivos:
  - `supabase/migrations/<ts>_activities_meeting_key.sql`
  - `src/lib/calendar/engine.server.ts` (helper + reescrita do match)
  - `src/components/activity-timeline.tsx` (filtro por meeting_key)
  - `src/routes/_authenticated/settings.calendars.tsx` (exibir métricas retornadas)
- `activities.external_ids` continua guardando `calendar_event_id` e `provider_event_id` para rastreabilidade; a chave canônica vai em coluna própria e no índice único.
- Sem mudanças em RLS/roles: a coluna herda as policies existentes.
- Sem alterações no comportamento de HubSpot (continua usando `hs_object_id`).

## Riscos e mitigação

- **Título homônimo em reuniões distintas** (nível 4 da cascata): mitigado porque só é usado quando não há `conference_id` **nem** `provider_event_id` — cenário raríssimo (eventos manuais sem Meet, mesmo organizador, mesmo título exato).
- **Recorrência com Meet renovado** (Google gera novo `conference_id` por instância): nesse caso o nível 2 (`recurring_event_id`) mantém a chave estável.
- **Corrida em sync paralelo**: `upsert onConflict` no índice único cobre.
- **Migração sem downtime**: coluna nullable + backfill idempotente + merge dentro de transação por `(workspace_id, meeting_key)`.