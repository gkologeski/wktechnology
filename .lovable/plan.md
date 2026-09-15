# Workflows: substatus dependente da etapa + condição pelo serviço do negócio

Dois ajustes no construtor de workflows.

---

## Parte 1 — "Substatus da etapa" só mostra os substatus da etapa escolhida

Hoje o campo lista todos os substatus ativos do workspace, de qualquer etapa e pipeline.

### Regras

1. **Com etapa escolhida** (e pipeline, quando informado): o combo lista somente os substatus daquela etapa, na ordem cadastrada, com o nome do substatus (sem repetir o nome da etapa).
2. **Sem etapa escolhida**: o campo fica desabilitado com a dica "Escolha a etapa primeiro". Continua possível usar uma variável ({{token}}) quando a etapa vem de um passo anterior.
3. **Trocar a etapa** limpa um substatus já escolhido que não pertença à nova etapa, avisando na tela.
4. **Valor já salvo** apontando para substatus de outra etapa ou inativo continua exibido pelo nome — nada se perde ao abrir workflows antigos.
5. Etapa sem substatus cadastrados: estado vazio "Nenhum substatus cadastrado para esta etapa", com atalho para o cadastro.

### Onde se aplica

Passo "Criar/Atualizar registro" (Negócios, Leads, Chamados), condições do gatilho e de ramificação, e critérios de meta — todos usam o mesmo seletor.

---

## Parte 2 — Condição pelo serviço do negócio

Hoje não existe como condicionar um workflow ao serviço do negócio, porque o serviço não é um campo do negócio: ele vem dos **itens de linha** (um negócio pode ter vários serviços). As condições só leem campos do próprio registro, por isso o campo não aparece na lista.

### O que passa a existir

Um novo campo de condição em Negócios: **"Serviço (itens do negócio)"**.

- Operadores: **é igual a**, **está entre** (vários serviços), **contém** (busca por texto no nome), **está vazio** / **não está vazio**.
- A escolha do serviço é por nome, com busca no catálogo de serviços (grava o ID, como nos demais campos de referência).
- Avaliação: verdadeira quando **qualquer** item de linha do negócio corresponde. Ex.: "Serviço (itens do negócio) é igual a Hunting" dispara para negócios que tenham pelo menos um item de Hunting.
- Disponível também nas ramificações e nos critérios de meta, com o mesmo comportamento.
- Como o serviço é definido nos itens de linha (depois da criação do negócio), gatilhos de criação podem ainda não ter serviço: nesse caso a condição é falsa. A recomendação na própria tela é usar o gatilho de atualização do negócio.

Também fica disponível o token `{{deal.services}}` (nomes dos serviços do negócio, separados por vírgula) para uso em textos de e-mail, tarefa e atividade.

Nada é removido; condições existentes continuam válidas.

---

## Detalhes técnicos

### Parte 1

- `src/lib/workflow-refs.functions.ts` (`searchSimpleRefs`, ramo `substatus`): aceitar `stage_value` e `pipeline_id` opcionais no input e aplicá-los na consulta; sem `stage_value`, não retornar lista. Ordenação segue `position`. Busca por `ids` (hidratação de rótulo) continua sem filtro, garantindo a regra 4.
- `src/components/workflows/extra-fields-editor.tsx`: `FkPicker` recebe `filters?: { stage_value?: string; pipeline_id?: string }`, repassa na busca e inclui na `queryKey`; estado desabilitado + dica quando faltar etapa. No render de `stage_substatus_id`, derivar os filtros de `siblingValues` (`stage_value`/`stage_id`, `pipeline_id`) — mesmo mecanismo já usado em `contracting_legal_entity_id` — e limpar o valor incompatível ao trocar a etapa.
- `src/components/workflows/builder/conditions-editor.tsx`: para condições sobre `stage_substatus_id`, resolver a etapa pelas condições irmãs sobre `stage_id`/`stage_value` do mesmo grupo.

### Parte 2

- Campo virtual `line_item_service_id` (rótulo "Serviço (itens do negócio)") no catálogo de campos de `deals`, marcado como somente-condição (não editável em passos de criação/atualização), com `ref: "service"` para reaproveitar o `FkPicker` de serviços.
- `src/lib/workflows/engine-shared.server.ts`: `evalFilter` passa a aceitar campos virtuais resolvidos previamente; a comparação usa lista (qualquer item satisfaz) para `eq`/`in`/`contains`.
- `src/lib/workflows/hydrate-associations.server.ts` (ou etapa equivalente antes da avaliação): quando as condições do workflow referenciarem o campo virtual, carregar `deal_line_items` do negócio (`service_catalog_id`, nome do serviço) e anexar ao registro avaliado como `line_item_service_id[]` e `line_item_service_name[]`. Sem referência ao campo, nenhuma consulta extra é feita.
- `src/lib/workflows/token-catalog.ts`: token `{{deal.services}}` a partir da mesma hidratação.
- Testes em `src/lib/workflows/conditions.test.ts` cobrindo múltiplos itens, item sem serviço e negócio sem itens.

Sem migration, sem alteração de schema, RLS, permissões ou regra de negócio dos módulos.

## Validação

`bun run typecheck`, ESLint dos arquivos alterados, `bun run test` e conferência autenticada em `/settings/workflows`.

## Como validar manualmente

1. Passo "Atualizar registro" em Negócios: sem etapa, o substatus fica desabilitado; ao escolher a etapa, lista só os substatus dela; ao trocar a etapa, o valor incompatível é limpo.
2. Abrir workflow antigo com substatus de outra etapa: o nome continua exibido.
3. Nova condição em Negócios → "Serviço (itens do negócio)" é igual a "Hunting": salvar, alterar um negócio com item de Hunting e conferir a execução no histórico do workflow.
4. Negócio sem itens de linha: a condição não dispara.
