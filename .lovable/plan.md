## Objetivo
Em `/settings/permissions`, adicionar um checkbox mestre por grupo (linha de cabeçalho de Recurso) em cada coluna de cargo, que marca/desmarca todas as permissões daquele Recurso × Cargo de uma vez.

## Escopo
- Arquivo único: `src/components/access-control/permissions-matrix.tsx`.
- Nenhuma alteração de RLS, schema, server functions ou lógica de autorização.
- Reaproveita a mutation existente (`toggleMut`) — sem novo endpoint.

## Mudanças

1. **Linha de cabeçalho do Recurso (linha ~359)**
   - Hoje é um único `<td colSpan={roles.length + 1}>` com só o nome do Recurso.
   - Passa a ter uma coluna sticky com o nome do Recurso + uma célula por cargo, cada uma com um `<Checkbox>` mestre.

2. **Estado do checkbox mestre (por Recurso × Cargo)**
   - `all` → todas as permissões do grupo estão concedidas → `checked=true`.
   - `none` → nenhuma concedida → `checked=false`.
   - `some` → estado indeterminado (`checked="indeterminate"` do shadcn Checkbox).

3. **Ação ao clicar**
   - Se estava `all`, desmarca todas do grupo para aquele cargo.
   - Se estava `none` ou `some`, marca todas as faltantes.
   - Dispara `toggleMut.mutate(...)` para cada permissão que efetivamente muda de estado (evita chamadas redundantes).
   - Desabilita durante `toggleMut.isPending`.

4. **Acessibilidade / UX**
   - `aria-label` no formato `Marcar todas as permissões de {Recurso} para {Cargo}`.
   - Mantém o visual atual da linha de grupo (fundo `bg-muted/20`, tipografia menor).

## Fora de escopo
- Não altera o botão "Aplicar em massa (módulo atual)" já existente no rodapé.
- Não altera busca, filtros nem a criação/edição/exclusão de cargos.
- Não adiciona checkbox mestre por coluna inteira nem por linha de permissão.
