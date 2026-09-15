# Eliminar campos de contrato ainda exibidos em inglês

## Correção

- Garantir rótulos PT-BR também no catálogo global usado como fallback pelo Workflow Builder, incluindo:
  - `amendment_number` → **Número do aditivo**
  - `document_kind` → **Tipo de documento**
  - `amendment_of_id` → **Aditivo do contrato**
  - `amendment_effective_at` → **Vigência do aditivo**
- Preservar os nomes técnicos e valores internos usados para salvar; somente a apresentação será traduzida.
- Revisar as demais colunas de contratos para que nenhuma caia no fallback automático em inglês.
- Atualizar a identificação do cache do catálogo de campos para que o editor carregue imediatamente os novos rótulos, sem manter a resposta antiga por até cinco minutos.

## Prevenção de regressão

- Ampliar o teste de cobertura para validar o caminho real usado pelo Workflow Builder (`toLabel(campo, "contracts")`), não apenas o catálogo específico de contratos.
- Fazer o teste falhar caso qualquer campo conhecido de contrato volte a exibir o nome técnico ou sua versão humanizada em inglês.

## Validação

- Executar typecheck, lint e os testes de contratos/workflows.
- Conferir no editor de workflow que **Amendment Number** e **Document Kind** aparecem como **Número do aditivo** e **Tipo de documento**, inclusive após recarregar a página.
- Confirmar que os valores já configurados no workflow permanecem intactos.
