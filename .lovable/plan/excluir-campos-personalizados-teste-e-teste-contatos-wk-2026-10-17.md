# Excluir campos personalizados "Teste" e "teste" (Contatos, WK)

## Encontrado
- "Teste" (chave `teste_wolf`, opcional), criado em 16/07/2026.
- "teste" (chave `teste_texto`, obrigatório), criado em 20/07/2026.
- Nenhum Contato do workspace WK tem valor preenchido nesses campos, então nenhum dado é perdido.

## O que será feito
1. Excluir só esses dois registros de campo personalizado (pelos IDs `208a5097-…` e `96a58013-…`), somente no workspace WK.
2. Não muda a estrutura do banco, as permissões ou outros campos.
3. Conferir no Playwright, na ficha do Contato, que a seção "Personalizadas" não mostra mais os dois campos e que o campo obrigatório deixou de travar o salvamento.
