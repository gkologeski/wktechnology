# Plano: Cross-entity Timeline + Vínculo de Reuniões ao Negócio

Resolve dois problemas em uma única entrega coerente:

1. **Reunião do Google Calendar não aparece no Negócio recém-criado** (caso Ignacio Celedon).
2. **Generalizar**: ao abrir/criar qualquer entidade ligada a outra, espelhar o histórico relevante da entidade pai, com seletor de período (presets em pt-BR).

---

## Parte A — Diagnóstico do caso atual (já investigado)

O dado existe: o `calendar_event` `cba435e8…` está com `related_contact_id` = Ignacio, attendees corretos e horário 15:00–15:30 GMT-3. O código em `activity-timeline.tsx` (linhas 343–489) já tenta espelhar calendar_events do contato do deal. Causas prováveis da invisibilidade observada:

- A timeline só busca `calendar_events` **na primeira renderização** do deal — não há invalidação quando o sync do Google roda em background.
- O filtro `calendarEventTargetsEmails` exige que o domínio do contato não esteja entre os "internal domains". Funciona neste caso, mas é frágil quando o sync ainda não preencheu attendees.
- Não há indexação por `(related_contact_id, start_at)` em `calendar_events`, então a query escala mal e tende a ser cortada.
- O deal-detail-drawer e a página `/deals/$id` montam a timeline independentes; cache do TanStack Query não é invalidado quando o Google Calendar webhook insere/atualiza um evento.

A Parte B resolve isso de forma estrutural.

---

## Parte B — Modelo de "espelhamento" (definitivo)

Decisão arquitetural: **espelhar em vez de duplicar**. Nenhum INSERT em `activities`. A timeline passa a consultar uma fonte unificada por entidade.

### B.1 — View consolidada `timeline_items`

Uma view materializada virtual (Postgres view com `security_invoker=on`) que une, por workspace:

```text
activities  →  type, subject, body, related_*_id, owner, due_date, created_at
emails      →  related_*_id via thread/contact match
meetings    →  related_*_id (já existe)
calendar_events → expandido com related_deal_id derivado do contato
whatsapp_messages → via conversa↔contato
notes (em activities type='note')
```

Cada item carrega: `id`, `source`, `type`, `subject`, `body_excerpt`, `occurred_at`, `actor_id`, `direct_link` (true = vínculo direto na entidade), `mirrored_from` (origem do espelhamento), `workspace_id` + colunas `related_contact_id | related_company_id | related_deal_id | related_lead_id | related_ticket_id`.

### B.2 — Função RPC `get_entity_timeline(entity_kind, entity_id, since, until, limit)`

Server-side, SECURITY INVOKER, recebe:

- `entity_kind`: `'deal' | 'contact' | 'company' | 'lead' | 'ticket'`
- `entity_id`: UUID
- `since` / `until`: timestamptz nullable (null = sem limite)
- `limit`: default 200

A função resolve o **grafo de espelhamento** uma única vez no servidor:

```text
deal      → primary_contact + deal_contacts + (contact.company_id)
contact   → contact.company_id
company   → todos contacts da company + todos deals da company
ticket    → contact_id + deal_id + company_id
lead      → email match
```

Filtra `timeline_items` por `related_*_id IN (grafo)` + período. Retorna ordenado por `occurred_at DESC`.

### B.3 — Vínculo `calendar_events → deal` (sem coluna nova)

A resolução é feita **na função RPC** (não na tabela), por ser dinâmica: um evento ligado ao contato Ignacio aparece automaticamente no deal X enquanto Ignacio for `primary_contact_id` ou estiver em `deal_contacts`. Sem trigger, sem duplicação, reversível.

Opcional: criar índice parcial `idx_calendar_events_contact_time ON calendar_events(related_contact_id, start_at DESC) WHERE related_contact_id IS NOT NULL` para velocidade.

### B.4 — "Fixar ao Negócio" (escape hatch híbrido)

Botão "Fixar a este negócio" em itens espelhados grava uma row em **nova tabela** `timeline_pins(workspace_id, source, source_id, entity_kind, entity_id, pinned_at, pinned_by)`. Pins são incluídos na resposta da RPC mesmo fora do período — útil para registrar "essa reunião foi decisiva para fechar este deal".

---

## Parte C — Seletor de período (preset pt-BR)

Usa a skill `date-range-picker-br` (já documentada). Cria:

