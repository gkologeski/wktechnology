## Problema

Na tela de detalhes de um negócio (`/deals/$id`), o botão **Ver gravação** de uma reunião do Google Calendar abre a gravação de outro negócio. Causa: a função Postgres `public.get_entity_timeline` mescla `calendar_events` no timeline do deal filtrando apenas por `ce.related_contact_id = ANY(v_contact_ids)`. Como `v_contact_ids` reúne todos os contatos do deal (primary_contact + `deal_contacts`), **todos** os eventos de calendário desses contatos entram na timeline — inclusive os que pertencem a outros negócios do mesmo contato. O card então mostra o `recording_url` do evento vizinho, e "Ver gravação" abre a gravação errada.

O bug é de dados/associação — a UI (`src/components/activity-timeline.tsx`) já mapeia corretamente `recording_url` por evento; ela só recebe eventos que não deveriam estar ali.

## Alteração

### Migration: reescrever `public.get_entity_timeline`

Manter todo o comportamento atual e alterar apenas o bloco `UNION ALL` que junta `calendar_events`. Passar a incluir eventos no timeline quando:

- `p_entity_kind = 'contact'` e `ce.related_contact_id = p_entity_id` (comportamento atual), **ou**
- `p_entity_kind IN ('deal','lead','ticket','company')` e o evento estiver ligado a uma `activity` cuja associação bate com a entidade atual — ou seja, existe `activities a` com `a.id = ce.related_activity_id` e:
  - para `deal`: `a.related_deal_id = p_entity_id`
  - para `lead`: `a.related_lead_id = p_entity_id`
  - para `ticket`: `a.related_ticket_id = p_entity_id`
  - para `company`: `a.related_company_id = p_entity_id` OR `a.related_contact_id = ANY(v_contact_ids)`

Ajustar também `direct_link` e o `mirrored_from_*` desse trecho para refletir a nova origem: quando o match é via activity de outra entidade, marcar `mirrored_from_kind = 'activity'` e `mirrored_from_id = a.id`; em contato continua com o comportamento atual.

Nada muda em: filtro por `workspace_id`, filtros de data, pins, LIMIT, colunas retornadas, RLS, GRANTs, e demais UNIONs (activities, meetings, emails, whatsapp).

### Nenhuma alteração em outros arquivos

- `src/components/activity-timeline.tsx` e demais componentes de UI permanecem inalterados; passam a receber somente os eventos corretos.
- Sem alteração de schema em `calendar_events` — não é necessário adicionar `related_deal_id`.
- Sem alteração em `src/lib/calendar/engine.server.ts` — o vínculo por `related_activity_id` já é criado quando a reunião é agendada pelo CRM.

## Validação
- `bunx tsgo --noEmit`.
- Manual em `/deals/54c49367-9744-4254-9687-b7fc4b476a7e`: as reuniões que não pertencem a este deal devem sumir do timeline; "Ver gravação" nos cards remanescentes deve abrir a gravação correta. Repetir em `/contacts/$id` para confirmar que a timeline do contato continua mostrando todos os eventos como antes.

## Riscos
- Reuniões do Google Calendar sincronizadas por participante mas nunca associadas a uma activity do CRM deixarão de aparecer na timeline de deals (mas continuam na do contato). Esse é o comportamento correto — hoje elas apareciam em todo deal do contato, o que era o bug.
