---
module_key: contracts
slug: criar-da-origem-comercial
title: Criar contrato a partir de cotação, proposta ou modelo
summary: Criar contrato a partir de cotação, proposta ou modelo no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts
min_permission:
audience: internal
sort_order: 22
version: 1
is_published: true
---
# Criar contrato a partir de cotação, proposta ou modelo
**Para que serve:** Criar contrato a partir de cotação, proposta ou modelo.
**Quem pode fazer:** Criação de contrato e acesso à cotação, proposta, negócio ou modelo escolhido.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Abrir o assistente no contexto comercial para usar cotação/proposta; modelo precisa estar publicado.

## Passo a passo
1. Abra o assistente de contrato no contexto do negócio ou da origem comercial.
2. Em "Origem", escolha a cotação, proposta ou modelo disponível.
3. Para cotação/proposta, escolha "Novo contrato independente" ou "Termo aditivo de: …".
4. Se for aditivo, selecione um contrato principal ativo disponível.
5. Confira "Dados", "Serviços" e "Revisão" antes de concluir.
<!-- screenshot: Criar contrato a partir de cotação, proposta ou modelo, sem dados pessoais reais -->

## Resultado esperado
Contrato criado com a origem comercial registrada; caso a origem já tenha gerado contrato, o existente é aberto.

## Regras e limites
- A listagem sem contexto de negócio não oferece busca universal de cotações/propostas.
- Cotação: itens viram serviços. Proposta: preserva proposta e cotação de origem.
- No modelo, tipo vem do modelo; empresa, valores e vigência vêm do negócio e modelo.
- Conversão já feita não deve ser repetida para criar duplicata.

## Erros comuns
"Selecione o contrato principal do aditivo.": escolha um principal válido.
"A empresa não tem contrato ativo, então não há aditivo para escolher.": use contrato independente quando adequado.
"Este documento já gerou um contrato — abrindo o existente." é prevenção de duplicidade.

## Relacionados
- [Criar contrato em branco](/ajuda/contracts/criar-contrato)
- [Organizar modelos](/ajuda/contracts/gerenciar-modelos)
