# Aninhar contrato de compra: para que serve e por que não acha nada

## Para que serve

No contrato de **prestação** (nossos CNPJs são a CONTRATADA) o card "Contratos de compra aninhados" serve para declarar quais **contratos de compra** (onde somos a CONTRATANTE do profissional/prestador que atua para o cliente daquele contrato de prestação) sustentam aquela operação. O vínculo (`parent_contract_id`):

- faz o contrato de compra aparecer indentado sob o contrato de prestação em `/contracts`, junto com os aditivos;
- alimenta as métricas de margem (receita da prestação x custo das compras);
- tira o contrato da fila de pendências em `/contracts/links`;
- é o mesmo vínculo que a análise por IA propõe.

Aditivos usam outro campo (`amendment_of_id`) e são vinculados pelo card de aditivos — cada contrato (prestação ou compra) pode ter os seus.

## Por que não acha nenhum contrato

Não é falta de dados: existem 85 contratos de compra no workspace. A busca falha antes de filtrar, com erro do banco:

`Could not find a relationship between 'contracts' and 'contracts' in the schema cache`

Confirmado por teste direto na API: a consulta que lista os contratos vinculáveis embute o contrato pai usando o **nome da constraint** como dica (`contracts!contracts_parent_contract_id_fkey`), e nesse caso auto-referente a API rejeita a dica (400). Usando a **coluna** como dica (`contracts!parent_contract_id`) a mesma consulta responde 200.

## Correção

- `src/lib/contracts.functions.ts` → `listLinkableContracts`: trocar a dica do embed do contrato pai de `contracts!contracts_parent_contract_id_fkey` para `contracts!parent_contract_id`. Nenhuma outra mudança de comportamento; o restante (filtro por papel, busca por título/número, aviso "já aninhado em X") continua igual.
- Revalidar no diálogo "Aninhar contrato de compra": lista carrega, busca por texto funciona, e contratos já aninhados aparecem com o aviso de mover o vínculo.

Sem alteração de schema, RLS, grants ou regras de negócio. Validação: `tsgo`, lint e testes existentes de contratos, mais conferência manual no detalhe do contrato de prestação atual.
