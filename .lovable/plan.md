# Lembretes de tarefas: diagnóstico e correção do agendamento

## Como funciona hoje

1. A tarefa/atividade guarda `due_date` e `remind_before_minutes` (0 = "na hora do vencimento").
2. Um job agendado no banco chama a cada 5 minutos o endpoint interno de lembretes.
3. O endpoint valida a credencial de cron e roda o motor `activity-reminders`, que:
   - busca atividades não concluídas cujo horário de lembrete chegou;
   - cria notificação no sino (respeitando as preferências da categoria "Tarefas");
   - envia e-mail só se o usuário habilitou e-mail para "Tarefas" (padrão: desligado);
   - marca `reminder_sent_at` para não repetir.
4. No app, o sino recebe a notificação em tempo real, com toast, som e tremor.

Ou seja: a funcionalidade está implementada de ponta a ponta. O que falhou foi a autenticação da chamada agendada.

## Causa confirmada do seu teste

- A tarefa "teste de tarefa" (vencimento 14:37, lembrete "na hora") ficou com `reminder_sent_at` vazio — o motor nunca a processou.
- O job roda pontualmente a cada 5 minutos e o banco registra "succeeded", mas a resposta HTTP do endpoint é **401 Unauthorized** em todas as execuções.
- Motivo: esse job monta o cabeçalho de autorização a partir de um segredo guardado no banco, que **não é igual** ao segredo de cron que a aplicação valida. Chamando o mesmo endpoint com a credencial correta, ele responde `200` e processa os lembretes normalmente.
- Mesmo problema afeta outros dois jobs que usam a mesma fonte de segredo: `ats-interview-reminders` (lembretes de entrevista) e `unipile-invites-sync`.

Observação de transparência: durante o diagnóstico eu chamei o endpoint uma vez com a credencial correta para confirmar a causa, e isso disparou as 2 notificações pendentes (incluindo a da sua tarefa de teste). Você deve vê-las no sino.

## Correção proposta

1. Reagendar os 3 jobs afetados (`activity-reminders-tick`, `ats-interview-reminders`, `unipile-invites-sync`) usando exatamente a mesma credencial de cron que a aplicação valida, no mesmo padrão dos demais jobs que já funcionam.
2. Padronizar: nenhum job de cron deve montar o segredo a partir de fonte diferente da usada pela aplicação.
3. Registrar log de execução do tick de lembretes (hoje o histórico de execuções de lembretes está vazio, porque o handler nunca chegou a rodar) para que falhas futuras fiquem visíveis.
4. Adicionar um verificador de saúde: sinalizar na tela de status de cron quando um job tiver retornado 401/erro nas últimas execuções, em vez de apenas "succeeded" do agendador.
5. Validar com uma tarefa de teste nova (vencimento em ~6 minutos, lembrete "na hora") e conferir notificação no sino e `reminder_sent_at` preenchido.

## Detalhes técnicos

- Reagendamento via migration usando `cron.unschedule` + `cron.schedule` para os 3 jobs, com header `Authorization: Bearer <CRON_SECRET da aplicação>` no mesmo formato dos jobs saudáveis.
- `src/routes/api/public/hooks/activity-reminders-tick.ts` e `src/lib/cron-auth.server.ts` não mudam — a validação está correta.
- Observabilidade: `runCronWithLogging` já grava em `cron_run_logs`; incluir também registro de tentativas rejeitadas (401) para diagnóstico, e exibir o último status por job na tela de status de cron.

## Fora de escopo

- Nenhuma alteração no motor de lembretes, nas preferências de notificação ou nos canais existentes.
- Web Push (lembrete com a aba fechada) continua não implementado; posso planejar depois.
