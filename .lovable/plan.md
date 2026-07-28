
# Nutrição de leads — comportamento real

Hoje "Enviar para nutrição" só marca `leads.status = 'nurturing'` e avança o índice do player. O lead continua na fila e não entra em nenhum fluxo. Este plano fecha isso.

## 1. Remover automaticamente da fila de prospecção

- Ao decidir `nurture` no `QualificationPanel`, além de atualizar o lead e gravar em `prospecting_qualifications`, marcar o item da fila (`prospecting_queue_items`) como concluído/removido para aquele lead — mesmo estado usado quando o lead é qualificado ou desqualificado.
- Server function existente de qualificação passa a receber a decisão e aplicar o mesmo efeito de saída da fila para `nurture` que já faz para `qualify` / `disqualify`.
- Player (`prospecting.queues.$queueId.play.tsx`) continua avançando via `onDecided`; após o refetch a fila mostra o próximo pendente sem o lead nutrido.

## 2. Inscrever em cadência de nutrição configurável

- Nova coluna `nurture_sequence_id uuid` em `prospecting_queues` (FK opcional para `ats_sourcing_sequences` — a tabela de cadências já usada na prospecção). Configurada na tela da fila; opcional.
- Também um padrão de workspace: entrada em `app_settings` (`prospecting.default_nurture_sequence_id`) usada quando a fila não define uma própria.
- No handler de `nurture`:
  1. Resolve a cadência (fila → workspace → nenhuma).
  2. Se houver, cria `ats_sourcing_enrollments` para o lead com `status = 'active'`, `sequence_id` resolvido, `owner_id = auth.uid()`, respeitando UNIQUE por `(lead_id, sequence_id)` — se já existir enrollment ativo, no-op.
  3. Se não houver cadência configurada, apenas segue (status `nurturing` + saída da fila) e loga na timeline do lead que nenhuma cadência foi aplicada.
- UI: no editor da fila em `/prospecting`, novo campo `Cadência de nutrição` (select das cadências ativas do workspace + "Usar padrão do workspace" + "Nenhuma"). Em `/settings` da prospecção, campo equivalente para o padrão global.
- Feedback no `QualificationPanel`: toast informa se foi inscrito em cadência X ou se nenhuma estava configurada.

## 3. Visão dedicada "Em nutrição"

- Nova rota `src/routes/_authenticated/prospecting.nurturing.tsx` acessível pela aba "Nutrição" no header de `/prospecting` (aparece via permissão `techsales.prospecting.queue.view`, já existente).
- Lista todos os leads do workspace com `status = 'nurturing'`, colunas: Nome, Empresa, Score atual, Cadência ativa (join com `ats_sourcing_enrollments` ativa), Última decisão (`prospecting_qualifications.qualified_at` mais recente), Owner.
- Filtros: cadência, owner, faixa de score, período da decisão. Ações em massa: reabrir fila (voltar `status = 'new'` e re-adicionar em fila escolhida), qualificar direto (abre `CreateDealFromLeadDialog`), desqualificar.
- Também um filtro salvo "Em nutrição" em `/leads` para consistência (só ajusta o `SavedFilter` — nada de schema).

## Detalhes técnicos

- Server function: `nurtureLeadFromQueue({ leadId, queueId, questionnaireId, answers, reason? })` em `src/lib/prospecting/qualification.functions.ts` (ou a fn existente estendida com `decision: 'nurture'`).
  - Atualiza `leads.status = 'nurturing'`, `nurture_started_at = now()` (adicionar coluna).
  - Upsert em `prospecting_qualifications` com `decision = 'nurture'`.
  - Remove/finaliza `prospecting_queue_items` do par (queueId, leadId).
  - Cria `ats_sourcing_enrollments` quando cadência resolvida.
  - Loga `activities` tipo `note` "Enviado para nutrição — cadência: X".
- Migration:
  - `ALTER TABLE prospecting_queues ADD COLUMN nurture_sequence_id uuid REFERENCES ats_sourcing_sequences(id) ON DELETE SET NULL;`
  - `ALTER TABLE leads ADD COLUMN nurture_started_at timestamptz;`
  - Nenhuma mudança em RLS além do padrão já existente para `prospecting_queues` / `leads`.
- Frontend:
  - `QualificationPanel`: chama a nova fn no branch `nurture`; mantém `onDecided`.
  - Editor da fila: adiciona campo cadência.
  - Nova rota `/prospecting/nurturing` reusando `DataTable`, `FilterBar`, `StatusBadge`, `LeadTimelineDrawer`.
  - Header `/prospecting` ganha aba "Nutrição" atrás da mesma permissão de fila.
- Sem alterações em autenticação, roles, ou lógica de scoring.

## Fora do escopo

- Snooze/agendamento por N dias (não pedido).
- Automação de saída de nutrição (voltar para fila quando engajar) — pode virar próxima fase se desejar.
- Novos templates de e-mail de nutrição — usa cadências já cadastradas.

## Validação manual

1. Abrir fila em `/prospecting/queues/:id/play`, qualificar 1 lead como nutrição → lead some da fila, aparece em `/prospecting/nurturing` com status "Em nutrição".
2. Configurar cadência na fila → nova decisão de nutrição cria enrollment em `ats_sourcing_enrollments` (visível na timeline do lead).
3. Reabrir da tela "Em nutrição" → lead volta para `status = 'new'` e para a fila escolhida.
4. Filtro salvo em `/leads` mostra os mesmos leads.
