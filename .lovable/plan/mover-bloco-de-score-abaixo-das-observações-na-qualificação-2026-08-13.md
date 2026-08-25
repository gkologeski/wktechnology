# Mover bloco de score abaixo das observações na qualificação

## Contexto

O `QualificationPanel` (`src/components/prospecting/qualification-panel.tsx`) exibe as métricas de score (`Nota do lead`, `Questionário`, `Fit ICP`) no `CardHeader`, junto com a seleção de questionário e os botões de ação. O usuário quer que esses campos de score apareçam abaixo do campo `Observações (opcional)`.

## O que será feito

1. Extrair o bloco de score atual do `CardHeader`.
2. Renderizar o bloco de score dentro de `CardContent`, logo abaixo do campo `Observações (opcional)` e acima dos botões de ação (`Salvar rascunho`, `Qualificar`, etc.).
3. Manter no cabeçalho: título, subtítulo, seletor de questionário, botões `Enriquecer` e `Configurar campos` e o badge de status de enriquecimento.
4. Garantir que os valores computados, badges, progresso e ICP continuem funcionando exatamente como hoje — apenas mudando a posição na tela.

## Arquivos alterados

- `src/components/prospecting/qualification-panel.tsx` — movimentação do bloco de score; possível extração de componente interno para melhor legibilidade.

## Validação

- `tsgo --noEmit` ou `bun run typecheck`.
- `bun run lint`.
- Verificação visual no preview: abrir o modal de qualificação de um lead e confirmar que o score aparece abaixo das observações e que os botões permanecem no final.

## Escopo

Apenas reorganização visual do painel de qualificação. Nenhuma alteração de dados, schema, RLS, server functions ou regras de negócio.
