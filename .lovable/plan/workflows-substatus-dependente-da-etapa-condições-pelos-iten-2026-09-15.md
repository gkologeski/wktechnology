# Workflows: substatus dependente da etapa + condições pelos itens de linha do negócio

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

## Parte 2 — Filtrar e condicionar pelos itens de linha do negócio

Hoje as condições só leem campos do próprio negócio. Os itens de linha (serviço, cargo, senioridade, quantidade, valor) ficam em outra tabela e não aparecem na lista de campos — por isso não há como escrever "se o serviço do negócio for Hunting".

### O que passa a existir

Um grupo novo no seletor de campos das condições em Negócios: **"Itens do negócio"**, com os campos:

- **Serviço** (escolha por nome no catálogo de serviços)
- **Cargo/perfil** e **Senioridade**
- **Preset de contratação**
- **Descrição do item** (texto)
- **Quantidade**, **Valor unitário** e **Valor total do item**
- **Quantidade de itens do negócio** (número de linhas)

### Como a condição é avaliada

- Regra padrão: a condição é verdadeira quando **qualquer** item de linha atende. Ex.: "Serviço é igual a Hunting" dispara para negócios com pelo menos um item de Hunting.
- Cada condição também aceita o modo **"todos os itens"**, para casos como "todos os itens são do serviço X".
- Operadores conforme o tipo: igual/diferente/está entre (vários valores)/contém para texto e referência; maior que/menor que para número; está vazio/não está vazio.
- Quando o negócio não tem itens, condições sobre itens são falsas (e "está vazio" é verdadeira).
- Como os itens são cadastrados depois de criar o negócio, gatilhos de criação normalmente ainda não têm itens; a tela avisa e sugere o gatilho de atualização do negócio.

### Onde se aplica

Condições do gatilho, condições de ramificação e critérios de meta — o mesmo seletor.

Além disso, ficam disponíveis tokens de texto para usar em e-mail, tarefa e atividade: `{{deal.services}}` (nomes dos serviços separados por vírgula), `{{deal.line_items_count}}` e `{{deal.line_items_summary}}` (lista "Serviço — qtd x valor").

Nada é removido; condições existentes continuam válidas.

---

## Detalhes técnicos

### Parte 1

- `src/lib/workflow-refs.functions.ts` (`searchSimpleRefs`, ramo `substatus`): aceitar `stage_value` e `pipeline_id` opcionais no input e aplicá-los na consulta; sem `stage_value`, não retornar lista. Ordenação segue `position`. Busca por `ids` (hidratação de rótulo) continua sem filtro, garantindo a regra 4.
- `src/components/workflows/extra-fields-editor.tsx`: `FkPicker` recebe `filters?: { stage_value?: string; pipeline_id?: string }`, repassa na busca e inclui na `queryKey`; estado desabilitado + dica quando faltar etapa. No render de `stage_substatus_id`, derivar os filtros de `siblingValues` (`stage_value`/`stage_id`, `pipeline_id`) — mesmo mecanismo já usado em `contracting_legal_entity_id` — e limpar o valor incompatível ao trocar a etapa.
- `src/components/workflows/builder/conditions-editor.tsx`: para condições sobre `stage_substatus_id`, resolver a etapa pelas condições irmãs sobre `stage_id`/`stage_value` do mesmo grupo.

### Parte 2

- Novo módulo `src/lib/workflows/line-items.ts`: catálogo dos campos virtuais `line_items.*` (`service_catalog_id`, `job_profile_id`, `seniority`, `contracting_preset_id`, `name`, `description`, `quantity`, `unit_price`, `total`, `count`) com rótulos PT-BR, tipos e `ref` (serviço/cargo/preset) — colunas confirmadas em `deal_line_items`.
- `src/lib/workflows/types.ts`: `WorkflowFilter` ganha `match?: "any" | "all"` (padrão `any`), usado apenas por campos `line_items.*`.
- `src/lib/workflows/engine-shared.server.ts`: em `evalFilter`, quando `f.field` começa com `line_items.`, avaliar a lista de itens hidratada (`any`/`all`), reaproveitando a comparação por operador já existente; `count` compara o número de itens.
- Hidratação: nova função em `src/lib/workflows/hydrate-associations.server.ts` (ou `line-items.server.ts` irmão) que, quando o JSON do workflow referenciar `line_items.` ou os tokens de itens, carrega `deal_line_items` do negócio com o nome do serviço/cargo/preset e anexa `__line_items` ao registro avaliado. Sem referência, nenhuma consulta extra.
- `src/components/workflows/builder/conditions-editor.tsx`: grupo "Itens do negócio" no seletor de campos (só para `entity === "deals"`), seletor de referência por nome nos campos de serviço/cargo/preset, e alternância "qualquer item / todos os itens".
- `src/lib/workflows/token-catalog.ts` + `render-tokens.ts`: tokens `{{deal.services}}`, `{{deal.line_items_count}}`, `{{deal.line_items_summary}}`.
- Testes em `src/lib/workflows/conditions.test.ts` (e um teste do avaliador) cobrindo: qualquer item, todos os itens, item sem serviço, negócio sem itens e comparações numéricas.

Sem migration, sem alteração de schema, RLS, permissões ou regra de negócio dos módulos.

## Validação

`bun run typecheck`, ESLint dos arquivos alterados, `bun run test` e conferência autenticada em `/settings/workflows`.

## Como validar manualmente

1. Passo "Atualizar registro" em Negócios: sem etapa, o substatus fica desabilitado; ao escolher a etapa, lista só os substatus dela; ao trocar a etapa, o valor incompatível é limpo.
2. Abrir workflow antigo com substatus de outra etapa: o nome continua exibido.
3. Nova condição em Negócios → "Itens do negócio · Serviço" é igual a "Hunting": salvar, alterar um negócio com item de Hunting e conferir a execução no histórico do workflow.
4. Repetir com modo "todos os itens" e com "Quantidade de itens do negócio maior que 1".
5. Negócio sem itens de linha: as condições sobre itens não disparam.
