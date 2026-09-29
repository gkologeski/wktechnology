# Arrastar colunas direto no cabeçalho do grid

## Causa confirmada
O cabeçalho arrastável repassa ao `Th` (em `src/components/leads/table-primitives.tsx` e `src/components/crm/hubspot-shell.tsx`) os eventos de arrasto, o estilo de movimento e os atributos de acessibilidade. Mas o `Th` só aproveita `ref`, `className` e `onClick` e descarta o resto. Por isso o arrasto nunca começa no grid. No seletor "Colunas" funciona porque ali a alça é um botão comum.

## Correção
1. Os dois `Th` passam a repassar todas as outras propriedades (`style`, `onPointerDown`, `onKeyDown`, `aria-*`, `data-*`, `tabIndex`, `role`) para o `<th>`, sem mudar a aparência nem o clique de ordenação.
2. `SortableColumnHeader` passa a ser robusto: se o filho não aceitar as propriedades, o conteúdo é envolvido por uma área interna que recebe os eventos de arrasto. Assim os cabeçalhos personalizados (`col.header`), como os de Negócios, também passam a arrastar.
3. Os eventos de clique na ordenação ficam preservados. O arrasto só começa depois de 6px de movimento, então um clique simples continua ordenando.
4. Cursor "grab" e uma alça discreta (ícone de pontos) aparecem ao passar o mouse, usando os tokens do design system.
5. Um `TableHead` do shadcn já repassa as propriedades. Vou conferir as telas que o usam (Serviços, Candidatos, Candidaturas, Financeiro).

## Validação
- Typecheck, lint, testes e build.
- Playwright autenticado em /deals, /leads, /contacts e /companies: arrastar um cabeçalho, conferir a nova ordem, recarregar a página e ver que a ordem foi mantida. Também conferir que um clique continua ordenando.

## Fora do escopo
Nenhuma mudança em banco, permissões ou regras de negócio.
