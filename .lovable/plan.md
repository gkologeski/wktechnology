# Ajustes no construtor de workflows

## 1. Separar valores pré-carregados nos combos

Nos seletores de referência do passo (empresa, contato, negócio, contrato, responsável, pessoa jurídica), o bloco "Dados do gatilho e passos anteriores" já vem primeiro, mas sem separação visual clara dos resultados da busca.

- Renomear o cabeçalho para o padrão curto "Do gatilho e passos anteriores".
- Inserir separador entre esse bloco e a lista de registros buscados, e dar um cabeçalho próprio à lista buscada ("Registros").
- Mesmo tratamento no seletor em dois estágios (contrato/negócio), mantendo o bloco pré-carregado acima com borda de separação.
- Aplicar a mesma separação nos combos de valores conhecidos (enums/listas canônicas) que também oferecem opções pré-carregadas de token: grupo de tokens primeiro, separador, depois os valores da lista.

## 2. Empresa contratante (CNPJ) conforme o Papel na relação

Regra confirmada:

- Papel na relação = "Compra (somos o cliente)": o campo lista as pessoas jurídicas (CNPJs) do workspace para escolha, com a pessoa jurídica padrão pré-selecionável no topo.
- Papel na relação = "Prestação (somos o prestador)": o campo não lista as nossas pessoas jurídicas; oferece apenas as opções do gatilho/passos anteriores e token, com aviso curto explicando que nesse papel a contratante é a contraparte.

Enquanto o papel não estiver definido no passo, mantém o comportamento atual (lista completa).

## 3. Foco no novo passo

Ao adicionar um passo, após escolher o tipo:

- O novo passo passa a ser selecionado automaticamente (painel de detalhes abre já nele).
- O card do novo passo recebe rolagem até a visualização e foco de teclado, respeitando `prefers-reduced-motion`.

## Detalhes técnicos

- `src/components/workflows/extra-fields-editor.tsx`: `FkPicker` recebe o contexto do passo (valores atuais do registro) para aplicar a regra do `role` em `contracting_legal_entity_id`; cabeçalhos/separadores com `CommandSeparator` e `CommandGroup`.
- `src/components/workflows/company-scoped-picker.tsx` / bloco pré-carregado do popover: separação visual consistente.
- `src/components/workflows/workflow-builder.tsx`: `insertStep`/`insertStepAt` passam a devolver o caminho do passo inserido; `addAction` usa esse caminho em `setSelection` e dispara o scroll/foco no card correspondente.
- Sem alteração de schema, RLS, server functions ou regra de negócio; a filtragem do item 2 é apresentacional (quais opções o combo oferece).

## Como validar

1. `/settings/workflows` → passo "Criar registro" (Contratos).
2. Abrir qualquer campo de referência: bloco do gatilho separado por linha do bloco de registros buscados.
3. Definir Papel na relação = Compra → "Empresa contratante (CNPJ)" lista nossos CNPJs; mudar para Prestação → lista das nossas empresas não aparece, apenas opções do gatilho/token com aviso.
4. Adicionar um novo passo: o painel de detalhes abre no novo passo e a tela rola até ele.
