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
version: 3
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

![Tela: Consultar lançamento e suas parcelas](/help-media/finance/consultar-lancamento.webp)
<!-- evidência: src/routes/_authenticated/finance.entries.$id.tsx -->

## Abrir um lançamento pelo aviso

Os avisos **Conta a pagar/receber do dia** e **Conta a pagar/receber vencida** abrem esta ficha pelo ID exato, independentemente da página ou filtro da lista. Acesso continua sujeito a membership ativo, workspace atual, leitura do registro e escopo own/team/workspace aplicável. Baixas e histórico de pagamentos têm autorização própria; leitura do título não concede permissão para pagar, receber, reverter, cancelar ou excluir parcelas.

Aguarde a leitura fresca. Durante revalidação, a ficha e uma baixa em edição ficam ocultas e bloqueadas, preservando os campos apenas na mesma identidade. Se saldo, situação ou capacidade mudar, feche a baixa e confira o lançamento atualizado antes de abrir outra. Erro, revogação ou troca de usuário/workspace retira o conteúdo antigo. O link não abre a baixa automaticamente e nunca movimenta dinheiro, registra recebimento ou envia cobrança.

Vencimento, competência e data de baixa são datas civis; não há hora implícita nesses campos. Avisos e seus históricos usam texto neutro, sem transportar valores, saldo, notas privadas ou dados bancários.
