---
module_key: crm
slug: gerenciar-faturas
title: Gerenciar faturas
summary: Consultar cobranças, criar faturas e registrar pagamentos.
article_type: howto
route_pattern: /invoices
min_permission:
audience: internal
sort_order: 515
version: 2
is_published: true
---
# Gerenciar faturas
**Para que serve:** Consultar faturas e executar ações de cobrança.
**Quem pode fazer:** Menu visível a membros com TechSales; as ações usam `techfinance.invoices` (criar: `techfinance.invoices.create.own` ou `.create.workspace`).
**Onde fica:** Menu > TechSales > Vender > Faturas (`/invoices`).
**Antes de começar:** Tenha valor e vencimento. Pix, boleto e NFS-e dependem das integrações.

## Passo a passo
1. Use "Buscar por número ou descrição".
2. Escolha o status ou "Todos os status".
3. Clique em "Nova fatura".
4. Preencha "Descrição", "Valor (BRL)" e "Vencimento".
5. Clique em "Criar fatura".
6. Para pagamento manual, use "Marcar como paga".
7. Para excluir, use a lixeira e confirme "Excluir fatura?".
8. O botão "NFS-e" fica desabilitado enquanto o adaptador de NFS-e não estiver habilitado ("Adaptador NFS-e não habilitado"). Quando habilitado, a emissão mostra "Emissão de NFS-e iniciada".
<!-- screenshot: filtros e formulário Nova fatura -->

## Resultado esperado
"Fatura criada" ou "Marcada como paga".

## Regras e limites
- "Criar fatura" fica desabilitado sem valor ou vencimento.
- Status: "Rascunho", "Em aberto", "Pagas", "Vencidas", "Canceladas" e "Reembolsadas".
- "Emissão de NFS-e iniciada" não significa nota emitida.

## Erros comuns
- "Adaptador Pix não habilitado", "Adaptador boleto não habilitado", "Adaptador NFS-e não habilitado": peça ao administrador para configurar a integração.
- "Falha ao emitir NFS-e": leia a mensagem e revise a configuração.

## Relacionados
- [Permissões](/ajuda/crm/permissoes)
- [Erros comuns](/ajuda/crm/erros-comuns)
