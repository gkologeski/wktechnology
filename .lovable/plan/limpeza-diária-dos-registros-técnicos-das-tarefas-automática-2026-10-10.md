# Limpeza diária dos registros técnicos das tarefas automáticas

## O que muda
Todo dia às 3h (horário de Brasília) uma limpeza apaga os registros técnicos de execução das tarefas automáticas com mais de 7 dias. Os últimos 7 dias continuam disponíveis para investigar problemas.

Não toca em dados de clientes, eventos de automação nem log de auditoria.

## O que é apagado
- Histórico de execuções exibido pelo app: registros com mais de 7 dias.
- Histórico interno do agendador: registros com mais de 7 dias.
- Respostas das chamadas internas: registros com mais de 1 dia. Elas só servem para depuração imediata e são o maior volume.

## Custo
A limpeza roda uma vez por dia, no fim da madrugada, sem custo relevante.

## Detalhes técnicos
- Uma única tarefa `pg_cron` só com SQL (`cleanup-cron-logs-daily`, `0 6 * * *` UTC), criada pela ferramenta de dados, não por migration:
  - `delete from public.cron_run_logs where created_at < now() - interval '7 days'`
  - `delete from cron.job_run_details where end_time < now() - interval '7 days'`
  - `delete from net._http_response where created < now() - interval '1 day'`
- A tarefa é limitada e idempotente: se rodar duas vezes, a segunda não apaga nada.
- Validação: conferir que a tarefa está agendada e ativa e rodar a mesma limpeza uma vez para confirmar que ela funciona.
- Atualizar a memória da cadência com a regra de retenção de 7 dias.
