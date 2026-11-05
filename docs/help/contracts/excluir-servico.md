---
module_key: contracts
slug: excluir-servico
title: Excluir um serviço
summary: Excluir um serviço no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /services/$id
min_permission:
audience: internal
sort_order: 83
version: 1
is_published: true
---
# Excluir um serviço
**Para que serve:** Excluir um serviço.
**Quem pode fazer:** Exclusão de techservice.services para o registro, sem bloqueio adicional de exclusão.
**Onde fica:** TechContracts > Contratos (/services/$id).
**Antes de começar:** Confirmar que o serviço pode ser removido sem comprometer seus vínculos.

## Passo a passo
1. Abra o serviço.
2. Acione "Excluir serviço".
3. Confirme "Excluir este serviço?" somente se a remoção estiver correta.
<!-- screenshot: Excluir um serviço, sem dados pessoais reais -->

## Resultado esperado
"Serviço excluído." e retorno à listagem.

## Regras e limites
- Excluir não é pausar ou cancelar. A operação remove o cadastro.
- O acesso e os vínculos do registro podem impedir a exclusão.

## Erros comuns
"Você não tem permissão para excluir este registro.": solicite revisão do seu acesso; não tente contornar pela URL.

## Relacionados
- [Editar serviço](/ajuda/contracts/editar-servico)
