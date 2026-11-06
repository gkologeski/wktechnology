---
module_key: finance
slug: campos-e-status
title: Referência de campos e status
summary: Referência de campos e status no TechFinance: operação, acesso e limites confirmados no código.
article_type: reference
route_pattern: /finance/entries/$id
min_permission: techfinance.entries.view.own
audience: internal
sort_order: 320
version: 1
is_published: true
---
# Referência de campos e status

## Lançamentos
| Campo | Significado |
|---|---|
| Tipo | A receber ou A pagar |
| Descrição | Identificação do título; obrigatória |
| Valor | Total positivo; cadastro rápido em BRL |
| Em aberto | Valor menos baixas registradas |
| Competência | Data usada no regime de competência |
| Vencimento | Data prevista para o título |
| Categoria | Receita ou despesa conforme direção |
| Contraparte | Empresa relacionada exibida na listagem |
| Empresa contraparte intercompany | Pessoa jurídica interna contraparte; usada na consolidação quando aplicável |
| Responsável | Atribuição exibida/filtrável; não concede acesso |
| Notas | Observações do título |

## Status de título
`open`: Em aberto; `partial`: Parcial; `paid`: Pago; `overdue`: Vencido; `cancelled`: Cancelado. O status financeiro deriva de pagamentos e regras do banco: não arraste o Kanban para forçar quitação.

## Baixas
Valor, data, método e conta opcional. Métodos expostos: Pix, Boleto, Cartão, Transferência, Dinheiro e Outro. Método é classificação e não prova de execução externa.

## Faturas
Status expostos: draft, open, paid, overdue, cancelled e refunded. Número, descrição, gateway, empresa, vencimento e valor são usados na consulta/filtros. Não aplicar automaticamente o vocabulário de fatura ao título.

## Cadastros
Empresa: código, razão social, nome fantasia, CNPJ, IE, IM, ativa e indicação de padrão. Grupo: código, nome, descrição, ativo e membros. Conta: nome, empresa, tipo e saldo inicial. Categoria: nome, código, tipo e pai. Centros de custo: consulta hierárquica e vínculos apresentados.

## Relatórios
DRE: competência/caixa, 3/6/12 meses, empresa/grupo, receitas, despesas e resultado. Fluxo: vencido, 0–30/31–60/61–90 dias, fatores de recebimento/despesa. Consolidado pode eliminar intercompany. Valores refletem o escopo acessível.

## Referências
[Permissões](/ajuda/finance/permissoes) · [Integrações](/ajuda/finance/integracoes)
