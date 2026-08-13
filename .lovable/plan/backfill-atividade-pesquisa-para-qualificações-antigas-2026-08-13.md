# Backfill: atividade "Pesquisa" para qualificações antigas

## Situação verificada

- Existem 10 qualificações em `prospecting_qualifications`; 9 têm decisão concluída
  (1 ainda está `pending`).
- Apenas 1 atividade do tipo `survey` de qualificação existe hoje — a do lead
  `tperuzzo@pr.sebrae.com.br` (criada após a correção). Portanto **8 qualificações
  concluídas** estão sem registro na timeline.
- Todas as qualificações são da entidade `lead` e do mesmo responsável.

## O que será feito

Uma ação administrativa de backfill que, para cada qualificação com decisão
diferente de pendente e sem atividade correspondente:

- cria uma atividade do tipo Pesquisa com assunto "Qualificação — <nome do
  questionário>", corpo com decisão, score/máximo, percentual e motivo (quando
  houver), vinculada ao lead (e ao contato/empresa do lead quando existirem);
- grava a resposta em `activity_survey_responses` (respostas, score e máximo) para
  o card de pesquisa da timeline;
- usa a data da qualificação (`qualified_at`) como data da atividade, para a
  entrada aparecer na posição histórica correta;
- é idempotente: rodar de novo não duplica nada; qualificações pendentes são
  ignoradas.

Ao final, o resultado mostra quantas atividades foram criadas e quantas foram
ignoradas por já existirem.

## Como será acionado

Botão "Backfill de qualificações na timeline" na área administrativa da
plataforma (`/admin`, junto das demais ações de manutenção), restrito a
super-admins, com confirmação e resumo do resultado em toast. Sem cron, sem
endpoint público.

## Detalhes técnicos

- Novo `src/lib/prospecting/qualifications-backfill.functions.ts`: server function
  com `requireSupabaseAuth`, valida `platform_admins`, lê as qualificações via
  `supabaseAdmin` e reaproveita `logQualificationActivity`
  (`src/lib/prospecting/qualification-activity.server.ts`) para cada registro —
  o helper já é idempotente por questionário + registro e já calcula o máximo com
  `computeQualificationMaxScore`.
- Pequeno ajuste no helper para aceitar uma data de referência opcional
  (`occurred_at`/`created_at` da atividade), mantendo o comportamento atual quando
  não informada.
- `workspace_id`/`owner_id` da atividade derivados do lead, como no fluxo normal.
- Sem migration, sem mudança de schema, RLS ou regras de decisão.

## Como validar

1. Abrir a ação de backfill na área de administração e executar.
2. Conferir a timeline do lead `tperuzzo@pr.sebrae.com.br` (entrada única, sem
   duplicar) e de um lead antigo (ex.: `fernando.silva@supero.com.br`), que passa
   a exibir a atividade Pesquisa com decisão e score.
3. Executar novamente: resultado deve indicar 0 criadas.
