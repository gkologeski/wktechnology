# Corrigir importação em lote de leads da prospecção

## Diagnóstico confirmado

- O erro mostrado no toast vem da função `importProspectAsLead` em `src/lib/prospecting.functions.ts`.
- A função tenta inserir `city: r.location` na tabela `leads`.
- A tabela real `leads` não possui coluna `city`; ela possui `company_name`, `email`, `phone`, `source`, `status`, `notes`, `custom_fields`, entre outros.
- Por isso, cada importação falha com: `Could not find the 'city' column of 'leads' in the schema cache`.

## O que será feito

1. Ajustar o payload de criação do lead para usar apenas colunas existentes em `leads`.
2. Trocar `company: r.company_name` por `company_name: r.company_name`, que é o campo correto da tabela.
3. Remover `title` e `city` do insert direto em `leads`, pois essas colunas não existem.
4. Preservar cargo, localização, indústria, domínio, LinkedIn e origem Apollo dentro de `custom_fields`, sem alterar schema.
5. Manter `workspace_id` e `owner_id` como já corrigidos, para respeitar RLS e escopo do workspace.
6. Melhorar a mensagem de erro da importação para deixar claro quando o problema vier do mapeamento de campos.

## Detalhes técnicos

- Arquivo a alterar: `src/lib/prospecting.functions.ts`.
- Função: `importProspectAsLead`.
- Payload esperado:
  - `workspace_id`
  - `owner_id`
  - `first_name`
  - `last_name`
  - `company_name`
  - `email`
  - `phone`
  - `source: "prospecting"`
  - `status: "new"`
  - `custom_fields` com metadados do Apollo/prospecção.
- Sem migration, sem alteração de RLS e sem mudança no contrato visual dos botões.

## Como validar

1. Abrir `/prospecting?tab=prospecting`.
2. Entrar em uma busca com resultados.
3. Clicar em `Importar todos os leads`.
4. Confirmar que a barra de progresso avança sem o erro de coluna `city`.
5. Confirmar que os leads aparecem importados e que repetir a ação informa que já existiam.
6. Clicar em `Incluir todos em uma fila` e confirmar que, após importar, o modal de fila abre com os leads selecionados.
