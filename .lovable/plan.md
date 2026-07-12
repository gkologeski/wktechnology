## Problema

Após a Fase de reconciliação (`reconcileCalendarActivityLinks`), cada evento de calendário vinculado a um deal passou a existir em duas formas simultâneas na timeline:

- uma `activity` real (type=meeting) com `external_ids.calendar_event_id = <id>` e `related_deal_id` preenchido;
- um item virtual `cal_<id>` construído em `src/components/activity-timeline.tsx` (linhas ~803–864) a partir do RPC `get_entity_timeline`, que continua espelhando `calendar_events` pelo contato.

Resultado: o mesmo evento aparece duas vezes (o card "cheio" da activity + o card "simples" do espelhamento).

## Correção proposta (somente frontend, escopo mínimo)

Em `src/components/activity-timeline.tsx`, ao montar `calendarVirtuals`, filtrar fora todo `calendar_event_id` que já esteja representado por uma activity real já carregada na mesma timeline.

Passos:

1. Antes de construir `calendarVirtuals`, coletar em um `Set<string>` os `calendar_event_id` presentes em `external_ids` das activities reais já carregadas nesta timeline (as que a query base retornou).
2. Ao mapear `events` para `calendarVirtuals`, descartar todo evento cujo `e.id` esteja nesse Set.
3. Manter o restante do fluxo intacto (ordenação, filtros de data, agrupamento por dia, e-mails, etc).

Sem mudanças em backend, RLS, RPC, engine de calendário, ou na criação de activities pela reconciliação. Sem alterar o card "cheio" (activity real) que é o preferido para exibição.

## Validação

- Abrir o deal `54c49367-9744-4254-9687-b7fc4b476a7e` (MOBICONN) e confirmar que a reunião "Reunião Técnica - WK Technology <> MOBICO..." aparece apenas uma vez, no card completo com participantes e "Acessar reunião".
- Abrir um deal cuja reunião ainda não tenha activity espelhada (só existe `calendar_events`): o card virtual `cal_*` deve continuar aparecendo normalmente (sem regressão).
- Em telas de contato/empresa (sem activity espelhada pelo deal), garantir que reuniões continuam aparecendo.

## Fora de escopo

- Não alterar `reconcileCalendarActivityLinks` nem o motor `src/lib/calendar/engine.server.ts`.
- Não alterar o RPC `get_entity_timeline`.
- Não mexer em RLS/permissões.
