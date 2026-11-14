# ATIVA-COBRA — Serviço ativa antes, cobrança só após assinatura

Porte M · estimativa 3h–4h (código, migração, testes, Ajuda e permissões). Sem publicação.

## Regra de negócio
- O serviço pode ser ativado a qualquer momento (operação e alocação começam).
- Contas a receber, faturas e cobranças recorrentes só nascem quando o contrato vinculado estiver assinado (`signed_at` preenchido / status ativo).
- Serviço sem contrato vinculado mantém o comportamento atual.

## O que muda para o usuário
1. Ao ativar um serviço com contrato ainda não assinado: serviço fica "Ativo" e aparece o aviso "Cobrança aguardando assinatura do contrato". Nenhuma parcela é criada.
2. Quando o contrato é assinado (TechERP, ForSign ou registro de assinatura externa): as parcelas são geradas automaticamente, uma única vez, com vencimentos "na assinatura" usando a data real da assinatura.
3. Botão "Gerar cobrança agora" fica bloqueado com explicação enquanto o contrato não for assinado.

## Etapas
1. Migração nova (aditiva): ajustar `service_activate_with_terms` e `service_bill_checked` para ativar sem gerar lançamentos quando o contrato não está assinado, marcando o serviço como "cobrança pendente de assinatura".
2. Nova função de liberação da cobrança: gera as parcelas (idempotente pelo `external_ref` atual `payment-terms:<contrato>:*`), usando `signed_at` como data base.
3. Disparo pela assinatura: Workflow/evento `contracts.contract.signed` chama a liberação (preferência por workflows entre módulos), com fallback na mesma transação de registro de assinatura caso o preset não esteja ativo.
4. Interface: aviso no quadro de serviços do contrato e na ficha do serviço; estado desabilitado com texto acessível.
5. Testes: ativar sem assinatura não cria lançamento; assinar gera uma vez; reassinar/reprocessar não duplica; serviço sem contrato segue cobrando; permissões (permitido, sem chave, deny, outro workspace, inativo).
6. Ajuda: atualizar artigo de serviços/ativação e de condições de pagamento (bump de versão). Permissões: reutiliza `techservice.services.update` e a permissão de faturamento existente; contratos de permissão atualizados com hashes.

## Pontos de atenção
- Serviços já ativos com contrato não assinado e parcelas já criadas não são alterados automaticamente; listarei os casos para decisão sua.
- Faturamento recorrente legado (`service_bill_checked`) recebe a mesma trava.
