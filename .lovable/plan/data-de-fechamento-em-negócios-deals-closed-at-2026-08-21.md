# Data de fechamento em Negócios (`deals.closed_at`)

Hoje o KPI "Negócios ganhos" da Home usa `updated_at` como janela de tempo, o que
distorce o número: qualquer edição posterior joga o negócio para outro período.
A correção é registrar a data real de fechamento.

## O que será feito

1. Nova coluna `closed_at` em Negócios, preenchida automaticamente quando o
   negócio entra em uma etapa de ganho (`stage = 'won'`) e limpa se ele voltar
   para uma etapa aberta.
2. Backfill dos 428 negócios já ganhos, usando a data em que entraram na etapa
   atual (histórico de etapas já existente) e, na falta dela, a última
   atualização.
3. KPI "Negócios ganhos" (contagem e valor) da Home passa a filtrar por
   `closed_at`, com data de fechamento exata.

## Detalhes técnicos

**Migration**

- `ALTER TABLE public.deals ADD COLUMN closed_at timestamptz` (nullable).
- Índice parcial `deals_closed_at_idx ON public.deals (workspace_id, closed_at)
  WHERE closed_at IS NOT NULL` para a agregação da Home.
- Função `public.deals_set_closed_at()` (`SECURITY INVOKER`, `SET search_path = public`)
  em trigger `BEFORE INSERT OR UPDATE` na tabela:
  - `NEW.stage = 'won'` e `closed_at IS NULL` → `NEW.closed_at = now()`;
  - saiu de `won` → `NEW.closed_at = NULL`;
  - `closed_at` informado explicitamente pelo app é preservado.
- Backfill: `closed_at = coalesce(entered_at do stage_entries mais recente do
  negócio na etapa atual, updated_at)` para `stage = 'won'`.
- Não altera RLS, GRANTs nem outros triggers de `deals`.

**Código**

- `src/lib/home/dashboard.functions.ts`: os dois KPIs de negócios ganhos
  (contagem e soma de `value`) passam a usar `.gte/.lte("closed_at", …)` em vez
  de `updated_at`, mantendo `stage = 'won'`.
- Nenhuma outra tela é alterada; `closed_at` fica disponível no catálogo de
  campos dos grids (coluna opcional) sem mudança de projeção obrigatória.

## Fora de escopo

- Colunas equivalentes para negócios perdidos (`lost_at`) e KPIs derivados.
- Exibir/editar a data de fechamento no formulário do negócio.

## Validação

- `bun run typecheck`, `bun run lint`.
- Conferir no banco: nenhum negócio `won` com `closed_at` nulo após o backfill.
- Abrir a Home com o CRM habilitado e comparar o KPI para um período fechado.
