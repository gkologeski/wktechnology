# PRAZO-MENSAL — Mensalidade real e prazo mínimo na proposta

Porte M · estimativa 3h a 4h (inclui banco, telas, Ajuda, permissões e testes).

## Diagnóstico
O preset "Desenvolvedor Java Sênior" vale R$ 22.000 por mês, mas a proposta trata esse valor como total e o divide em 12 parcelas de R$ 1.833,33. O que está errado é o valor total, não a forma de pagamento.

## Recomendação
Para serviços recorrentes (Outsourcing, alocação), o valor do catálogo é a **mensalidade**. O total passa a ser calculado: **mensalidade × meses do prazo**. A forma de pagamento "Mensal" segue o prazo, e cada parcela fica com o valor cheio (R$ 22.000).

Exemplo: 3 meses dá R$ 66.000 de total, em 3 parcelas de R$ 22.000. Com 12 meses, dá R$ 264.000 em 12 parcelas.

## Novo bloco "Prazo do contrato" (cotação, proposta e contrato)
- **Prazo mínimo:** padrão 3 meses, com atalhos 3, 6, 12 e 24 e valor livre.
- **Aviso prévio:** padrão 30 dias, editável.
- **Após o prazo mínimo:** renovação automática mês a mês (padrão) ou término na data.
- Os padrões ficam configuráveis por workspace. A proposta pode ser alterada livremente.
- Ao mudar o prazo, o número de mensalidades e o total se ajustam juntos. O usuário ainda pode trocar a forma de pagamento.
- Serviços de valor único ou por projeto continuam como hoje (total dividido).

## Onde aparece
- Assistentes de cotação e proposta, ao lado das Condições de pagamento.
- Documento da proposta (tela, link público e PDF): "Prazo mínimo de 3 meses, aviso prévio de 30 dias".
- O contrato herda o prazo. Novas variáveis no modelo: {{contract.minimum_term_months}}, {{contract.notice_days}} e o valor mensal por extenso, que já existe.
- A fatura continua retida até a assinatura (regra ATIVA-COBRA).

## Dados existentes
Cotações, propostas e contratos antigos não mudam. A proposta atual pode ser corrigida pelo assistente depois da entrega.

## Detalhes técnicos
- Migração aditiva: colunas `minimum_term_months int`, `notice_days int` e `auto_renew bool` (todas anuláveis) em quotes, proposals e contracts. Padrões do workspace em `contract_defaults`. Sem mudança de RLS: as colunas herdam as políticas atuais.
- `payment-terms.ts`: função pura `recurringTotal(monthly, months)`. Para itens recorrentes, o plano mensal usa o valor da mensalidade (sem divisão) e `months = minimum_term_months`.
- `payment-terms-editor.tsx` + quote-wizard/proposal-wizard: bloco de prazo; `sales-flow.server.ts` repassa o prazo na conversão Cotação → Proposta → Contrato; `loadProposalDocument` exibe o prazo.
- Permissões: as chaves de edição de cotação, proposta e contrato são reaproveitadas, com contratos de hash atualizados. Os padrões do workspace usam a permissão existente de configurações de contrato.
- Testes: 22.000 × 3 = 66.000 com 3 parcelas de 22.000; 12 meses = 264.000; padrão 3 meses/30 dias; serviço por projeto segue dividindo.
- Ajuda: artigos de condições de pagamento e proposta com versão incrementada; gates permissions:check, help:coverage e build.

---

# MINUTA-BLOQUEIO — Contrato só depois da minuta, com dispensa controlada

Porte P/M · estimativa +1h30 a 2h (total do plano: 4h30 a 6h).

## Problema
Hoje o assistente "Novo contrato" deixa chegar até a Revisão e só recusa no clique final, com o aviso "Aguarde a aprovação jurídica e o aceite da minuta pelo cliente".

## Mudança
- Já na etapa Origem, se a proposta escolhida exigir minuta ainda não aceita, o botão "Criar contrato" fica desabilitado. Aparece um aviso fixo com a situação ("Minuta não enviada", "Aguardando Jurídico" ou "Aguardando cliente") e o botão "Abrir minuta".
- **Dispensar aceite do cliente** (na minuta, depois da aprovação jurídica): uma ação nova com confirmação e justificativa obrigatória. A minuta fica como "Aceite dispensado", o negócio segue para "Contrato em elaboração" como no aceite normal, e o registro aparece no histórico (quem, quando, motivo).
- A aprovação jurídica continua obrigatória e não pode ser dispensada.

## Detalhes técnicos
- Nova permissão `contracts.drafts.bypass_client_acceptance` (escopo workspace), cadastrada no catálogo e em /settings/permissions. Não é concedida automaticamente a ninguém, apenas a admin/owner pelo bypass padrão.
- RPC SECURITY DEFINER com consulta fixa: valida o membro ativo, o workspace, a permissão (deny prevalece) e o status jurídico aprovado. Grava `client_acceptance_bypassed_at/by/reason` em contract_drafts e um evento em contract_draft_events, e reaproveita o gatilho do aceite.
- A regra do servidor que hoje recusa a criação passa a aceitar "aceita ou dispensada". O assistente usa a mesma regra pura para desabilitar o botão.
- Testes: botão desabilitado sem minuta; habilitado com aceite; habilitado com dispensa; dispensa negada sem permissão, de outro workspace, de membro inativo ou sem aprovação jurídica.
- Ajuda: artigos da minuta e do assistente de contrato com versão incrementada.
