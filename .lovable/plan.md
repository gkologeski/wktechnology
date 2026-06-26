## Problema

Na edição inline de tarefa na timeline (`src/components/activity-timeline.tsx`), o bloco "Responsável + Data de vencimento" ficou quebrado em colunas estreitas:

- Preset, botão de data e "Limpar" disputam espaço numa mesma linha apertada — o texto da data ("29 de Jun de 2026 16:47 GMT-3") estoura.
- O `Calendar` abre cobrindo o botão "Salvar".
- Visualmente desalinhado com o restante do composer.

## Escopo

Apenas a UI do bloco de edição inline de tarefa em `src/components/activity-timeline.tsx` (linhas ~1505-1589). Sem mudar regras de negócio, schema, persistência, presets disponíveis (`TASK_DUE_PRESET_LABELS`) ou função `computeDuePreset`.

## Mudanças

1. **Layout em coluna única** dentro do editor da tarefa, em vez de `grid sm:grid-cols-2`:
   - Linha 1: Responsável (Select, largura cheia).
   - Linha 2: Data de vencimento, composta por:
     - Botão único `Popover` ocupando a largura cheia, mostrando data compacta (`dd/MM/yyyy HH:mm`) ou "Definir vencimento".
     - Botão "×" pequeno (ghost icon) ao lado direito para limpar, exibido só quando há data.
   - Linha 3 (chips de preset): pequenos botões `variant="outline" size="sm"` em fluxo horizontal com `flex-wrap` — Hoje, Amanhã, Semana que vem, Mês que vem, Daqui 3 meses. Chamam `setEditingDueDate(computeDuePreset(preset, editingDueDate))`. Substitui o `Select` "Preset" que parecia órfão.
2. **Popover do calendário** com `align="end"` e `sideOffset={8}` para não cobrir o botão "Salvar"; manter `pointer-events-auto`.
3. **Formato compacto da data** no botão (`dd 'de' MMM HH:mm` via `date-fns`/locale já usado no projeto, ou `formatDateTime` curto se existir helper).
4. Sem alterações em `editingAssigneeId`, `editingDueDate`, validações, salvar/cancelar, ou outras seções da timeline (composer principal, ações etc.).

## Validação manual

- Editar uma tarefa existente na timeline de um lead/deal.
- Confirmar que o Salvar não é mais coberto pelo calendário.
- Clicar nos chips Hoje/Amanhã/Semana/Mês/3 meses e ver a data preenchida; clicar no botão de data e escolher manualmente.
- Limpar a data com o "×" e salvar; reabrir e conferir persistência.
- Testar light/dark mode, desktop (≥1280px), tablet e mobile (largura ≈360px).

## Fora de escopo

- Composer de criação de nova tarefa (somente o modo edição).
- Outras tabelas, queries ou regras.
- Página `/tasks/:id`.