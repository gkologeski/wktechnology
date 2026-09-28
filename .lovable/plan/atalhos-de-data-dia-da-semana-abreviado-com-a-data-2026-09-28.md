# Atalhos de data: dia da semana abreviado com a data

## Contexto

Os atalhos de data (seletor de atividade e controle de acompanhamento) exibem hoje o dia da semana por extenso — ex.: "Hoje (Segunda-feira)" — sem a data. O pedido é exibir abreviado e com a data:

- Hoje (Seg, 29/09/2026)
- Em 2 semanas (Seg, 12/10/2026)

## O que mudar

1. `src/lib/activity-task-options.ts` — função `followUpLabel` (linhas 154-160):
   - Substituir o sufixo por dia da semana abreviado + data em dd/MM/yyyy.
   - Abreviação com `toLocaleDateString("pt-BR", { weekday: "short" })`, capitalizada e sem o ponto final ("seg." → "Seg").
   - Data com `toLocaleDateString("pt-BR")` (dd/MM/yyyy), calculada a partir do mesmo `Date` retornado por `followUpDate` (já respeita fuso local).
   - "Data personalizada" continua sem sufixo; demais casos mantêm o rótulo base.

## Impacto

- A mudança é centralizada em `followUpLabel`; os dois pontos de uso herdam automaticamente:
  - `src/components/activity/activity-date-time-picker.tsx` (opções do dropdown e do gatilho).
  - `src/components/activity/follow-up-task-control.tsx`.
- Sem alteração de dados, regra de negócio, datas persistidas ou outros formatos do sistema.

## Validação

- Teste unitário novo para `followUpLabel` cobrindo: "Hoje", "Em 2 semanas", "Em 1 mês" e "Data personalizada" (rótulo sem sufixo), usando uma data fixa.
- `bun run test` (arquivo afetado), `bun run typecheck`, ESLint dos arquivos alterados e build.
- Verificação no navegador no seletor de atividade (dropdown e botão do gatilho) confirmanto o formato "Seg, 29/09/2026".
