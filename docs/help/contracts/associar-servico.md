---
module_key: contracts
slug: associar-servico
title: Associar serviço do catálogo ao contrato
summary: Associar serviço do catálogo ao contrato no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts/$id
min_permission:
audience: internal
sort_order: 35
version: 1
is_published: true
---
# Associar serviço do catálogo ao contrato
**Para que serve:** Associar serviço do catálogo ao contrato.
**Quem pode fazer:** Criação de techservice.services; o servidor exige techservice.services.create.own neste caminho.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Contrato de Prestação, serviço do catálogo ativo e cargo ativo se selecionado.

## Passo a passo
1. Abra o contrato de prestação.
2. No card "Serviços", clique em "Associar serviço".
3. Em "Associar serviço ao contrato", escolha "Preset de contratação" se necessário e "Serviço do catálogo *".
4. Revise "Cargo / perfil contratado", "Senioridade" e "Stack / competências".
5. Preencha "Tipo de cobrança", "Cadência", "Quantidade", "Preço unitário", "Início" e "Fim".
6. Conclua a associação e confira "Serviço associado ao contrato.".
<!-- screenshot: Associar serviço do catálogo ao contrato, sem dados pessoais reais -->

## Resultado esperado
Serviço operacional associado ao contrato; seu nome abre a ficha do serviço.

## Regras e limites
- Serviços são associados à prestação. Compra é aninhada sob prestação, não recebe a mesma associação direta.
- O botão aparecer pelo tipo do contrato não comprova permissão de criação.
- Catálogo ativo é obrigatório. Valor do serviço = quantidade × preço unitário.

## Erros comuns
"Selecione um serviço do catálogo.", "Serviço do catálogo não encontrado ou inativo" ou "Cargo não encontrado ou inativo": revise os cadastros.

## Relacionados
- [Consultar serviços](/ajuda/contracts/consultar-servicos)
