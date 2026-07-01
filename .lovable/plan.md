## Diagnóstico

O `/dashboard` chama duas coisas em paralelo:

1. **RPC `public.dashboard_metrics()`** — hoje faz `count(*)`, `sum(value)` e agregações em `deals` e `leads` **sem filtrar por `owner_id`**. Como é `SECURITY INVOKER`, o RLS filtra linha a linha em cada agregação. Com 2k deals + 5.7k leads é aceitável, mas o pior é o agrupamento `deals_last_30_days` e `value_by_stage` que percorrem toda a tabela sob RLS.
2. **Query em `activities`** — `WHERE completed=false AND due_date IS NOT NULL ORDER BY due_date LIMIT 10` **sem `owner_id`** em uma tabela com **433.530 linhas**. O `pg_stat_statements` mostra essa query com média de 248 ms e picos > 1 s. É o principal ofensor do dashboard.

Não há problema no worker/edge — o gargalo é banco.

## Plano

### 1. Reescrever `dashboard_metrics()` para filtrar por `auth.uid()`
- Adicionar `WHERE owner_id = auth.uid()` (ou `relationship_owner_id` quando aplicável) em todos os agregados.
- Manter `SECURITY INVOKER` e `STABLE`.
- Resultado: reduz cada agregação de "toda a tabela" para "linhas do usuário", eliminando o custo de RLS por linha.

### 2. Otimizar a query de tasks no componente
- Passar a filtrar `activities` também por `owner_id = <auth user>` no cliente, além de `completed=false` e `due_date not null`.
- Reaproveita o índice parcial existente `activities_pending_due_date_idx` combinado com `activities_owner_idx`.
- Criar índice composto de apoio:
  ```sql
  CREATE INDEX IF NOT EXISTS activities_owner_pending_due_idx
    ON public.activities (owner_id, due_date)
    WHERE completed = false AND due_date IS NOT NULL;
  ```

### 3. Cache mais agressivo no cliente
- Elevar `staleTime` do query `["dashboard"]` de 60s para 5 min.
- Marcar `gcTime` 30 min.
- Efeito: navegações repetidas ao dashboard não refazem RPC.

### 4. Verificação
- Rodar `EXPLAIN ANALYZE` da nova query de activities para confirmar uso do índice.
- Medir latência do RPC antes/depois via `pg_stat_statements`.

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — nova versão do `dashboard_metrics()` + índice composto.
- `src/routes/_authenticated/dashboard.tsx` — filtro por `owner_id` na query de activities + `staleTime`/`gcTime`.

## Fora do escopo

- Redesign visual do dashboard.
- Mudar métricas exibidas.
- Alterar RLS de `deals`/`leads`/`activities`.

## Riscos

- Se algum usuário depende de ver métricas de deals que não são dele (ex.: admin), a mudança #1 esconderá esses dados. Atual comportamento já é limitado pelo RLS, então o efeito prático deve ser o mesmo, mas vale confirmar antes de aplicar.

## Pergunta antes de implementar

O dashboard deve mostrar **somente os dados do usuário logado** (owner) ou **todos os dados do workspace** aos quais ele tem acesso via RLS? A resposta muda como escrevo o filtro no RPC.
