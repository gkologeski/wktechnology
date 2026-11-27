---
module_key: contracts
slug: ativar-servico
title: Ativar um serviço
summary: Ativar um serviço no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /services/$id
min_permission:
audience: internal
sort_order: 82
version: 4
is_published: true
---
# Ativar um serviço
**Para que serve:** Ativar um serviço.
**Quem pode fazer:** Atualização de techservice.services no escopo do registro.
**Onde fica:** TechContracts > Contratos (/services/$id).
**Antes de começar:** Conferir contrato, valores, direção e cobrança do serviço.

## Passo a passo
1. Abra a ficha do serviço.
2. Confira valores e datas.
3. Quando disponível, clique em "Ativar".
4. Confira o resultado da ativação e a situação da cobrança. Quando retida, nenhum título é gerado nessa etapa.
5. Se o trabalho já foi entregue, use **Concluir execução** com a data real e a comprovação. A conclusão não depende da assinatura e não libera cobrança sozinha.
![Tela: Ativar um serviço, sem dados pessoais reais](/help-media/contracts/ativar-servico.webp)

## Resultado esperado
O procedimento de ativação do serviço é executado com as verificações de cobrança.

## Regras e limites
- "Ativar" e salvar o campo Status são ações diferentes.
- Não considere a ativação como envio automático de cobrança ao cliente.
- Bloqueios de cobrança e permissões são verificados no servidor.
- O serviço pode ser ativado antes da assinatura. Sem assinatura nem liberação comercial autorizada, aparece "Cobrança aguardando assinatura do contrato" e nenhum lançamento é criado.
- Em contratos de prestação, o aceite comercial da versão atual pode permitir **Liberar faturamento**, com permissão financeira e vencimentos conferidos. Esse aceite não registra assinatura.
- A liberação da cobrança preserva a conclusão operacional e evita duplicidade. Uma assinatura posterior não cria novamente os títulos já gerados pelo aceite.
- Datas de parcelas condicionadas à assinatura usam a assinatura real quando ela existe. Para antecipar por aceite comercial, confira e informe o vencimento acordado na liberação financeira.

## Erros comuns
Se a ativação falhar, leia a mensagem e revise a configuração antes de tentar novamente.

## Relacionados
- [Editar serviço](/ajuda/contracts/editar-servico)
- [Concluir a execução de um serviço](/ajuda/contracts/concluir-execucao-servico)
- [Registrar o aceite do contrato e liberar faturamento](/ajuda/contracts/aceitar-contrato)
