---
module_key: contracts
slug: consultar-servicos
title: Consultar serviços em execução
summary: Consultar serviços em execução no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /services
min_permission:
audience: internal
sort_order: 80
version: 1
is_published: true
---
# Consultar serviços em execução
**Para que serve:** Consultar serviços em execução.
**Quem pode fazer:** Quem tem leitura de techservice.services no escopo aplicável.
**Onde fica:** TechContracts > Contratos (/services).
**Antes de começar:** Serviços cadastrados dentro de contratos.

## Passo a passo
1. Abra "Serviços em execução".
2. Use "Buscar por nome…".
3. Filtre por "Tipo", "Status" e "Responsável".
4. Alterne entre tabela e kanban. Configure as colunas da tabela conforme necessário.
5. Clique no nome para abrir o serviço ou na coluna "Contrato" para abrir o contrato.
<!-- screenshot: Consultar serviços em execução, sem dados pessoais reais -->

## Resultado esperado
Lista de serviços vinculados aos contratos.

## Regras e limites
- Tipos: Recorrente, Único, Por marco, Por uso. Status: Pendente, Ativo, Pausado, Cancelado, Concluído.
- Valor = quantidade × preço unitário.
- A tela consulta até 200 registros. A seleção global usa uma busca de IDs separada e não corresponde apenas aos registros visíveis.
- "Limpar filtros" limpa tipo, status e responsável, mas não a busca por nome.
- Não há criação direta nessa lista. Catálogo de Serviços é um cadastro reutilizável; Serviços em execução são instâncias de um contrato.

## Erros comuns
Sem resultado: confira os filtros, a busca e seu acesso ao serviço.

## Relacionados
- [Editar serviço](/ajuda/contracts/editar-servico)
- [Visão geral](/ajuda/contracts/visao-geral)
- [Permissões](/ajuda/contracts/permissoes)
