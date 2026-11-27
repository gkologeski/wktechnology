---
module_key: contracts
slug: concluir-execucao-servico
title: Concluir a execução de um serviço
summary: Registre o trabalho entregue com data e comprovação, preservando pendências de aceite, assinatura e faturamento.
article_type: howto
route_pattern: /services/$id
min_permission:
audience: internal
sort_order: 84
version: 1
is_published: true
---
# Concluir a execução de um serviço
**Para que serve:** Registrar que o serviço foi executado, mesmo quando a assinatura do contrato está pendente.
**Quem pode fazer:** Membro ativo com acesso e atualização do serviço e `techservice.service_execution.manage.workspace`. A ação não concede permissões financeiras.
**Onde fica:** TechContracts > Contratos > contrato > Serviços > ficha do serviço (`/services/$id`). Os serviços também ficam acessíveis pela jornada do negócio conforme suas permissões.
**Antes de começar:** Confira o contrato vinculado, o serviço entregue e a data real de conclusão. Separe a comprovação do trabalho realizado.

## Passo a passo
1. Abra a ficha do serviço e confira **Início**, **Fim** e a situação atual.
2. Se houver dados de execução incorretos, corrija e salve antes de continuar.
3. Se estiver **Pendente**, use **Ativar** primeiro e confira a retenção da cobrança. Com o serviço ativo, use **Concluir execução**.
4. Informe **Data da conclusão** e **Motivo e comprovação**, descrevendo o que foi entregue. Não use uma data futura nem invente uma data para suprir informação ausente.
5. Confirme e confira o serviço como **Concluído**, com o registro da conclusão.
6. Confira separadamente a assinatura e a cobrança. Se não houver assinatura nem liberação por aceite, a cobrança permanece retida.

## Resultado esperado
A execução fica concluída com data, responsável e justificativa. A pendência documental permanece visível. A ação não assina o contrato nem gera títulos financeiros.

## Regras e limites
- A conclusão pode ser registrada também para serviços do tipo **Único** antes da assinatura.
- Um serviço concluído pode continuar com a cobrança retida. Isso não representa falha no lançamento.
- **Ativar**, **Concluir execução**, **Registrar aceite recebido** e **Liberar faturamento** possuem efeitos diferentes e verificações próprias.
- Não altere o campo Status para contornar a ação de conclusão: use o procedimento que registra a comprovação.
- A conclusão não resolve automaticamente tarefas de assinatura, aprovação, recrutamento ou alocação vinculadas ao contrato.
- Repetir a confirmação não cria outra execução nem outra cobrança. Se os dados precisarem de correção, preserve o histórico e use as ações autorizadas.

## Erros comuns
- **Ação indisponível:** confira a situação do serviço e sua permissão de conclusão; não use outra conta para contornar o bloqueio.
- **Data inválida:** informe a data real compatível com o início cadastrado e não posterior ao dia atual.
- **Comprovação insuficiente:** descreva a entrega e a origem da informação com clareza.
- **Assinatura ainda pendente:** a conclusão é operacional. Continue a formalização no contrato ou registre o aceite comercial quando ele existir.

## Relacionados
- [Registrar o aceite do contrato e liberar faturamento](/ajuda/contracts/aceitar-contrato)
- [Ativar um serviço](/ajuda/contracts/ativar-servico)
- [Editar a ficha de um serviço](/ajuda/contracts/editar-servico)
- [Acompanhar a jornada comercial e contratação](/ajuda/crm/acompanhar-jornada-de-contratacao)
