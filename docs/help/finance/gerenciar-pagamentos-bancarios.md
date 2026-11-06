---
module_key: finance
slug: gerenciar-pagamentos-bancarios
title: Gerenciar rascunhos, aprovação e execução bancária
summary: Gerenciar rascunhos, aprovação e execução bancária no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /finance/banking
min_permission: techfinance.banking.view.workspace
audience: internal
sort_order: 210
version: 1
is_published: true
---
# Gerenciar rascunhos, aprovação e execução bancária

**Para que serve:** Gerenciar rascunhos, aprovação e execução bancária, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.banking`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Gerenciar rascunhos, aprovação e execução bancária (`/finance/banking`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Abra Pagamentos e crie um rascunho autorizado.
2. Informe tipo, valor, agendamento, favorecido, documento e dados Pix ou boleto conforme o tipo.
3. Confira o rascunho e use Aprovar se autorizado.
4. Execute pela ação separada e consulte novamente o status.
5. Cancele ou simule liquidação somente quando a ação correspondente estiver disponível.

## Resultado esperado
No único adaptador atual (Inter simulado habilitado), o pagamento percorre estados simulados, sem transferência bancária real. Aprovação, execução e liquidação são etapas distintas.

## Regras e limites
- Criar usa `techfinance.bank_payment_drafts.create.workspace`.
- Aprovar, executar e cancelar usam recursos separados: bank_payment_approval, bank_payment_execution e bank_payment_cancellation, ação manage no escopo workspace.
- Simulação depende de modo mock e chave específica.
- Consulte o status antes de repetir execução após falha.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Gerenciar rascunhos, aprovação e execução bancária; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/finance.banking.tsx; src/lib/banking.functions.ts -->
