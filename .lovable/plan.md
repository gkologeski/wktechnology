# Substatus da etapa depende da etapa escolhida

Hoje o campo "Substatus da etapa" lista todos os substatus ativos do workspace, de qualquer etapa e de qualquer pipeline. Deve passar a listar apenas os substatus da etapa escolhida no mesmo contexto.

## Regras

1. **Com etapa escolhida** (e pipeline, quando informado): o combo lista somente os substatus daquela etapa, na ordem cadastrada, com o rótulo do substatus (sem repetir o nome da etapa).
2. **Sem etapa escolhida**: o campo aparece desabilitado com a mensagem "Escolha a etapa primeiro". Continua sendo possível usar uma variável ({{token}}) para casos em que a etapa vem de um passo anterior.
3. **Trocar a etapa** limpa um substatus já escolhido que não pertença à nova etapa, avisando na tela.
4. **Valor já salvo** apontando para substatus de outra etapa ou inativo continua sendo exibido pelo nome (nada é perdido ao abrir workflows antigos).
5. Quando a etapa escolhida não tem substatus cadastrados, o combo mostra o estado vazio "Nenhum substatus cadastrado para esta etapa", com atalho para o cadastro de substatus.

## Onde a regra se aplica

- Passo "Criar/Atualizar registro" (Negócios, Leads, Chamados) — a etapa é um campo irmão no mesmo formulário.
- Condições do gatilho e de ramificação — quando a mesma condição/grupo já filtra a etapa, o substatus é filtrado por ela; sem etapa definida na condição, vale a regra 2.
- Critérios de meta, que reaproveitam o mesmo seletor.

Sem alteração de banco, RLS, permissões, motor de workflows ou do valor gravado (segue o ID do substatus).

## Detalhes técnicos

- `src/lib/workflow-refs.functions.ts` (`searchSimpleRefs`, ramo `substatus`): aceitar filtros opcionais `stage_value` e `pipeline_id` no input e aplicá-los na consulta; sem `stage_value`, não retornar lista (evita opções de outras etapas). Ordenação segue `position`.
- `src/components/workflows/extra-fields-editor.tsx`:
  - `FkPicker` recebe `filters?: { stage_value?: string; pipeline_id?: string }`, repassa na busca e inclui os filtros na `queryKey`; estado desabilitado + dica quando faltar `stage_value`.
  - No render de `stage_substatus_id`, derivar os filtros de `siblingValues` (`stage_value` / `stage_id` e `pipeline_id`) — o mesmo mecanismo já usado em `contracting_legal_entity_id`.
  - Ao mudar a etapa, limpar `stage_substatus_id` quando o valor atual não pertencer à nova etapa (hidratação já retorna a etapa do substatus).
- `src/components/workflows/builder/conditions-editor.tsx`: para condições sobre `stage_substatus_id`, resolver a etapa a partir das condições irmãs sobre `stage_id`/`stage_value` no mesmo grupo e passar como filtro.
- Hidratação de rótulo (busca por `ids`) continua sem filtro, garantindo a regra 4.

## Validação

`bun run typecheck`, ESLint dos arquivos alterados, `bun run test` e conferência autenticada em `/settings/workflows`.

## Como validar manualmente

1. `/settings/workflows` → passo "Atualizar registro" em Negócios: sem etapa, o substatus fica desabilitado com a dica.
2. Escolher uma etapa: o combo lista só os substatus dela.
3. Trocar a etapa: o substatus incompatível é limpo com aviso.
4. Abrir um workflow antigo com substatus de outra etapa: o nome continua sendo exibido.
