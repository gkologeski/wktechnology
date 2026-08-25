# Negócios perdidos, taxa de conversão e análise por data de fechamento

Quatro entregas complementares sobre a data real de fechamento dos negócios.

## 1. Data de perda (`deals.lost_at`)

Hoje só existe `closed_at`, preenchido por trigger quando o negócio vai para
"ganho". Os 1.337 negócios perdidos não têm nenhuma data de perda registrada, o
que impede qualquer KPI de perdas por período.

- Nova coluna `deals.lost_at` (timestamp) com índice para consultas por faixa.
- A trigger existente `deals_set_closed_at` passa a cuidar dos dois lados:
  - entra em `lost` → grava `lost_at = now()` (se o app não informou);
  - sai de `lost` → limpa `lost_at`;
  - comportamento atual de `closed_at` para "ganho" fica igual.
- **Backfill a partir do HubSpot**: os registros importados guardam o payload
  original em `deals.hs_raw`. A data `closedate` do HubSpot existe em 1.329 dos
  1.337 perdidos e será usada como `lost_at`. Os 8 sem essa informação ficam sem
  data e são reportados após a execução (nenhum chute de data).

## 2. KPI "Negócios perdidos" e taxa de conversão

Na Home consolidada (seção CRM) e no dashboard do CRM:

- **Negócios perdidos** no período, contados por `lost_at`, com o valor total
  perdido como informação secundária.
- **Taxa de conversão** do período = ganhos ÷ (ganhos + perdidos) fechados no
  intervalo, exibida em porcentagem, com a contagem base como dica.
  Quando não houve fechamento no período, mostra "—" em vez de 0%.

Base sempre restrita ao workspace do usuário pelas regras de acesso já
existentes (nenhuma alteração de RLS).

## 3. Filtro "Fechado entre" na tela de Negócios

- Novo filtro independente na barra de ferramentas, com atalhos de período
  (este mês, últimos 30 dias, trimestre, ano, personalizado) aplicados sobre a
  data real de fechamento (`closed_at` para ganhos, `lost_at` para perdidos).
- Convive com o filtro de período atual, que continua usando a data prevista de
  fechamento — os dois podem ser combinados.
- Aparece como chip removível junto aos demais filtros e vale para todas as
  visões (tabela, kanban, lista, previsão).
- A tela aceita os parâmetros de URL do dashboard, então clicar num KPI de
  ganhos/perdidos abre Negócios já filtrado por aquele intervalo de fechamento.

## 4. Gráfico de fechamentos por mês (`/dashboard`)

No dashboard do CRM, um gráfico de barras dos últimos 12 meses com:

- barras de ganhos e de perdidos por mês de fechamento;
- linha de taxa de conversão do mês;
- alternância entre contagem e valor (R$);
- estados de carregando, vazio e erro; rótulos acessíveis; light/dark mode.

Clicar num mês abre a tela de Negócios com o filtro "Fechado entre" daquele mês.

## Detalhes técnicos

- Migration: `ALTER TABLE public.deals ADD COLUMN lost_at timestamptz`, índice
  parcial `(lost_at)` para `stage = 'lost'`, e `CREATE OR REPLACE FUNCTION
public.deals_set_closed_at()` estendida (mesma trigger, nenhuma nova).
- Backfill em statement separado, lendo
  `hs_raw->'properties'->>'closedate'` com `::timestamptz`, apenas onde
  `stage = 'lost' AND lost_at IS NULL`.
- `src/lib/home/dashboard.functions.ts`: novos agregados de perdidos e cálculo
  da taxa; mantém o padrão `safeCount`/`safeSum` tolerante a falhas.
- Nova server function para a série mensal (`createServerFn` +
  `requireSupabaseAuth`), agregando por mês no servidor para não trafegar a base
  inteira; consumida por `useQuery`.
- `src/components/deals/deals-toolbar.tsx` e
  `src/routes/_authenticated/deals.tsx`: campo `closedRange` em `DealFilters`,
  aplicado na projeção/filtragem já existente; `closed_at` e `lost_at` entram
  nas colunas base do grid e no catálogo de campos (rótulos "Fechado em" e
  "Perdido em").
- Gráfico com `LazyChart` (recharts sob demanda), componentes e tokens do design
  system; nenhuma cor fixa.

## Fora de escopo

- Não altera RLS, permissões, schema de outras tabelas nem a lógica de mudança
  de etapa.
- Não revisa o `closed_at` dos negócios ganhos já preenchido (posso refinar
  depois com a mesma fonte do HubSpot, se quiser).
