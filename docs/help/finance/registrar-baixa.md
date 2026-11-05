---
module_key: finance
slug: registrar-baixa
title: Registrar baixa parcial ou total
summary: Registrar baixa parcial ou total no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /finance/entries/$id
min_permission: techfinance.entries.view.own
audience: internal
sort_order: 90
version: 1
is_published: true
---
# Registrar baixa parcial ou total

**Para que serve:** Registrar baixa parcial ou total, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.entries`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Registrar baixa parcial ou total (`/finance/entries/$id`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Abra o título e use Receber/Pagar quando disponível.
2. Informe valor, data e método; selecione conta bancária se aplicável.
3. Confira que o valor não ultrapassa o saldo em aberto e confirme.
4. Reabra o histórico e verifique saldo e status.

## Resultado esperado
Pagamento financeiro registrado; baixa parcial mantém saldo e a quitação total pode marcar o título como Pago.

## Regras e limites
- Exige capacidade `can_pay`, determinada pelo servidor; não basta acesso à ficha.
- Títulos pagos ou cancelados não oferecem nova baixa nesta interface.
- Registro manual de baixa não executa transferência externa.

### Campos e controles
Valor positivo até o saldo; data; método (Pix, Boleto, Cartão, Transferência, Dinheiro ou Outro); conta bancária opcional.

## Erros comuns
“Informe um valor válido.”: revise o valor. “Valor maior que o saldo em aberto.”: limite ao saldo atualizado. “Sem permissão para esta operação de baixa.”: solicite revisão de acesso.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Registrar baixa parcial ou total; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/components/finance/register-payment-dialog.tsx; src/lib/access-control/finance-records.server.ts -->
