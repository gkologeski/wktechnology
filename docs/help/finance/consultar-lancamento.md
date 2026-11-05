---
module_key: finance
slug: consultar-lancamento
title: Consultar lançamento e suas parcelas
summary: Consultar lançamento e suas parcelas no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /finance/entries/$id
min_permission: techfinance.entries.view.own
audience: internal
sort_order: 80
version: 1
is_published: true
---
# Consultar lançamento e suas parcelas

**Para que serve:** Consultar lançamento e suas parcelas, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.entries`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Consultar lançamento e suas parcelas (`/finance/entries/$id`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Abra a descrição do título em A receber ou A pagar.
2. Confira Valor total, Em aberto, Status e a seção Dados.
3. Consulte parcelas e histórico de pagamentos.
4. Use Cancelar somente se a capacidade do registro permitir.
5. Para remover parcelas em aberto, confira a confirmação e os totais excluídos e mantidos retornados.

## Resultado esperado
Ficha consultada com vínculos, pagamentos e situação atual.

## Regras e limites
- A ficha não é um editor genérico de todos os campos.
- Cancelamento, exclusão, baixa e estorno são operações diferentes e possuem autorização própria.
- Registros indisponíveis não devem ser tratados como inexistentes em todo o sistema.

### Campos e controles
Contraparte; categoria; competência; vencimento; valores; status; notas quando presentes; informações de parcelamento e pagamentos.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Consultar lançamento e suas parcelas; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/finance.entries.$id.tsx -->
