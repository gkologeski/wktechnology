## Diagnóstico

- A reunião existe no banco como evento de calendário:
  - `calendar_events.id = 6fc9a4b2-0291-4427-9f61-28ab127bac1e`
  - título: `WK Technology <> MOBICONN-TI SOFTWARE LTDA`
  - Meet: `eim-xejq-etq`
  - contato: Samuel Portel (`related_contact_id = 155a2b79...`)
- Ela não aparece no deal porque `calendar_events.related_activity_id` está `NULL`.
- O deal `54c49367...` tem Samuel como `primary_contact_id`, mas a função da timeline só espelha calendário para o deal via contato quando a consulta/RPC retorna esse evento; na prática, o evento ficou órfão de activity e sem gravação.
- A gravação também não foi reprocessada após 15 min porque o evento já está em `recording_attempts = 12`, que é o limite automático. O cron ignora eventos `not_found` que já chegaram nesse limite.
- O erro atual ainda é: `nenhuma gravação com o código do Meet 'eim-xejq-etq' na janela de busca`, indicando que o patch publicado não reprocessou esse evento específico ou a busca ampla ainda não encontrou candidato.

## Plano de correção

### 1. Restauração pontual do deal Samuel Portel

- Atualizar somente o evento `6fc9a4b2...` para sair do limite automático:
  - zerar/reduzir `recording_attempts`;
  - limpar `recording_last_error` quando apropriado;
  - manter `recording_status` apto para reprocessamento.
- Reprocessar a gravação desse evento de forma controlada.
- Se o matcher encontrar a gravação, persistir:
  - `recording_drive_file_id`;
  - `recording_url`;
  - `recording_mime_type`;
  - `recording_status = available`;
  - `recording_synced_at`.

### 2. Corrigir o vínculo da reunião com a timeline do deal

- Criar/atualizar o vínculo seguro entre o evento de calendário e a timeline:
  - localizar a activity de reunião já existente do deal no mesmo horário/contato, ou
  - criar uma activity mínima do tipo `meeting` vinculada ao deal/contact/company, se não houver uma activity compatível.
- Atualizar `calendar_events.related_activity_id` para apontar para essa activity.
- Garantir que isso preserve o histórico existente e não duplique cards indevidamente.

### 3. Correção estrutural para novos casos

- Ajustar o fluxo de ingestão/reconciliação de calendário para eventos importados que tenham `related_contact_id` e cujo contato esteja vinculado a um deal:
  - criar ou ligar uma activity de reunião correspondente;
  - preencher `related_activity_id`;
  - evitar duplicidade por `calendar_event_id`/`provider_event_id` e janela de tempo.
- Ajustar o cron de gravações para não deixar eventos permanentemente presos em `not_found` quando o motivo for o matcher antigo:
  - reprocessar seletivamente eventos recentes com erro de “nenhuma gravação com o código do Meet”;
  - manter o limite automático para erros reais e evitar loop infinito.

### 4. Validação

- Confirmar no banco que o evento `6fc9a4b2...` ficou com:
  - `related_activity_id` preenchido;
  - `recording_status = available` se a gravação for encontrada;
  - `recording_url` preenchida.
- Abrir `/deals/54c49367-9744-4254-9687-b7fc4b476a7e` e validar que a reunião aparece na timeline.
- Se a gravação ainda não for encontrada, retornar o motivo exato do Drive/matcher e deixar o evento visível no deal mesmo sem gravação.

## Fora do escopo

- Não alterar regras gerais de associação de contatos/empresas/deals fora de reuniões de calendário.
- Não alterar RLS/permissões.
- Não alterar UI além do necessário para refletir a reunião já carregada pela timeline.
- Não mexer no cron schedule já configurado.