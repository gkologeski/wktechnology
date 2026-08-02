# Condições de workflow com E / OU e agrupamento (estilo HubSpot)

Hoje todas as condições de um workflow são combinadas com **E** (`filters.every(...)` no motor), sem nenhuma opção de **OU** nem de agrupamento. O objetivo é permitir grupos aninhados com operador escolhido pelo usuário, mantendo tudo que já existe funcionando.

## Onde se aplica

O mesmo editor de condições é usado em quatro lugares, e todos passam a suportar grupos:

- condições do gatilho (aba Gatilho);
- critérios de meta (`goal_filters`);
- passo "Se/Então" (`branch_if`);
- ramificações múltiplas (`multi_branch`) e filtros do gatilho temporal.

## Comportamento na interface

- Cada bloco de condições ganha um seletor **E / OU** no topo do grupo, indicando como as condições daquele grupo se combinam.
- Botões: "Adicionar condição" e "Adicionar grupo".
- Grupos aninhados aparecem recuados, com borda lateral e o próprio seletor E/OU, até 3 níveis de profundidade.
- Resumo textual atualizado nos cards do builder (ex.: "3 condições (2 grupos)") em vez de apenas contar linhas.
- Um grupo vazio é ignorado na avaliação (não bloqueia o workflow), e é possível remover condições e grupos individualmente.
- Todos os rótulos em PT-BR, seguindo o design system: componentes oficiais (Select, Button, badges), foco visível, dark mode e responsividade preservados.

## Compatibilidade

Workflows já salvos continuam válidos: uma lista de condições sem grupo é interpretada como um único grupo com operador **E**, exatamente como hoje. Nenhuma migração de banco é necessária, pois as condições ficam no JSON do workflow.

## Detalhes técnicos

- `src/lib/workflows/types.ts`: novo nó recursivo `WorkflowCondition = WorkflowFilter | WorkflowFilterGroup`, com `WorkflowFilterGroup = { logic: "and" | "or"; conditions: WorkflowCondition[] }`. Os campos existentes (`filters`, `goal_filters`, `MultiBranch.filters`, `TimeTriggerConfig.filters`, `branch_if.filters`) passam a aceitar `WorkflowCondition[]`.
- `src/lib/workflows/schemas.ts`: `ConditionSchema` recursivo (`z.lazy`) como união de `FilterSchema` e `FilterGroupSchema`, com limites de profundidade (3) e de total de nós (mantendo o teto de 20 por nível) para evitar payloads abusivos. `FilterSchema` permanece para compatibilidade.
- `src/lib/workflows/engine.server.ts`: extrair `evalCondition(node, ...)` que delega a `evalFilter` para folhas e resolve grupos com `every`/`some` conforme `logic`. Substituir os quatro pontos que hoje chamam `filters.every(...)` (gatilho, meta, `branch_if`, `multi_branch`, varredura temporal) por `evalConditions(list, ...)` que aplica **E** no topo, preservando o comportamento atual para listas planas.
- `src/components/workflows/workflow-builder.tsx`: novo componente `ConditionGroupEditor` (recursivo) que reutiliza o `FilterRow` existente e recebe `fields` / `priorFields`; os quatro blocos de condições passam a renderizá-lo. `FilterRow` fica inalterado.
- Helper de resumo (usado nos cards e no passo) atualizado para contar folhas e grupos.

## Validação

Rodar typecheck, lint e testes existentes; validar manualmente criando um workflow com um grupo OU aninhado dentro de um grupo E e conferindo o log do run.
