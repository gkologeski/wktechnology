## Problema

No deal `/deals/54c49367…` (e em qualquer deal/company), reuniões e gravações do Google Calendar não aparecem no timeline mesmo com contatos corretamente relacionados.

Causa: a RPC `public.get_entity_timeline` só espelha `calendar_events` no timeline de `deal`/`lead`/`ticket`/`company` via `calendar_events.related_activity_id → activities.related_<kind>_id`. Para `contact`, usa `ce.related_contact_id` direto — mas essa mesma ligação não é propagada para deal (via contatos do deal) nem para company (via contatos da empresa). O evento do Samuel existe, tem gravação, `related_contact_id` aponta pra ele, e ele é `primary_contact_id` do deal — mas o timeline do deal não o mostra.

## Resposta à dúvida sobre attendees

O plano NÃO adiciona match por lista bruta de attendees. Ele reusa a coluna `calendar_events.related_contact_id`, que já é resolvida no ingest pelo `matchContactForAttendees` em `src/lib/calendar/engine.server.ts` filtrando:

- domínio do dono da conta (ex.: `@wktechnology.com.br`);
- todo attendee marcado `self`/`organizer` (colegas internos, independentemente do domínio);
- priorizando contatos com domínio corporativo sobre free-email.

Cada evento tem no máximo 1 "cliente externo" apontado nessa FK. Casar por ela é equivalente a "filtrar por e-mail do cliente, excluindo funcionários" — e sem replicar essa lógica em SQL.

## Correção

Migration única que substitui `public.get_entity_timeline` mantendo assinatura, colunas, ordenação e limite atuais, adicionando um `UNION ALL` para `calendar_events` quando `p_entity_kind IN ('deal','company')`:

- `deal`: inclui eventos onde `ce.related_contact_id = ANY(v_contact_ids)` (contatos resolvidos de `deals.primary_contact_id` + `deal_contacts`).
- `company`: inclui eventos onde `ce.related_contact_id = ANY(v_contact_ids)` (contatos da company já resolvidos hoje pela RPC).
- `lead`/`ticket`: sem mudança (a RPC não resolve contatos para esses tipos hoje).
- Deduplicação: `WHERE NOT EXISTS (SELECT 1 FROM activities a WHERE a.id = ce.related_activity_id AND a.related_<kind>_id = p_entity_id)` para não repetir eventos que já entram pelo caminho via activity.
- Preserva `workspace_id = v_workspace_id`, filtros `p_since`/`p_until` em `start_at` e `p_limit`.
- Novo bloco marca `direct_link = false` e `mirrored_from_kind = 'contact'`, deixando claro que o evento chegou ao deal/company via contato relacionado.

Nada é alterado em:
- `calendar_events` (schema, RLS, FKs, ingest, `matchContactForAttendees`).
- `activity-timeline.tsx` — já lê `calendar_event` da RPC e enriquece título, `recording_url`, `hangout_link`.
- Regras de negócio, autenticação, permissões, ou o domínio interno hardcoded (continua vindo do ingest, não da RPC).

## Validação

- `bunx tsgo --noEmit` (sanity).
- `SELECT id, source, subject FROM get_entity_timeline('deal','54c49367-9744-4254-9687-b7fc4b476a7e', null, null, 300) WHERE source = 'calendar_event';` — deve retornar as 2 reuniões do Samuel.
- Abrir o deal na UI e confirmar as reuniões e o link de gravação da reunião de 06/07.

## Fora do escopo

- Não altero UI, ingest do calendar, sincronização, gravação/resumo, RLS ou permissões.
- Não introduzo filtro por domínio na RPC — a exclusão de funcionários continua no ingest.
- Não removo nem renomeio funções existentes.