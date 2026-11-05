---
module_key: crm
slug: configurar-sla-por-etapa
title: Configurar SLA por etapa
summary: Definir prazos em horas e consultar registros com SLA vencido.
article_type: howto
route_pattern: /settings/sla
min_permission: system.automation.sla.view.workspace
audience: internal
sort_order: 514
version: 2
is_published: true
---
# Configurar SLA por etapa
**Para que serve:** Definir o prazo de permanência nas etapas e acompanhar atrasos.
**Quem pode fazer:** Gestor+ ou `system.automation.sla.view.workspace`/`.manage.workspace`. Editar exige poder atualizar o pipeline e `system.automation.sla.manage.own/team/workspace`.
**Onde fica:** Menu > TechSales > Otimizar > SLA por etapa (`/settings/sla`).
**Antes de começar:** Configure pipelines com etapas.

## Passo a passo
1. Consulte "SLAs vencidos".
2. Localize o pipeline.
3. Informe o prazo em horas de cada etapa.
4. Deixe vazio para etapa sem prazo.
5. Clique em "Salvar SLA".
6. Confira "SLA atualizado".
<!-- screenshot: pipeline com prazos e Salvar SLA -->

## Resultado esperado
Prazos salvos e atrasos atualizados.

## Regras e limites
- Mínimo zero, passo de uma hora.
- No "Ver como" outro usuário não é possível editar.
- Sem permissão no pipeline, os campos ficam desabilitados.
- A mesma tela tem a seção de políticas de SLA de tickets. Veja [Configurar políticas de SLA de tickets](/ajuda/crm/configurar-politicas-sla-tickets).

## Erros comuns
- "Sem estágios configurados.": crie etapas no pipeline.
- "Erro ao salvar": confira valores e acesso.
- "Nenhum registro com SLA vencido. 🎉" não é erro.

## Relacionados
- [Consultar Analytics](/ajuda/crm/consultar-analytics)
