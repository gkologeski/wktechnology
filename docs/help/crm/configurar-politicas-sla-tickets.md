---
module_key: crm
slug: configurar-politicas-sla-tickets
title: Configurar políticas de SLA de tickets
summary: Definir prazos de primeira resposta e resolução por fila e prioridade.
article_type: howto
route_pattern: /settings/sla
min_permission: system.automation.sla.view.workspace
audience: internal
sort_order: 515
version: 1
is_published: true
---
# Configurar políticas de SLA de tickets
**Para que serve:** Dar prazos automáticos de primeira resposta e resolução aos tickets.
**Quem pode fazer:** Ver exige `system.automation.sla.view`; criar `.create`; editar `.update`; excluir `.delete`; "Verificar agora" exige `.manage` (escopo own, team ou workspace). O servidor também confere.
**Onde fica:** Menu > TechSales > Otimizar > SLA por etapa (`/settings/sla`) > seção "Políticas de SLA por prioridade/fila (tickets)".
**Antes de começar:** Tenha filas (pipelines) de tickets cadastradas, se quiser uma política por fila.

## Passo a passo
1. Abra a seção "Políticas de SLA por prioridade/fila (tickets)".
2. Clique em "Nova política".
3. Preencha "Nome".
4. Escolha "Fila (pipeline)" e "Prioridade". "Todas" vale para qualquer valor.
5. Informe "1ª resposta (min)" e "Resolução (min)".
6. Deixe "Ativa" ligado e clique em "Salvar".
7. Para editar, clique no lápis. Para excluir, clique na lixeira e confirme.
8. Para marcar vencimentos na hora, clique em "Verificar agora".
<!-- screenshot: janela Nova política de SLA -->

## Resultado esperado
Aparece "Política salva". "Verificar agora" mostra "Checagem: N 1ª resp + N resolução".

## Regras e limites
- Nome: obrigatório, até 120 caracteres.
- Prioridades: Baixa, Média, Alta, Urgente ou Todas.
- 1ª resposta: padrão 60 minutos, de 1 a 100.000.
- Resolução: padrão 1.440 minutos, de 1 a 1.000.000.
- "Verificar agora" só marca como vencidos os tickets com prazo passado, sem resposta ou sem resolução. Não recalcula prazos.
- Tickets excluídos são ignorados.

## Erros comuns
- Botões desabilitados: falta a permissão da ação.
- "Nenhuma política. Crie uma para que tickets ganhem prazos automáticos de primeira resposta e resolução.": ainda não há políticas.

## Relacionados
- [Configurar SLA por etapa](/ajuda/crm/configurar-sla-por-etapa)
- [Acompanhar um ticket](/ajuda/crm/acompanhar-ticket)
