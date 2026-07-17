
## Objetivo

Levar a mesma linguagem visual do kanban de Negócios (borda esquerda, ícone discreto, tooltip, modo de foco) para os demais kanbans do sistema, mas com **critérios de urgência específicos de cada domínio** — nem tudo é "valor".

## Mapa de sinais por kanban

| Kanban | "Hot" (urgência) | "High" (prioridade/valor) | Cold (esmaecer no foco) |
|---|---|---|---|
| **Negócios** (já feito) | score de proximidade de fechamento | Top 20% em valor (p80) | score < 40 |
| **Tickets** (`tickets-board`) | SLA estourado ou < 2h para vencer, ou `updated_at` parado > 24h em stage aberto | `priority` = `urgent` (gem/estrela); `high` = destaque médio | sem atividade > 7 dias em stage aberto |
| **ATS Candidatos** (`ats/candidates`) | parado no stage > X dias (X por stage: applied 3d, screening 5d, entrevistas 7d) OU entrevista agendada nas próximas 48h | `match_score` no Top 20% da vaga | parado > 21 dias sem movimento |
| **ATS Jobs** (kanban de vagas, se houver board) | vaga publicada sem candidato novo em 7 dias | nº de aplicações no Top 20% | vaga em pausa/rascunho antiga |
| **EntityBoard genérico** (`entity-board.tsx`) | opcional: `updated_at` > 14 dias no mesmo stage | — | — |

Regra comum: itens em stage do tipo `won`/`lost`/`closed`/`resolved` **nunca** recebem sinal.

## Arquitetura

Generalizar `src/lib/deals/hot-score.ts` para uma pequena "kanban signals API" reutilizável.

```text
src/lib/kanban/
  signals.ts          // tipos: KanbanSignals, HotClass, SignalConfig
  deals-signals.ts    // move o cálculo atual para cá (mantém export compat)
  tickets-signals.ts  // NOVO
  ats-signals.ts      // NOVO (candidatos + jobs)
```

- `KanbanSignals = { score, klass, isHot, isHighValue, reason? }`
- `reason` é uma string curta usada no tooltip ("SLA em 1h", "Parado há 12 dias", "Prioridade urgente").

## Aplicação por tela

### 1. Tickets (`src/components/tickets/tickets-board.tsx` + `ticket-card.tsx`)
- Calcular `computeTicketSignals(tickets, pipeline, now)` com base em `due_at`, `updated_at`, `priority` e stage type.
- Card recebe borda esquerda:
  - laranja (`--hs-orange`) → hot (SLA/estagnado)
  - âmbar (`--hs-stage-4`) → high (prioridade urgente)
  - gradiente → ambos
- Ícone: `Flame` (hot) / `AlertOctagon` (urgent) no header do card, com tooltip contendo `reason`.
- Column header ganha "· N urgentes" análogo ao "N quentes".
- Toggle **Foco em SLA** no toolbar de tickets: reordena por score, esmaece cold.
- Persistência: `localStorage["tickets:focusMode"]`.

### 2. ATS Candidatos (`src/routes/_authenticated/candidates.index.tsx` + card do kanban)
- `computeCandidateSignals` usando `stage_entries` (tempo no stage), próxima `ats_interviews` e `ats_match_scores`.
- Mesma linguagem visual (borda + ícone + tooltip).
- Ícones: `Flame` (parado demais / entrevista iminente), `Gem` (top match).
- Toggle **Foco em movimento** no header.

### 3. ATS Jobs (só se já existir kanban; caso contrário, fora do escopo desta fase)
- Verificar em `ats/job-postings-panel.tsx` / rotas de jobs. Se houver board, aplicar a mesma API.

### 4. EntityBoard genérico (`src/components/entity-board.tsx`)
- Aceitar prop opcional `getSignals?: (row) => KanbanSignals | undefined` e `focusMode?: boolean`.
- Sem sinais por padrão → visual atual permanece inalterado.
- Consumidores existentes não precisam mudar.

## UI compartilhada

Extrair da implementação atual do card de Deal um pequeno componente:

- `src/components/kanban/kanban-card-signals.tsx` → renderiza borda-esquerda + ícones + tooltip a partir de `KanbanSignals`. Reusado por `deals-board-card`, `ticket-card` e card de candidato.

Isso evita divergência de estilo entre os kanbans.

## Fora do escopo

- Novo pipeline/stage config.
- Persistir score no banco (tudo continua client-side, determinístico).
- Alterar RLS, edge functions ou lógica de negócio (SLA, match score continuam vindo das mesmas fontes).
- Redesenhar drag-and-drop.

## Validação

- `/deals` mantém comportamento atual (regressão zero).
- `/tickets` (quadro): tickets com SLA vencendo ganham borda laranja + tooltip "SLA em Xh"; toggle Foco em SLA reordena colunas por score.
- `/candidates` (quadro): candidatos parados no stage acima do limite ficam "hot"; top match por vaga ganha gem.
- Dark mode ok; tokens semânticos apenas.
- Typecheck limpo, sem breaking changes nos consumidores do `EntityBoard`.

## Detalhes técnicos

- `computeTicketSignals` usa `sla_policies` quando disponível; fallback para `due_at`. Se nenhum dos dois existir, cai em `updated_at` + threshold por stage.
- Thresholds por stage/tipo em constantes exportadas de cada arquivo `*-signals.ts` para facilitar tuning.
- Reason string sempre em pt-BR curta (máx ~40 chars) para caber no tooltip.
