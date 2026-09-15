# Corrigir o erro no campo "Substatus da etapa" do workflow

## Causa confirmada

A busca de substatus ordena por uma coluna que não existe no cadastro de substatus. A tabela tem `position` (ordem), mas a consulta pede `sort_order`. O banco recusa a consulta, então o campo fica em "Carregando…" e o combo mostra "Erro ao buscar."

Verificado: as colunas do cadastro de substatus são `color, created_at, description, id, is_active, is_default, name, owner_id, pipeline_id, position, stage_value, updated_at, workspace_id` — sem `sort_order`.

## O que muda

- Ordenar os substatus por `position` (e por nome como desempate), corrigindo a consulta.
- Mensagem de erro do combo passa a ser mais útil, exibindo o motivo da falha em vez de apenas "Erro ao buscar.".
- Rótulo do item continua "Etapa · Nome do substatus"; nada muda no valor gravado (segue o ID).

## Detalhes técnicos

- `src/lib/workflow-refs.functions.ts`, ramo `kind === "substatus"` de `searchSimpleRefs`: `.order("position", { ascending: true })` + `.order("name")`.
- Revisar no mesmo passo as outras fontes de `SOURCES` (`ats_jobs.title`, `projects.name`, `project_milestones.name`, `service_catalog.name`, `financial_categories.name`) confirmando as colunas contra o schema antes de fechar, para não repetir o mesmo tipo de falha.
- `src/components/workflows/extra-fields-editor.tsx`: exibir a mensagem retornada no estado de erro do popover.
- Sem migration, sem alteração de schema, RLS, permissões ou regra de negócio.

## Validação

`bun run typecheck`, `bun run lint` nos arquivos alterados, `bun run test`, e conferência autenticada em `/settings/workflows` com condição em Negócios sobre "Substatus da etapa".

## Como validar manualmente

1. `/settings/workflows` → condição em Negócios → campo "Substatus da etapa".
2. O combo deve listar "Etapa · Nome", sem "Erro ao buscar." e sem "Carregando…" permanente.
3. Salvar e reabrir o workflow: o substatus escolhido continua exibido pelo nome.
