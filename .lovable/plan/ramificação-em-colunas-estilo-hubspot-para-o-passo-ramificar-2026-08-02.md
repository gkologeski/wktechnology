# Ramificação em colunas (estilo HubSpot) para o passo "Ramificar por valor"

Sim — hoje o comportamento está incompleto. O passo `branch_if` (Se/Então/Senão) já desenha duas colunas no canvas, mas o passo **Ramificar por valor (switch)** só mostra, para cada case, um campo "Ações (JSON)". É por isso que não aparecem os "quadros" lado a lado por possibilidade.

## O que será feito

Transformar o switch em ramificação visual: cada case ganha sua própria coluna no canvas, mais uma coluna final "Padrão" (quando nenhum valor bate), exatamente no mesmo padrão visual já usado pelo Se/Então/Senão.

Em cada coluna será possível:

- adicionar passos pelo botão "+" (abre a biblioteca de ações do mesmo jeito que hoje);
- selecionar um passo e configurá-lo no painel lateral, com todos os campos normais (sem JSON);
- arrastar e soltar passos dentro da coluna, entre colunas de cases diferentes e entre a coluna e o fluxo principal;
- mover para cima/baixo e remover passos;
- renomear/rotular o case e escolher o valor pelo seletor de valores conhecidos já existente.

Colunas roláveis horizontalmente quando houver muitos cases, mantendo os cartões com largura mínima legível. O campo "Ações (JSON)" é removido da interface (nenhum dado existente é perdido: os passos já salvos aparecem como cartões).

## Detalhes técnicos

- `src/components/workflows/workflow-builder.tsx`
  - Ampliar `StepPath` de `Array<number | "then" | "else">` para aceitar segmentos de case: `` `case:${n}` `` e `"default"`.
  - Atualizar os helpers recursivos de caminho para tratar esses segmentos: `siblingsOfPath`, `getStep`, `updateStep`, `removeStep`, `insertAt`, `moveStep`/`isDescendantOrSelf` e `priorStepFieldOptions` (para que condições em passos filhos continuem vendo saídas de passos anteriores).
  - Novo componente `SwitchCard`, espelhando `BranchCard`: cabeçalho com campo do switch + resumo, e grid de colunas (um por case + Padrão) usando `DropSlot`/`Connector`/cartões filhos já existentes. Extrair o corpo de coluna hoje inline em `BranchCard` para um subcomponente compartilhado (`BranchColumn`) para evitar duplicação.
  - `StepsList` passa a renderizar `SwitchCard` quando `action.type === "switch_by_value"`.
  - Em `SwitchByValueForm` (painel lateral): remover o textarea "Ações (JSON)"; manter campo, valor (via `FieldValueEditor`), rótulo do case, adicionar/remover case e reordenar cases.
  - `countSteps`/`describeAction` já contam cases; ajustar para incluir `default`.
- Tipos e engine (`src/lib/workflows/types.ts`, `engine.server.ts`): sem mudança de formato — `cases[].actions` e `default` continuam iguais, então workflows publicados seguem executando do mesmo modo.
- Escopo restrito a UI do builder; nada de RLS, schema ou regra de negócio.
