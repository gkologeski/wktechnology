# Plano: Tornar o substatus de negócios descobrível e verificável

## Diagnóstico (confirmado)

- A tabela `pipeline_stage_substatuses` está **vazia** — nenhum substatus foi cadastrado ainda.
- Os componentes (`SubstatusSelect` no detalhe do negócio e `SubstatusQuickPicker` no card do Kanban) **se ocultam** quando a etapa não tem substatus. Por isso nada aparece nos negócios.
- O editor existe apenas em **Configurações → Pipelines**, dentro da edição de cada etapa, e exige a permissão de gerenciar pipelines (`canManageSubstatus`).

## O que será implementado

### 1. Cadastro inicial dos substatus
Sem alteração de código: orientar o cadastro em Configurações → Pipelines → editar pipeline → bloco "Substatus da etapa" em cada etapa (já funciona hoje).

### 2. Estado vazio com atalho (descobribilidade)
- No detalhe do negócio (`deals.$id.tsx`) e no card do Kanban (`SubstatusQuickPicker`), quando a etapa não tiver substatus e o usuário **puder gerenciar pipelines**, exibir um link discreto "Configurar substatus da etapa" apontando para `/settings/pipelines`.
- Quando o usuário não tiver a permissão, manter o comportamento atual (oculto).

### 3. Indicação visual do substatus atual
- Garantir que, havendo substatus definido, o badge apareça no card do Kanban, no detalhe do negócio e no filtro da lista (já existe; validar após o cadastro inicial).

### 4. Validação
- Cadastrar 2–3 substatus de exemplo em uma etapa do pipeline de negócios (via tela), atribuir a um negócio pelo Kanban e pelo detalhe, e conferir: badge no card, histórico em `SubstatusHistory` e filtro na toolbar da lista.

## Detalhes técnicos

- Arquivos tocados: `src/components/pipelines/substatus-quick-picker.tsx`, `src/components/pipelines/substatus-select.tsx` (prop opcional `manageHref` + empty-state condicional), e ponto de uso em `src/routes/_authenticated/deals.$id.tsx`.
- Sem mudança de schema, RLS ou regra de negócio.
- Verificação de permissão reutiliza `canAny(PIPELINES_MANAGE)` já usado em `settings.pipelines.tsx`.

## Fora de escopo

- Automações/workflows disparados por substatus.
- Edição em massa de substatus.