- `src/lib/date-presets.ts` — `getPresetRange(key)` e `PRESETS[]` com grupos: Dias, Semanas, Trimestres, Semestres, Anos, Últimos N dias, Personalizado, **+ "Desde sempre"**.
- `src/components/date-range-picker.tsx` — Popover com Select de presets + Calendar custom.

Default no contexto da timeline: **`allTime`** ("Desde sempre"), conforme escolhido.

A escolha persiste em `user_grid_preferences` por par (`entity_kind`, escopo `timeline`), para que cada usuário tenha sua preferência lembrada.

---

## Parte D — Integração na UI

### D.1 — `activity-timeline.tsx`

- Substituir a montagem manual (8 fontes em paralelo) por **uma chamada** a `get_entity_timeline` via `useSuspenseQuery`.
- Adicionar `<DateRangePicker />` no header da timeline, ao lado do filtro de tipos já existente.
- `queryKey: ["timeline", entity_kind, entity_id, since, until]` → invalidação cirúrgica.
- Badge visual diferenciando: vínculo direto (cinza) vs espelhado (azul-claro com tooltip "Espelhado de Contato: Ignacio").

### D.2 — Realtime

Subscrever canal Postgres Changes em `activities`, `calendar_events`, `meetings`, `emails` filtrado por workspace. Em mudança → `queryClient.invalidateQueries({ queryKey: ["timeline"] })`.

Resolve a queixa original: a reunião aparece sozinha assim que o sync do Google a insere.

### D.3 — Páginas atingidas (rota → arquivo)

- `/deals/$id` → `src/routes/_authenticated/deals.$id.tsx`
- `/contacts/$id` → `src/routes/_authenticated/contacts.$id.tsx`
- `/companies/$id` → `src/routes/_authenticated/companies.$id.tsx`
- `/leads/$id` → `src/routes/_authenticated/leads.$id.tsx`
- `/tickets/$id` → `src/routes/_authenticated/tickets.$id.tsx`
- `deal-detail-drawer.tsx` (consome o mesmo componente)

---

## Parte E — Server function

`src/lib/timeline.functions.ts`:

```ts
getEntityTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    entityKind: z.enum(["deal","contact","company","lead","ticket"]),
    entityId: z.string().uuid(),
    since: z.string().datetime().nullable(),
    until: z.string().datetime().nullable(),
    limit: z.number().int().min(1).max(500).default(200),
  }))
  .handler(...)  // chama RPC get_entity_timeline; RLS aplicada
```

Pin/unpin:
- `pinTimelineItem({ source, sourceId, entityKind, entityId })`
- `unpinTimelineItem({ id })`

---

## Parte F — Validação no caso Ignacio

Após deploy, abrir `/deals/31be50c0-...`:

1. Seletor de período mostra "Desde sempre".
2. A reunião `WK Technology <> FLOWER MARKET SOLUTIONS LTDA` (15:00–15:30 GMT-3) aparece com badge "Espelhado de Ignacio Celedon" e link para o Google Meet.
3. Trocar o período para "Hoje" mantém visível; "Próximo Ano" oculta.
4. Botão "Fixar a este negócio" persiste em `timeline_pins` e o item passa a ser "permanente" no deal.

---

## Detalhes técnicos / impacto

- **Migrations**: 1 função RPC + 1 tabela `timeline_pins` (com GRANTs e RLS por workspace) + 1 índice opcional. Sem alterações destrutivas em tabelas existentes.
- **Sem duplicação de dados**: nenhum INSERT cruzado entre `activities` e `calendar_events`.
- **Performance**: a RPC roda 1 query unificada (vs. 8 round-trips atuais), com índices.
- **Reversibilidade**: trocar a fonte da timeline é uma feature flag; basta apontar o componente para o caminho antigo.
- **Compatível com HubSpot import** já existente (que grava em `activities`).
- **Skill aplicada**: `date-range-picker-br` (presets pt-BR + cálculo de semestres).

## Entregáveis (ordem de implementação)

1. Migration: `timeline_pins` + função RPC `get_entity_timeline` + índice em `calendar_events`.
2. `src/lib/timeline.functions.ts` (server fns).
3. `src/lib/date-presets.ts` + `src/components/date-range-picker.tsx`.
4. Refactor de `activity-timeline.tsx` para consumir RPC + realtime + date picker + badge espelhado.
5. Botão "Fixar" + `pin/unpin` fns.
6. Persistência de preferência de período em `user_grid_preferences`.
7. Smoke test no deal do Ignacio.
