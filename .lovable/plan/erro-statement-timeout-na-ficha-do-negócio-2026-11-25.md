# Erro "statement timeout" na ficha do negócio

Porte P/M — estimativa 40–70 min (diagnóstico 15–20 min + correção + testes). Sem publicar.

## O que os registros mostram (14:34 UTC, negócio 7f92d45c…)
- Falhou: `get_timeline_calendar_page` (reuniões do calendário na timeline do negócio) — código 57014.
- Falhou uma vez e depois respondeu: contador de notificações (`notification_center_badge`). Tratar como efeito de carga simultânea, a confirmar.

## Hipótese (ainda não confirmada)
A função percorre `calendar_events` lendo os participantes (JSON) de cada evento e conta "eventos irmãos" de séries recorrentes, tudo sob RLS por linha. Com muitos eventos dos contatos do negócio, isso pode passar de 8 s.

## Passos
1. Medir com EXPLAIN (ANALYZE) a função para este negócio, sob o usuário real, e identificar o trecho lento (candidate_series, long_series, linked, ou RLS de `calendar_events`).
2. Corrigir só o trecho confirmado, sem mudar o resultado, por exemplo:
   - índice parcial/composto em `calendar_events` (workspace_id, related_contact_id) e (calendar_account_id, recurring_event_id) / (calendar_account_id, title) via migration aditiva;
   - e/ou reescrita da função mantendo `SECURITY INVOKER` e RLS do chamador (contexto avaliado uma vez, padrão InitPlan).
3. A timeline não pode ficar vazia em erro: confirmar que a falha do calendário aparece como aviso com "Tentar novamente" sem esconder as outras atividades.
4. Validar: tempo da chamada antes/depois, mesmos itens retornados, teste em banco isolado com rollback (permitido, deny, outro workspace, inativo), `permissions:check`, testes afetados e Playwright autenticado na ficha do negócio.

## Fora do escopo
Sem alterar permissões, cargos, regras de visibilidade ou dados.
