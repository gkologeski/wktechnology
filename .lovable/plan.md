# Datas compactas nos cards de Kanban

Reduzir o comprimento das datas exibidas nos cards de quadro sem diminuir a fonte, trocando o formato longo ("31 de Ago de 2026 21:00 GMT-3") por um formato curto e relativo ("Hoje às 21h").

## Regras de formatação

Base: fuso America/Sao_Paulo, comparação por dia-calendário.

| Situação (dia) | Saída |
| --- | --- |
| Hoje | `Hoje às 21h` |
| Ontem | `Ontem às 21h` |
| Anteontem | `Anteontem às 21h` |
| Amanhã | `Amanhã às 9h15min` |
| Depois de amanhã | `Depois de amanhã às 9h` |
| Demais datas do mesmo ano | `14/Jan às 9h15min` |
| Outros anos | `14/Jan/27 às 9h15min` |

Detalhes:
- Minutos zerados: `21h`. Minutos diferentes de zero: `9h15min`.
- Valores só-data (ex.: `expected_close_date`, sem hora): mostra apenas a parte de data (`Hoje`, `14/Jan/27`), sem `às …`.
- Sem GMT/offset no texto. O `title` (tooltip) do elemento passa a conter a data completa atual, preservando a informação detalhada em hover/leitor de tela.
- Valor ausente/ inválido: mantém o comportamento atual (`Sem data` / `—`).

## Onde aplicar

Apenas superfícies de card de quadro (Kanban), sem tocar em grids, tabelas, timeline ou relatórios:

- `src/components/deals/deals-board-card.tsx` — data prevista de fechamento e próxima atividade.
- Cards de quadro que já usam `formatDateTime(...).split(" ")[0]` nas visões Quadro: Financeiro (`entries-list-page.tsx`), NFS-e, Faturas, Projetos e Tarefas (somente o trecho renderizado no card do quadro), Incidentes de Pessoas e Contratos (card de quadro).
- `src/components/tickets/ticket-card.tsx` já usa formato curto (`3d`) — sem alteração.

## Detalhes técnicos

- Novo módulo `src/lib/format/compact-date.ts` exportando `formatCompactDateTime(value, opts?)` e `formatCompactDate(value)`, com detecção de "só data" (`YYYY-MM-DD`) e cálculo relativo por diferença de dias no fuso BR.
- Reaproveita a lógica de fuso existente em `src/lib/crm.ts` (`BR_TZ`); `formatDate`/`formatDateTime` continuam intactos para as demais telas.
- Testes unitários em `tests/` cobrindo: hoje/ontem/anteontem/amanhã, mesmo ano, outro ano, minutos zerados vs. não zerados, valor só-data e valor inválido (datas fixas via fake timers).
- Sem alterações de schema, RLS, permissões ou lógica de negócio.

## Validação

`bunx tsgo --noEmit`, `bun run lint` nos arquivos alterados e `bun run test`.
