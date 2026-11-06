---
module_key: contracts
slug: consultar-contratos
title: Consultar, filtrar e agrupar contratos
summary: Consultar, filtrar e agrupar contratos no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts
min_permission:
audience: internal
sort_order: 20
version: 1
is_published: true
---
# Consultar, filtrar e agrupar contratos
**Para que serve:** Consultar, filtrar e agrupar contratos.
**Quem pode fazer:** Leitura de techcontracts.contracts no escopo dos registros.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Acesso ao módulo.

## Passo a passo
1. Abra TechContracts > Contratos > Contratos.
2. Escolha "Todos", "Ativos", "Em assinatura", "Vencendo em 30 dias" ou "Encerrados".
3. Use "Buscar por título ou número…" e combine "Tipo", "Status", "Empresa (contraparte)", "Contratante", "Vigência", "Período de início" e "Período de término".
4. Se desejar, agrupe por "Empresa", "Serviço", "Cargo" ou "Senioridade". "Nenhum" remove o agrupamento.
5. Abra o contrato desejado. Use "Limpar filtros" para remover os filtros.
<!-- screenshot: Consultar, filtrar e agrupar contratos, sem dados pessoais reais -->

## Resultado esperado
Lista de contratos conforme filtros e acesso.

## Regras e limites
- Tipo: Prestação ou Compra.
- Busca até 200 caracteres. A consulta paginada aceita de 1 a 200 registros por página; padrão de servidor: 50.
- Agrupamentos têm consultas próprias limitadas; não representam obrigatoriamente toda a base.
- Agrupar visualmente não cria vínculo contratual.
- A presença de uma ação no cabeçalho não comprova permissão para executá-la.

## Erros comuns
Sem registros: confira filtros e acesso. Não considere uma lista vazia como inexistência de contratos no workspace.

## Relacionados
- [Criar contrato](/ajuda/contracts/criar-contrato)
- [Editar contrato](/ajuda/contracts/editar-contrato)
