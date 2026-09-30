# Fase 1 (lote 2): ordenação por coluna em Tickets, Projetos e Propostas

## O que muda para você
- Nas listas de **Tickets**, **Projetos** e **Propostas**, clicar no título de uma coluna ordena em ordem crescente; clicar de novo inverte.
- A seta de ordenação aparece no título, como em Empresas.
- Campos vazios vão para o fim da lista.
- Colunas que guardam só um código interno (ex.: Responsável) ficam sem ordenação, para não dar ordem sem sentido.
- Nada muda em filtros, seleção, ações em massa ou dados.

## Como vai funcionar
- Ordenação feita no banco (vale para a lista inteira, não só a página visível).
- A ordem escolhida fica na barra de endereço, então sobrevive a recarregar a página.

## Fora deste lote
- Filtros laterais, exportação e visões salvas (Fases 2 e 3 da auditoria).
- Demais grids (Vagas, Ofertas, Pessoas, Faturas etc.) em lotes seguintes.

## Detalhes técnicos
- Arquivos: `src/routes/_authenticated/tickets.tsx`, `projects.index.tsx`, `proposals.index.tsx`.
- Reaproveitar o cabeçalho ordenável já usado em Empresas (lista de colunas permitidas + `order(col, { ascending, nullsFirst: false })`).
- Parâmetros `sort`/`dir` validados por lista fechada de colunas (sem coluna arbitrária vinda da URL).
- Sem schema, RLS ou server functions novas.
- Validação: typecheck, testes, lint e teste no navegador clicando em uma coluna de cada tela.
