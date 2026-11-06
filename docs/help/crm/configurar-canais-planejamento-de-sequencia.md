---
module_key: crm
slug: configurar-canais-planejamento-de-sequencia
title: Configurar canais e planejamento de uma sequência
summary: Ajuste horários, regras de parada, capacidade por canal e proteção contra contato recente.
article_type: howto
route_pattern: /prospecting/sequences
min_permission: system.automation.sequences.view.workspace
audience: internal
sort_order: 405
version: 1
is_published: true
---
# Configurar canais e planejamento de uma sequência
**Para que serve:** Planejar a capacidade de envio e definir quando a sequência aguarda ou encerra.
**Quem pode fazer:** Quem vê `system.automation.sequences` e tem create ou update. Referências de canais exigem `system.channels.view.workspace`.
**Onde fica:** Menu > TechSales > Sequências de prospecção (`/prospecting/sequences`).
**Antes de começar:** Abra um rascunho editável e conecte os canais.

## Passo a passo
1. Abra "Canais e regras".
2. Escolha "Agente padrão para respostas", se necessário.
3. Preencha "Intervalo mínimo por conta (segundos)" e "Limite por conta em 24 horas".
4. Revise "Interromper contatos pendentes ao receber resposta" e "Encerrar após reunião confirmada".
5. Configure "Fuso horário", "Início do expediente" e "Fim do expediente".
6. Abra "Limites e planejamento".
7. Revise "1. Capacidade por canal e salva-guarda": "Limite bruto por hora" (e-mail), "Limite bruto por dia" (WhatsApp) e "Salva-guarda".
8. Ajuste "2. Espaçamento aleatório entre envios de WhatsApp": "Intervalo mínimo" e "Intervalo máximo".
9. Revise "3. Proteção comercial e contato recente".
10. Use "4. Simulador de entrada diária" e ajuste "Novos contatos por dia".
11. Revise "5. Transbordo quando o limite for atingido" (enfileirar ou passar para o próximo canal).
12. Clique em "Salvar rascunho".
<!-- screenshot: abas Canais e regras e Limites e planejamento, com simulador -->

## Resultado esperado
As regras ficam no rascunho para validar e criar nova versão.

## Regras e limites
Intervalo por conta: 1 a 3.600 segundos. Limite em 24 horas: 1 a 1.000. Não substituem os limites do provedor. Horários no formato HH:mm. O simulador é planejamento, não garantia de envio.

## Erros comuns
"Revise a configuração.": corrija o campo apontado antes de salvar.

## Relacionados
- [Criar o fluxo de uma sequência multicanal](/ajuda/crm/criar-fluxo-de-sequencia)
- [Validar e criar uma versão imutável de sequência](/ajuda/crm/validar-versionar-sequencia)
