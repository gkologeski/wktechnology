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
version: 1
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
4. Aguarde "Serviço ativado." e confira os lançamentos gerados.
<!-- screenshot: Ativar um serviço, sem dados pessoais reais -->

## Resultado esperado
O procedimento de ativação do serviço é executado com as verificações de cobrança.

## Regras e limites
- "Ativar" e salvar o campo Status são ações diferentes.
- Não considere a ativação como envio automático de cobrança ao cliente.
- Bloqueios de cobrança e permissões são verificados no servidor.

## Erros comuns
Se a ativação falhar, leia a mensagem e revise a configuração antes de tentar novamente.

## Relacionados
- [Editar serviço](/ajuda/contracts/editar-servico)
