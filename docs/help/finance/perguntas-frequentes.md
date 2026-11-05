---
module_key: finance
slug: perguntas-frequentes
title: Perguntas frequentes do TechFinance
summary: Perguntas frequentes do TechFinance no TechFinance: operação, acesso e limites confirmados no código.
article_type: faq
route_pattern: /finance
min_permission: 
audience: internal
sort_order: 350
version: 1
is_published: true
---
# Perguntas frequentes do TechFinance

## Criar título emite nota ou boleto?
Não. Cadastro de título é interno. Cobrança bancária e emissão fiscal são fluxos separados; o adaptador NFS-e atual está indisponível.

## Dar baixa transfere dinheiro?
Não necessariamente. A baixa manual registra o fato financeiro; execução bancária é operação separada.

## Posso quitar arrastando o Kanban?
Não. O status dos títulos deriva de pagamentos; Kanban é somente leitura para essa finalidade.

## Parcelamento e recorrência são iguais?
Não. Parcelamento divide um total em 2–120 parcelas; recorrência repete a geração conforme agenda e limites.

## Por que outra pessoa vê valores diferentes?
Permissões, escopos, filtros e workspace podem diferir. Indicadores só incluem registros consultáveis.

## Por que a DRE muda entre Competência e Caixa?
O regime muda o critério temporal: competência do título ou data de pagamento.

## Grupo empresarial soma tudo sem ajustes?
Não necessariamente. O consolidado pode eliminar lançamentos intercompany entre seus CNPJs.

## Centro de custo tem cadastro nesta tela?
Não foi confirmado. A rota atual é de consulta de estrutura e vínculos.

## Posso editar venda importada nesta listagem?
Não. Vendas importadas é somente leitura.

## Aprovar pagamento significa executar?
Não. A execução é uma ação separada; consulte também a liquidação.

## Mock comprova pagamento bancário?
Não. Mock é simulação e depende de habilitação.

## Salvar template envia WhatsApp?
Não. É configuração; envio depende de execução e canal. Um template interno não equivale a template aprovado pela Meta.

## Empresa padrão concede acesso?
Não. É configuração financeira, não autorização RBAC.

## Por que tenho acesso à tela, mas não ao artigo?
