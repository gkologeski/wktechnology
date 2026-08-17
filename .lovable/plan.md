# Drenar os 5.077 eventos pendentes do backfill

## O que a verificação mostrou

- 5.077 eventos pendentes do tipo `updated` em `leads`, todos criados em 17/08 às 15:11 — gerados pelo backfill de etapas, não por ação de usuário.
- 16 eventos `stage_changed` de leads pendentes (15:14 até 17:10), presos atrás do backlog.
- Os dois únicos workflows de Leads publicados e ativos ("Pesquisa de qualificação ao entrar em Em qualificação" e "Abrir criação de oportunidade ao entrar em Oportunidade") disparam **somente** em `stage_changed`. Nenhum workflow ativo escuta `updated`.

Consequência: processar os 5.077 eventos `updated` pelo motor não executaria nenhuma ação — apenas gastaria ~100 ciclos de fila (50 por vez) para marcá-los como processados. O resultado final é idêntico a marcá-los como processados diretamente, e sem risco de efeito colateral em massa.

## Execução proposta

1. **Drenar os eventos do backfill** (migration de dados): marcar `processed_at = now()` nos eventos pendentes de `leads` com `event_type = 'updated'` criados na janela do backfill (17/08 15:11). Nada de `stage_changed` é tocado.
2. **Processar a fila real restante**: com o backlog fora do caminho, os 16 `stage_changed` de leads e os eventos pendentes de ATS passam a ser consumidos normalmente pelo cron (`workflows-tick`, 50 por ciclo), ou imediatamente ao abrir/mover um lead.
3. **Conferir o resultado**: nova contagem de pendentes por entidade/evento e verificação de que as execuções dos dois workflows aparecem com sucesso.

## Detalhes técnicos

- Migration única, apenas de dados:
  `update public.workflow_events set processed_at = now() where processed_at is null and entity = 'leads' and event_type = 'updated' and created_at >= '2026-08-17 15:00:00+00' and created_at < '2026-08-17 16:00:00+00'`.
- Sem alteração de schema, RLS, grants, triggers, workflows ou código da aplicação.
- Os eventos `stage_changed` e todos os eventos de ATS permanecem pendentes e serão processados pelo motor sem mudança de comportamento.

## Como validar

1. Consultar `workflow_events` pendentes: `leads/updated` deve ir a zero.
2. Aguardar (ou disparar) um ciclo do tick e confirmar que os `stage_changed` pendentes são processados.
3. Mover um lead para "Em qualificação" e confirmar que o modal de qualificação abre.
