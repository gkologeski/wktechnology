# Aninhar contrato de compra sob o contrato de prestação

Hoje a grid de `/contracts` só aninha aditivos (campo de aditivo) sob o contrato principal. O vínculo prestação ↔ compra já existe no contrato de compra (campo de contrato principal usado pelo pareamento), mas na grid os dois aparecem como linhas soltas.

## O que muda na grid

- O contrato de **Compra** passa a aparecer indentado logo abaixo do contrato de **Prestação** ao qual está vinculado, exatamente como o `ADT` aparece hoje sob o `CPS`.
- Ordem dentro do bloco do contrato de prestação: primeiro os aditivos do próprio contrato, depois os contratos de compra vinculados (e os aditivos do contrato de compra ficam indentados sob ele, em segundo nível).
- Cada linha aninhada mantém a seta de indentação e ganha um badge de identificação: `Aditivo N` (já existe) e `Compra` para o contrato de compra vinculado.
- Quando o contrato de prestação não está na página atual (filtro/paginação), o contrato de compra continua aparecendo como linha normal, sem indentação — nada desaparece.
- O checkbox "Aninhar aditivos" passa a se chamar "Aninhar vínculos" e controla os dois tipos de aninhamento.
- Vale para a visão plana e para as visões agrupadas (empresa/serviço/cargo/senioridade), que usam o mesmo componente.

Nada muda em edição inline, seleção em lote, permissões, RLS ou nos dados: é apresentação da lista.

## Detalhes técnicos

- `src/components/contracts/contracts-grouped-list.tsx`:
  - `ContractRow` ganha `parent_contract_id?: string | null` (a listagem já retorna `*`, então não há mudança de servidor).
  - `arrangeWithAmendments` é generalizada para montar uma árvore por dois vínculos (`amendment_of_id` e `parent_contract_id` quando `role === "client"`), com percurso em profundidade e `depth` numérico em vez do booleano `nested`; guarda contra ciclos.
  - `ContractTableRow` recebe `depth` e aplica `pl-5` por nível; badge `Compra` quando a linha é filha por `parent_contract_id`.
- `src/routes/_authenticated/contracts.index.tsx`: renomear o rótulo do toggle e o estado (`nestLinks`), repassando a prop para os dois pontos de uso.
- Validação: `tsgo`, lint e o teste existente de `arrangeWithAmendments` (atualizado para o novo retorno com `depth`).
