# Rolagem lateral da grade de Contratos sem voltar a página

## Problema
Ao rolar a tabela de Contratos para a esquerda com o touchpad (quando há colunas fora da tela), o navegador interpreta o gesto como "voltar" (seta de voltar na captura) ao chegar na borda, saindo da lista.

## Correção
- No contêiner de rolagem da tabela de Contratos, impedir que o gesto horizontal "vaze" para o navegador (`overscroll-x-contain`), mantendo a rolagem normal da tabela.
- Aplicar o mesmo ajuste no contêiner padrão de tabelas (`src/components/ui/table.tsx`) para que todas as grades do sistema se comportem igual, e nas áreas de Kanban (`kanban-scroll-container.tsx`).

## Detalhes técnicos
- Adicionar classe `overscroll-x-contain` (CSS `overscroll-behavior-x: contain`) aos elementos com `overflow-auto`/`overflow-x-auto` citados.
- Somente CSS; sem mudança de dados, permissões ou funcionalidade.
- Validação: typecheck, lint, build e Playwright conferindo o estilo aplicado; o gesto de touchpad precisa de conferência manual no Mac.
