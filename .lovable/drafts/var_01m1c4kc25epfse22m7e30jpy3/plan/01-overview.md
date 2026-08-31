# Filtro de Responsável no Kanban de Negócios

## Diagnóstico (verificado no código e nos dados)

O filtro funciona, mas olha para a coluna **errada**.

- Em `/deals`, o filtro compara `d.owner_id` com o responsável escolhido, e o card do quadro e a visão Lista também exibem o nome a partir de `owner_id`.
- No resto do sistema (grids, edição em massa, coluna "Responsável"), a coluna canônica de responsabilidade é **`assigned_to`** — a edição em massa grava nela.
- Hoje os dados ainda estão alinhados (todo `assigned_to` é igual ao `owner_id`, e 2 negócios têm `assigned_to` nulo), então o filtro parece "quase" certo. Assim que alguém trocar o responsável por edição em massa ou pelo grid, o Kanban continuará mostrando e filtrando pelo dono antigo — e os 2 registros sem `assigned_to` já ficam inconsistentes entre telas.
- Efeito prático adicional: como 2.029 dos 2.050 negócios pertencem ao mesmo dono, filtrar por qualquer outra pessoa parece "não filtrar nada útil".

## O que será feito

1. Criar um helper único de responsável efetivo: `assigned_to` e, na falta dele, `owner_id`.
2. Aplicar esse helper no filtro de `/deals`, na montagem das opções do dropdown "Responsável", no card do quadro e na visão Lista.
3. Manter `owner_id` intacto no banco — nenhuma migration, nenhuma mudança de RLS ou de regra de negócio.
