## Problema
Na matriz de `/settings/permissions`, ao rolar horizontalmente, o texto do cabeçalho e das linhas de grupo da coluna sticky "Recurso/Ação" fica visível *sobre* (ou atrás) do texto dos cargos, dando aparência de sobreposição.

## Causa
As células sticky-left usam fundos translúcidos:
- `<th>` cabeçalho: `bg-muted/40` (40% opaco)
- `<td>` linha de grupo do Recurso: `bg-muted/20` (20% opaco)

Como o fundo não é sólido, o conteúdo das colunas de cargos passa por baixo e aparece através da coluna fixa quando rola para o lado.

## Escopo
Arquivo único: `src/components/access-control/permissions-matrix.tsx`. Nenhuma mudança de lógica, RLS ou dados.

## Mudanças
1. **Cabeçalho sticky (linha 285)**: trocar `bg-muted/40` da célula sticky-left por fundo sólido (`bg-muted`) — mantendo `z-40`.
2. **Linha de grupo de Recurso (linha 361)**: trocar `bg-muted/20` da célula sticky-left por fundo sólido equivalente ao restante da linha (usar um tom sólido como `bg-secondary` ou `bg-muted` para não haver transparência). As demais `<td>` da mesma linha (linha 377) permanecem como estão para não alterar o visual geral da linha de grupo — ou, se necessário para consistência visual, alinhar ambas para o mesmo token sólido.
3. **Linha de permissão sticky (linha 402)**: já usa `bg-background` (sólido) — apenas verificar que continua correto sob dark mode.
4. Garantir que a borda direita da coluna sticky (`border-r`) permaneça visível para reforçar a separação visual durante o scroll.

## Fora de escopo
- Não altera colunas de cargos, checkboxes mestres, filtros ou tabs de módulo.
- Não altera larguras nem o layout de pills Ação/Escopo.
