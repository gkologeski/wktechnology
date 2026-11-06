---
module_key: contracts
slug: gerar-de-modelo
title: Gerar contrato pelo diálogo de modelo publicado
summary: Gerar contrato pelo diálogo de modelo publicado no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts
min_permission:
audience: internal
sort_order: 25
version: 1
is_published: true
---
# Gerar contrato pelo diálogo de modelo publicado
**Para que serve:** Gerar contrato pelo diálogo de modelo publicado.
**Quem pode fazer:** Usuário autenticado com acesso ao módulo e aos dados de origem; o caminho auditado depende também dos controles do banco, sem middleware granular explícito de modelos.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Modelo publicado disponível.

## Passo a passo
1. Clique em "Gerar de modelo".
2. Em "Gerar contrato a partir de modelo", escolha "Modelo publicado".
3. Preencha "Serviço (opcional)" e "Título do contrato (opcional)" se necessário.
4. Use "Pré-visualizar" para revisar o texto mesclado.
5. Clique em "Gerar contrato".
<!-- screenshot: Gerar contrato pelo diálogo de modelo publicado, sem dados pessoais reais -->

## Resultado esperado
"Contrato gerado em rascunho." e abertura da ficha.

## Regras e limites
- Prévia não é requisito obrigatório de geração, mas permite revisão.
- Empresa e negócio vêm do contexto; não são seletores desse diálogo.
- Trocar modelo, serviço ou título limpa a prévia.
- Título até 200 caracteres. Opções de serviços limitadas a 500.
- Geração não envia para assinatura nem aplica sobre contrato existente.

## Erros comuns
"Nenhum modelo publicado. Publique um modelo em Contratos → Modelos." ou "Modelo não encontrado": confira o modelo.

## Relacionados
- [Editar e publicar modelo](/ajuda/contracts/editar-publicar-modelo)
