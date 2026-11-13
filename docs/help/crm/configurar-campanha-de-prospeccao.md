---
module_key: crm
slug: configurar-campanha-de-prospeccao
title: Configurar uma campanha de ligação em 5 passos
summary: Público, roteiros, agenda, pós-ligação e revisão antes de iniciar a campanha.
article_type: howto
route_pattern: /campaigns/calls/$id
min_permission: techsales.marketing.campaigns.view.workspace
audience: internal
sort_order: 402
version: 5
is_published: true
---
# Configurar uma campanha de ligação em 5 passos
**Para que serve:** Definir quem recebe ligações, quais roteiros a IA usa, quando ligar e o que acontece depois.
**Quem pode fazer:** Usuários com acesso às campanhas (`techsales.marketing.campaigns`). Iniciar e pausar exige `techsales.marketing.campaigns.manage` e `techsales.prospecting_voice.create`.
**Onde fica:** Menu > TechSales > Captar > Campanhas de Ligação > Campanha (`/campaigns/calls/$id`). Links antigos de `/prospecting/campaigns/$id` abrem esta mesma tela.
**Antes de começar:** Crie a campanha e os roteiros de ligação.

## Passo a passo
1. **Público:** revise o "Nome" e escolha o público no mesmo quadro das Campanhas de WhatsApp: "Fila de prospecção" (só filas de Leads), "Criar público" (base Leads, segmentos salvos e grupos de condições) ou "Lista manual" (um telefone de Lead já cadastrado por linha). Marque "Não ligar para quem já é cliente" e "Não ligar para quem está em negociação aberta" conforme o caso e ajuste a regra de contato recente: escolha "Desconsiderar ligações realizadas de outra campanha" ou "Desconsiderar ligações e mensagens de WhatsApp realizadas de outra campanha" e informe "em até X dias" (padrão 7; 0 desliga).
2. **Roteiros:** escolha o "Modo de atribuição" e as variantes. No modo por peso, os pesos precisam somar 100%.
3. **Agenda:** máximo de tentativas, intervalo, janela de horário e dias da semana.
4. **Pós-ligação (opcional):** WhatsApp automático depois da ligação.
5. **Revisar e iniciar:** confira a lista. Cada item pendente mostra o motivo e o botão "Corrigir".
6. Use "Salvar rascunho" a qualquer momento. "Iniciar" só libera com a lista completa; depois vira "Pausar" e, pausada, "Retomar".

A contagem abaixo do quadro mostra quantos Leads entram e por que os outros ficaram de fora; marque um retirado para incluí-lo mesmo assim. Campanhas antigas mostram o montador anterior até você clicar em "Usar o novo quadro".

## Resultado esperado
Ao iniciar, entram na fila só os leads que passam nas regras. Quem foi retirado aparece na "Auditoria de enfileiramento" com o motivo.

## Regras e limites
A regra de contato recente só olha outras campanhas e apenas o que você pode ver. Ligações contam pela data da tentativa; WhatsApp conta envios concluídos de campanhas para o mesmo telefone. Salvar não dispara ligações.

## Erros comuns
"Iniciar" desligado: veja o motivo na barra inferior ou no passo 5.

## Relacionados
- [Criar e gerenciar campanhas de prospecção](/ajuda/crm/criar-gerenciar-campanhas-de-prospeccao)
- [Criar e editar roteiros de ligação](/ajuda/crm/criar-editar-roteiros-de-ligacao)
