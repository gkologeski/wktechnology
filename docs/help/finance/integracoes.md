---
module_key: finance
slug: integracoes
title: Integrações e limites operacionais
summary: Integrações e limites operacionais no TechFinance: operação, acesso e limites confirmados no código.
article_type: reference
route_pattern: /settings/integrations/contaazul
min_permission: 
audience: internal
sort_order: 310
version: 1
is_published: true
---
# Integrações e limites operacionais

## Conta Azul
A configuração atual fica em `/settings/integrations/contaazul`; `/integrations/contaazul` redireciona para ela. O componente usa o controle compartilhado INTEGRATIONS_MANAGE; isso não é uma chave de leitura de vendas. Importações passam pelo planejamento e reconciliação do importador completo: registros existentes ganham vínculo, novos carregam o identificador da execução para rollback e ambiguidades vão para revisão. Baixas vêm de financial_payments, não de sobrescrever paid_amount.

## Banco Inter
Consulte [conexão](/ajuda/finance/operar-banco-inter), [cobranças](/ajuda/finance/gerenciar-cobrancas-bancarias), [pagamentos](/ajuda/finance/gerenciar-pagamentos-bancarios) e [conciliação](/ajuda/finance/conciliar-transacoes). Mock exige habilitação e não representa movimentação real. Aprovação e execução bancária são separadas.

## NFS-e
`issueNfse` lança indisponibilidade após autorizar leitura da fatura: nenhuma nota é emitida pelo adaptador atual. PDFs/XMLs existentes só podem ser abertos quando os links estiverem presentes.

## Serviços, contratos e projetos
Serviços usam fluxo compartilhado. Medições contratuais podem gerar título interno ou vincular legado; esse fluxo não emite nota, boleto ou cobrança. Consulte [Gerar título de medição](/ajuda/contracts/gerar-medicao-financeiro). A aba financeira de projetos é externa ao conjunto de rotas /finance e deve ser documentada no módulo Projects.

## Cobrança e agendas
Configuração de régua, templates e recorrência não certifica execução de cron ou entrega de canal.
