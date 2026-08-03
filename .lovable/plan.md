# Nome do projeto deve ser texto livre com pills

No passo "Criar registro (qualquer módulo)" com tabela **Projetos**, o campo **Nome** aparece como combo ("Selecionar…") oferecendo apenas "projeto modelo", impedindo digitar um título e usar variáveis.

## Causa

O catálogo de campos transforma qualquer coluna de texto com poucos valores distintos já existentes no banco em combo de seleção. Como só existe um projeto cadastrado ("projeto modelo"), a coluna `name` virou combo com esse único valor. Não tem relação com "Aplicar modelo" (modelos de passo), que segue vazio porque nenhum modelo de passo foi salvo.

## Correção

- Tratar campos de identificação/título como digitação livre, nunca como combo por amostragem: `name`, `title`, `subject`, `full_name`, `first_name`, `last_name`, `company_name`, `label`, `code`, `slug`, `email`, `phone`, `document`, `cnpj`, `cpf`.
- Esses campos voltam a renderizar como entrada de texto com as pills de variáveis (Registro, associações, passos anteriores, variáveis do fluxo).
- Listas canônicas e registros oficiais (etapa, moeda, prioridade, motivos, etc.) continuam como combo — nada muda para eles.

## Detalhes técnicos

- `src/lib/entity-fields.functions.ts`: incluir a lista de campos de identificação na regra de texto livre (`FREE_TEXT`), avaliada antes da amostragem de `distinct_values`.
- Sem alteração de schema, RLS ou motor de workflows.

## Como validar

1. Em `/settings/workflows`, passo "Criar registro (qualquer módulo)" → tabela Projetos: campo **Nome** deve ser campo de texto com pills abaixo.
2. Digitar texto e inserir uma variável (ex.: `{{company.name}}`) e salvar.
3. Conferir que campos como Etapa, Moeda e Prioridade seguem como combo.
