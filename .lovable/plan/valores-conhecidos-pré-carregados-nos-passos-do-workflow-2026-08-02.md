# Valores conhecidos pré-carregados nos passos do workflow

Hoje, na aba de detalhes do passo, alguns campos de valor ainda são texto livre — como o "Valor" de cada case em "Ramificar por valor (switch)", o valor de "Definir campo" e o "stage_value" do ATS. Nas condições (filtros) e no formulário de contrato isso já vem como combo com as listas canônicas (etapas do pipeline, status, formas de pagamento, empresa/usuário/contato via busca por nome).

O objetivo é usar o mesmo comportamento em todos os campos de valor: quando o campo escolhido tem valores conhecidos, mostrar combo; quando é referência (empresa, usuário, contato, pipeline), mostrar busca por nome; só cair para texto livre (com pills de variáveis) quando não houver lista.

## O que muda na tela

1. **Ramificar por valor (switch)**
   - O campo "Valor" de cada case passa a respeitar o campo escolhido em "Campo": combo com as opções conhecidas (ex.: etapas do negócio, status), busca por nome quando o campo é uma referência, ou texto com variáveis quando não há lista.
   - Fica disponível também a opção de digitar um valor livre/variável, para quem precisa de token (`{{...}}`), sem perder o combo.

2. **Definir campo (set_field)**
   - O valor passa a usar o mesmo editor: combo/busca por nome quando o campo escolhido tem valores conhecidos; texto com variáveis caso contrário.

3. **Avançar etapa da candidatura (ATS)**
   - "Novo stage_value" passa a usar as opções conhecidas de etapa de candidatura quando existirem no catálogo; caso contrário, mantém o texto com variáveis.

4. **Condições (filtros)**
   - Comportamento visual inalterado, mas passa a usar o mesmo componente compartilhado, evitando divergência entre telas.

Estados de carregamento, vazio e erro do catálogo continuam como hoje (fallback para texto livre enquanto o catálogo carrega ou quando não há opções).

## Detalhes técnicos

- Extrair de `FilterRow` (em `src/components/workflows/workflow-builder.tsx`) um componente reutilizável `FieldValueEditor` com a lógica atual de escolha do editor: `field.ref` → `FkPicker`; `field.options?.length` → `Select`; senão → `TokenInput`. Inclui o alternador "modo variável" já existente no `FkPicker`, para permitir tokens.
- Usar `FieldValueEditor` em:
  - `SwitchByValueForm` (valor de cada case) — o form passa a receber `entityFields: FieldOpt[]` do `ActionForm` (já disponível no ponto de renderização, linha ~2962) em vez de depender apenas de `FieldSelect`, e resolve o `FieldOpt` do `action.field` para alimentar o editor.
  - `set_field` (linha ~2151), substituindo o `TokenInput` direto.
  - `advance_ats_application_stage` (linha ~2404), resolvendo o campo de etapa no catálogo da entidade quando existir.
  - `FilterRow`, substituindo o bloco inline pelo componente novo.
- Nenhuma mudança em `entity-fields.functions.ts`, engine, schemas, RLS ou banco: as opções canônicas já vêm do catálogo (`getEntityFieldCatalog`, incluindo `pipelineStageOptions`, `registryOptions` e listas canônicas de contratos).
- Valores já salvos continuam válidos; se um valor salvo não estiver na lista, ele é mantido e exibido como opção adicional para não haver perda de dado.

## Validação

- `bunx tsgo --noEmit`, `bunx eslint` nos arquivos alterados e `bunx vitest run`.
- Manual: `/settings/workflows` → passo "Ramificar por valor" com campo "Etapa" → o "Valor" deve listar as etapas do pipeline; passo "Definir campo" com campo "Status" → combo de status; campo de texto simples → segue com pills de variáveis.
