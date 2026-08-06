# Lembrete padrão: "Na hora do vencimento"

## O que muda

1. **Padrão nos formulários** — ao criar uma tarefa/atividade com data de vencimento, o campo Lembrete já vem selecionado como "Na hora do vencimento" (hoje vem "Sem lembrete"). O usuário continua podendo trocar para outra antecedência ou remover o lembrete.
2. **Padrão no banco** — atividades criadas por outros caminhos (workflows, IA, automações) passam a nascer com lembrete "na hora do vencimento" quando não informarem nada.
3. **Atualização das atividades futuras existentes** — todas as atividades com vencimento no futuro e sem lembrete definido passam a ter "Na hora do vencimento". Atividades que já têm lembrete configurado (ex.: 15 minutos antes) são preservadas, assim como atividades já vencidas/concluídas.

Situação atual verificada: das atividades com vencimento futuro, 13 estão sem lembrete, 1 com 15 min e 1 com 60 min.

## Detalhes técnicos

- `src/components/activity-timeline.tsx` e `src/components/record/quick-create-dialogs.tsx`: estado inicial `remindBefore` de `"none"` para `"0"`; a lógica de gravação já converte `"0"` em `remind_before_minutes = 0` quando existe vencimento.
- Migration: `ALTER TABLE public.activities ALTER COLUMN remind_before_minutes SET DEFAULT 0` (sem alterar nulabilidade, para permitir "sem lembrete" explícito).
- Backfill via ferramenta de dados (não migration):
  `UPDATE public.activities SET remind_before_minutes = 0 WHERE remind_before_minutes IS NULL AND due_date > now()`.
- Nenhuma alteração no motor de lembretes (`src/lib/activity-reminders.server.ts`) nem no cron — ele já dispara para `remind_before_minutes = 0`.

## Fora de escopo

- Não altero atividades passadas, nem preferência por usuário/workspace de lembrete padrão configurável.
- Não altero canais de notificação existentes.
