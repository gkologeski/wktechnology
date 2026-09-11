# Conferência das datas de criação, ganho e perda vindas do HubSpot

## O que a verificação no banco mostrou

Boa notícia: no geral **as datas são as originais do HubSpot**, não datas de migração.

| Entidade | Registros | Com dado original do HubSpot | Divergências de data de criação |
| --- | --- | --- | --- |
| Negócios | 1.785 | 1.764 | 0 |
| Contatos | 51.095 | 50.811 | 0 |
| Empresas | 32.015 | 31.906 | 0 |
| Leads | 5.885 | 5.698 | 0 |

Atividades também têm datas antigas reais (a mais antiga é de agosto de 2022).

O que provavelmente causou a impressão: **1.322 negócios aparecem criados em 31/05/2024**.
Essa data vem do próprio HubSpot (é a data de criação registrada lá, provavelmente quando a
base foi carregada no HubSpot), então nada foi perdido no nosso lado — só não é a data real
da primeira conversa daquele negócio. Não temos outra fonte para recuperar isso.

## Onde há realmente erro (poucos casos, em ganho/perda)

Negócios ganhos: 424 | Negócios perdidos: 1.290

- **11 negócios** têm data de ganho/perda gravada em agosto/setembro de 2026 (momento em que
  a etapa foi mexida dentro do TechERP) em vez da data original do HubSpot. Exemplos:
  um perdido em 22/10/2025 aparece como 29/08/2026; um ganho em 30/04/2026 aparece como 02/09/2026.
- **5 negócios perdidos** estão sem data de perda.
- **15 negócios** fechados não têm data de fechamento no dado original do HubSpot
  (12 perdidos, 3 ganhos) — para esses não existe fonte para corrigir.

Efeito prático: os gráficos e KPIs de fechamento por período jogam esses 11 negócios para
agosto/setembro de 2026 e ignoram os 5 sem data.

## O que propõo fazer

1. **Corrigir as 11 datas divergentes**, gravando a data de fechamento original do HubSpot
   na data de ganho (ganhos) ou de perda (perdidos).
2. **Preencher a data de perda dos 5 negócios**, quando o HubSpot tiver a informação;
   os que não tiverem ficam sem data (não vou inventar data).
3. **Evitar a recorrência**: hoje, quando alguém muda a etapa de um negócio importado, o
   sistema sobrescreve a data de fechamento com a data de hoje. Vou passar a preservar a
   data original quando o negócio já tiver uma data de fechamento vinda do HubSpot.
4. Relatar ao final quantos registros foram corrigidos e quantos continuam sem data por
   falta de dado de origem.

## Detalhes técnicos

- Migration de dados em `drizzle/migrations/` com dois `UPDATE` idempotentes sobre `deals`,
  lendo `nullif(hs_raw->'properties'->>'closedate','')::timestamptz`:
  - `stage = 'won'` → `closed_at`; `stage = 'lost'` → `lost_at`, apenas quando divergente
    (comparação por minuto) ou nulo.
  - Limpa `closed_at` residual em perdidos e `lost_at` residual em ganhos.
- Ajuste na função `public.deals_set_closed_at()`: ao entrar em `won`/`lost`, usar a data do
  HubSpot (`hs_raw->'properties'->>'closedate'`) como valor inicial quando existir, mantendo
  `now()` para negócios criados no próprio TechERP e preservando valor informado pelo app.
- Sem alteração de RLS, GRANTs, schema de outras tabelas ou telas.
- Validação: `bun run typecheck`, `bun run lint`, `bun run test`, e reconferência das mesmas
  contagens de divergência (devem ir a zero, exceto os 15 sem dado de origem).

## Fora de escopo

- Recuperar a data "real" dos 1.322 negócios criados em 31/05/2024 (não existe fonte).
- Alterar datas de contatos, empresas, leads e atividades — estão corretas.
