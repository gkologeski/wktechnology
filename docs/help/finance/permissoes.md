---
module_key: finance
slug: permissoes
title: Permissões do TechFinance
summary: Permissões do TechFinance no TechFinance: operação, acesso e limites confirmados no código.
article_type: reference
route_pattern: /finance
min_permission: 
audience: internal
sort_order: 330
version: 1
is_published: true
---
# Permissões do TechFinance

## Regra de acesso
Membership ativo no workspace ativo, licença do módulo e permissões efetivas são necessários. Deny prevalece. Escopos own, team e workspace não são intercambiáveis. Visibilidade do menu não autoriza a operação. Admin/gestor no menu não significa bypass irrestrito no servidor.

## Leitura e menu
Dashboard, A receber, A pagar e Faturamento de Serviços usam entries.view.own/team/workspace. Recorrências usa recurrences.view nos mesmos escopos. DRE/Fluxo usam reports.view. Cadastros usam categories, cost_centers, legal_entities, legal_entity_groups e bank_accounts com view.workspace/team/own. Banco Inter e Conciliação usam banking.view.workspace. Vendas importadas usa sales.view.workspace. NFS-e e Auditoria usam seus recursos view nos escopos do menu. Réguas e templates usam dunning e charging_templates. Prefixo dessas chaves: `techfinance.`. Faturas também aceita as chaves `techsales.invoices.view.*` listadas no menu.

## Criar e alterar
A criação rápida de títulos aceita entries.create.own ou entries.create.workspace. Edição e exclusão dependem da capacidade do registro; a edição em lote exige autorização de todos os selecionados. Baixa e estorno passam por finance_payment_access; não deduzir acesso apenas de entries.update. Recorrências retornam can_update, can_delete e can_generate. Cadastros de negócio usam finance_business_authorize e capacidades por linha.

## Exportar
Títulos: entries.export.workspace; relatórios: reports.export.workspace; contas bancárias: bank_accounts.export.workspace; NFS-e: nfse.export.workspace. Outras exportações usam as chaves explicitadas pela respectiva tela. Prefixo techfinance. A autorização é conferida novamente no servidor.

## Ações bancárias especiais
banking_sync.manage.workspace; bank_charge_issuance.manage.workspace; bank_charge_cancellation.manage.workspace; bank_payment_drafts.create.workspace; bank_payment_approval.manage.workspace; bank_payment_execution.manage.workspace; bank_payment_cancellation.manage.workspace; banking_simulation.manage.workspace. Conciliação exige banking.update.workspace; criar títulos por conciliação também exige entries.create. Todos sob techfinance.

## Controles comprovados
finance_entry_access, finance_payment_access, finance_recurrence_access/capabilities e finance_business_authorize limitam ações de registro. RLS e RPCs completam os controles do cliente. Não orientar concessão automática para todos os cargos.

## Limite da Ajuda
`min_permission` admite uma chave exata, mas vários menus aceitam qualquer chave de uma lista. Um artigo pode ficar indisponível para um escopo alternativo legítimo. A Ajuda não altera suas permissões; solicite revisão editorial se o material não aparecer.

## Para solicitar acesso
Informe tela, ação desejada e contexto sem dados privados. O administrador deve revisar cargo, deny, membership, licença e escopo. Não conceda manage apenas para liberar leitura.
